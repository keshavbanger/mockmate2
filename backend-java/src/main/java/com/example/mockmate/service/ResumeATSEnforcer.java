package com.example.mockmate.service;

import com.example.mockmate.model.ATSReport;
import com.example.mockmate.model.ReconstructedResume;
import com.example.mockmate.model.ResumeData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * ResumeATSEnforcer
 * ─────────────────────────────────────────────────────────────────────────────
 * Post-processing service that ensures the generated resume retains all
 * ATS-relevant content from the original resume and incorporates every
 * improvement suggestion from the ATS report.
 *
 * This is the mandatory validation step that prevents ATS score regression.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeATSEnforcer {

    private final ATSScoringService atsScoringService;

    /**
     * Enforces ATS score parity between the generated resume and the original.
     * Returns the enforced resume (mutated in place for performance).
     *
     * @param reconstructed The LLM-generated resume
     * @param originalParsed The original parsed resume data
     * @param report The ATS analysis report with recommendations
     * @param jdText The job description text
     * @return The enforced resume with guaranteed ATS content preservation
     */
    public ReconstructedResume enforce(ReconstructedResume reconstructed,
                                        ResumeData originalParsed,
                                        ATSReport report,
                                        String jdText) {

        log.info("[ATSEnforcer] Starting ATS enforcement for: {}", reconstructed.getName());

        // 1. Restore any dropped sections from the original resume
        restoreDroppedSections(reconstructed, originalParsed);

        // 2. Ensure all matched keywords are still present
        ensureMatchedKeywordsRetained(reconstructed, report);

        // 3. Inject missing keywords into appropriate sections
        injectMissingKeywords(reconstructed, report, jdText);

        // 4. Preserve all achievements, certifications, and leadership
        preserveListSections(reconstructed, originalParsed);

        // 5. Ensure bullet count parity (no lost bullets)
        ensureBulletParity(reconstructed, originalParsed, report);

        // 6. Validate and fix skills section
        enforceSkillsCompleteness(reconstructed, originalParsed, report);

        // 7. Ensure professional summary is populated
        enforceProfessionalSummary(reconstructed, report, originalParsed);

        // 8. Run final ATS score comparison
        int generatedScore = computeATSScore(reconstructed, jdText);
        int originalScore = report.getFinalScore();

        log.info("[ATSEnforcer] Score comparison: original={} generated={}", originalScore, generatedScore);

        if (generatedScore < originalScore) {
            log.warn("[ATSEnforcer] Generated score ({}) is LOWER than original ({}). Applying aggressive fixes.",
                    generatedScore, originalScore);
            applyAggressiveFixes(reconstructed, originalParsed, report, jdText);

            // Re-check
            int refinedScore = computeATSScore(reconstructed, jdText);
            log.info("[ATSEnforcer] After aggressive fixes: score={}", refinedScore);
        }

        return reconstructed;
    }

    /**
     * Computes the ATS score for a reconstructed resume by building its text representation
     * and running it through the same scoring service used during analysis.
     */
    public int computeATSScore(ReconstructedResume resume, String jdText) {
        String resumeText = buildResumeText(resume);
        ATSScoringService.ScoringResult scoring = atsScoringService.score(resumeText, jdText);

        // Use the same weighted formula as ATSReportBuilder (deterministic-only path)
        double score = (scoring.getKeywordOverlapScore() * 0.35)
                     + (scoring.getSectionScore()        * 0.25)
                     + (scoring.getFormattingScore()     * 0.20)
                     + (scoring.getQuantificationScore() * 0.20);
        return (int) Math.round(Math.max(0, Math.min(100, score)));
    }

    /**
     * Builds a plain-text representation of the reconstructed resume
     * suitable for ATS scoring analysis.
     */
    public String buildResumeText(ReconstructedResume resume) {
        StringBuilder sb = new StringBuilder();

        // Contact info
        appendIfPresent(sb, resume.getName());
        appendIfPresent(sb, resume.getJobTitle());
        appendIfPresent(sb, resume.getEmail());
        appendIfPresent(sb, resume.getPhone());
        appendIfPresent(sb, resume.getLocation());
        appendIfPresent(sb, resume.getGithub());
        appendIfPresent(sb, resume.getLinkedin());

        // Professional Summary
        if (resume.getProfessionalSummary() != null) {
            sb.append("\nProfessional Summary\n");
            sb.append(resume.getProfessionalSummary()).append("\n");
        }

        // Skills
        if (resume.getSkills() != null && !resume.getSkills().isEmpty()) {
            sb.append("\nSkills\n");
            for (var skill : resume.getSkills()) {
                if (skill.getLabel() != null) sb.append(skill.getLabel()).append(": ");
                if (skill.getValue() != null) sb.append(skill.getValue());
                sb.append("\n");
            }
        }

        // Experience
        if (resume.getExperience() != null && !resume.getExperience().isEmpty()) {
            sb.append("\nExperience\n");
            for (var exp : resume.getExperience()) {
                if (exp.getRole() != null) sb.append(exp.getRole());
                if (exp.getCompany() != null) sb.append(" at ").append(exp.getCompany());
                if (exp.getDuration() != null) sb.append(" (").append(exp.getDuration()).append(")");
                sb.append("\n");
                if (exp.getBullets() != null) {
                    for (String bullet : exp.getBullets()) {
                        sb.append("• ").append(bullet).append("\n");
                    }
                }
            }
        }

        // Projects
        if (resume.getProjects() != null && !resume.getProjects().isEmpty()) {
            sb.append("\nProjects\n");
            for (var proj : resume.getProjects()) {
                if (proj.getTitle() != null) sb.append(proj.getTitle());
                if (proj.getTechStack() != null) sb.append(" | ").append(proj.getTechStack());
                if (proj.getDuration() != null) sb.append(" (").append(proj.getDuration()).append(")");
                sb.append("\n");
                if (proj.getBullets() != null) {
                    for (String bullet : proj.getBullets()) {
                        sb.append("• ").append(bullet).append("\n");
                    }
                }
            }
        }

        // Education
        if (resume.getEducation() != null) {
            sb.append("\nEducation\n");
            var ed = resume.getEducation();
            if (ed.getDegree() != null) sb.append(ed.getDegree());
            if (ed.getInstitution() != null) sb.append(", ").append(ed.getInstitution());
            if (ed.getYear() != null) sb.append(" (").append(ed.getYear()).append(")");
            if (ed.getCgpa() != null) sb.append(" CGPA: ").append(ed.getCgpa());
            sb.append("\n");
        }

        // Achievements
        appendListSection(sb, "Achievements", resume.getAchievements());

        // Certifications
        appendListSection(sb, "Certifications", resume.getCertifications());

        // Leadership
        appendListSection(sb, "Leadership", resume.getLeadership());

        return sb.toString();
    }

    // ── Private Helper Methods ──────────────────────────────────────────────

    private void restoreDroppedSections(ReconstructedResume reconstructed, ResumeData original) {
        if (original == null) return;

        // Restore education if dropped
        if (reconstructed.getEducation() == null && original.getEducation() != null) {
            log.info("[ATSEnforcer] Restoring dropped education section");
            ReconstructedResume.EducationEntry ed = new ReconstructedResume.EducationEntry();
            ed.setDegree(original.getEducation().getDegree());
            ed.setInstitution(original.getEducation().getInstitution());
            ed.setYear(original.getEducation().getYear());
            ed.setCgpa(original.getEducation().getCgpa());
            reconstructed.setEducation(ed);
        }

        // Restore experience if dropped/missing
        if (reconstructed.getExperience() == null) {
            reconstructed.setExperience(new ArrayList<>());
        }
        if (original.getExperience() != null) {
            Set<String> existingCompanies = reconstructed.getExperience().stream()
                    .map(e -> e.getCompany() != null ? e.getCompany().toLowerCase().replaceAll("[^a-z0-9]", "") : "")
                    .filter(c -> !c.isEmpty())
                    .collect(Collectors.toSet());
            for (var origExp : original.getExperience()) {
                String company = origExp.getCompany() != null ? origExp.getCompany().toLowerCase().replaceAll("[^a-z0-9]", "") : "";
                if (!company.isEmpty() && !existingCompanies.contains(company)) {
                    ReconstructedResume.ExperienceEntry ee = new ReconstructedResume.ExperienceEntry();
                    ee.setCompany(origExp.getCompany()); ee.setRole(origExp.getRole());
                    ee.setDuration(origExp.getDuration()); ee.setBullets(origExp.getBullets());
                    reconstructed.getExperience().add(ee);
                    log.info("[ATSEnforcer] Restored dropped experience: {}", origExp.getCompany());
                }
            }
        }

        // Restore projects if dropped/missing
        if (reconstructed.getProjects() == null) {
            reconstructed.setProjects(new ArrayList<>());
        }
        if (original.getProjects() != null) {
            Set<String> existingTitles = reconstructed.getProjects().stream()
                    .map(p -> p.getTitle() != null ? p.getTitle().toLowerCase().replaceAll("[^a-z0-9]", "") : "")
                    .filter(t -> !t.isEmpty())
                    .collect(Collectors.toSet());
            for (var origProj : original.getProjects()) {
                String title = origProj.getTitle() != null ? origProj.getTitle().toLowerCase().replaceAll("[^a-z0-9]", "") : "";
                if (!title.isEmpty() && !existingTitles.contains(title)) {
                    ReconstructedResume.ProjectEntry pe = new ReconstructedResume.ProjectEntry();
                    pe.setTitle(origProj.getTitle()); pe.setTechStack(origProj.getTechStack());
                    pe.setDuration(origProj.getDuration()); pe.setBullets(origProj.getBullets());
                    reconstructed.getProjects().add(pe);
                    log.info("[ATSEnforcer] Restored dropped project: {}", origProj.getTitle());
                }
            }
        }
    }

    private void ensureMatchedKeywordsRetained(ReconstructedResume reconstructed, ATSReport report) {
        if (report.getMatchedKeywords() == null || report.getMatchedKeywords().isEmpty()) return;

        String resumeText = buildResumeText(reconstructed).toLowerCase();
        List<String> lostKeywords = new ArrayList<>();

        for (String keyword : report.getMatchedKeywords()) {
            if (!resumeText.contains(keyword.toLowerCase())) {
                lostKeywords.add(keyword);
            }
        }

        if (!lostKeywords.isEmpty()) {
            log.warn("[ATSEnforcer] {} matched keywords were LOST in reconstruction: {}",
                    lostKeywords.size(), lostKeywords);
            injectKeywordsIntoSkills(reconstructed, lostKeywords, "Retained Skills");
        }
    }

    private void injectMissingKeywords(ReconstructedResume reconstructed, ATSReport report, String jdText) {
        if (report.getMissingKeywords() == null || report.getMissingKeywords().isEmpty()) return;

        // Only inject keywords that are still missing after reconstruction
        String resumeText = buildResumeText(reconstructed).toLowerCase();
        List<String> stillMissing = report.getMissingKeywords().stream()
                .filter(kw -> !resumeText.contains(kw.toLowerCase()))
                .collect(Collectors.toList());

        if (!stillMissing.isEmpty()) {
            log.info("[ATSEnforcer] Injecting {} still-missing keywords: {}", stillMissing.size(), stillMissing);
            injectKeywordsIntoSkills(reconstructed, stillMissing, "Additional Skills");
        }
    }

    private void injectKeywordsIntoSkills(ReconstructedResume reconstructed, List<String> keywords, String categoryLabel) {
        if (keywords.isEmpty()) return;

        List<ReconstructedResume.SkillCategory> skills = reconstructed.getSkills();
        if (skills == null) {
            skills = new ArrayList<>();
            reconstructed.setSkills(skills);
        }

        // Check if a matching category already exists
        for (var skill : skills) {
            if (categoryLabel.equalsIgnoreCase(skill.getLabel())) {
                String existing = skill.getValue() != null ? skill.getValue() : "";
                Set<String> existingSet = Arrays.stream(existing.toLowerCase().split("[,;]"))
                        .map(String::trim).collect(Collectors.toSet());
                List<String> toAdd = keywords.stream()
                        .filter(kw -> !existingSet.contains(kw.toLowerCase()))
                        .collect(Collectors.toList());
                if (!toAdd.isEmpty()) {
                    String newVal = existing.isEmpty() ? String.join(", ", toAdd) : existing + ", " + String.join(", ", toAdd);
                    skill.setValue(newVal);
                }
                return;
            }
        }

        // Create new category
        ReconstructedResume.SkillCategory newCat = new ReconstructedResume.SkillCategory();
        newCat.setLabel(categoryLabel);
        newCat.setValue(String.join(", ", keywords));
        newCat.setPriority(skills.size() + 1);
        skills.add(newCat);
    }

    private void preserveListSections(ReconstructedResume reconstructed, ResumeData original) {
        if (original == null) return;

        // Achievements: merge, don't replace
        if (original.getAchievements() != null && !original.getAchievements().isEmpty()) {
            List<String> current = reconstructed.getAchievements() != null
                    ? new ArrayList<>(reconstructed.getAchievements()) : new ArrayList<>();
            Set<String> currentLower = current.stream()
                    .map(String::toLowerCase).collect(Collectors.toSet());

            int restored = 0;
            for (String achievement : original.getAchievements()) {
                if (!currentLower.contains(achievement.toLowerCase())) {
                    current.add(achievement);
                    restored++;
                }
            }
            if (restored > 0) {
                log.info("[ATSEnforcer] Restored {} dropped achievements", restored);
                reconstructed.setAchievements(current);
            }
        }

        // Certifications
        if (original.getCertifications() != null && !original.getCertifications().isEmpty()) {
            List<String> current = reconstructed.getCertifications() != null
                    ? new ArrayList<>(reconstructed.getCertifications()) : new ArrayList<>();
            Set<String> currentLower = current.stream()
                    .map(String::toLowerCase).collect(Collectors.toSet());

            int restored = 0;
            for (String cert : original.getCertifications()) {
                if (!currentLower.contains(cert.toLowerCase())) {
                    current.add(cert);
                    restored++;
                }
            }
            if (restored > 0) {
                log.info("[ATSEnforcer] Restored {} dropped certifications", restored);
                reconstructed.setCertifications(current);
            }
        }

        // Leadership
        if (original.getLeadership() != null && !original.getLeadership().isEmpty()) {
            List<String> current = reconstructed.getLeadership() != null
                    ? new ArrayList<>(reconstructed.getLeadership()) : new ArrayList<>();
            Set<String> currentLower = current.stream()
                    .map(String::toLowerCase).collect(Collectors.toSet());

            int restored = 0;
            for (String item : original.getLeadership()) {
                if (!currentLower.contains(item.toLowerCase())) {
                    current.add(item);
                    restored++;
                }
            }
            if (restored > 0) {
                log.info("[ATSEnforcer] Restored {} dropped leadership items", restored);
                reconstructed.setLeadership(current);
            }
        }
    }

    private void ensureBulletParity(ReconstructedResume reconstructed, ResumeData original, ATSReport report) {
        if (original == null) return;

        // Experience bullets - order independent
        if (original.getExperience() != null && reconstructed.getExperience() != null) {
            for (var origEntry : original.getExperience()) {
                if (origEntry.getBullets() == null || origEntry.getBullets().isEmpty()) continue;
                
                // Find matching reconstructed experience
                ReconstructedResume.ExperienceEntry bestMatch = null;
                for (var reconEntry : reconstructed.getExperience()) {
                    if (isCompanyMatch(origEntry.getCompany(), reconEntry.getCompany())) {
                        bestMatch = reconEntry;
                        break;
                    }
                }
                
                if (bestMatch != null && bestMatch.getBullets() != null) {
                    List<String> mergedBullets = new ArrayList<>(bestMatch.getBullets());
                    boolean restoredAny = false;
                    for (String origBullet : origEntry.getBullets()) {
                        if (!isBulletAccountedFor(origBullet, bestMatch.getBullets(), report)) {
                            log.info("[ATSEnforcer] Experience '{}': Bullet not accounted for, appending original: '{}'",
                                    bestMatch.getCompany(), origBullet);
                            mergedBullets.add(origBullet);
                            restoredAny = true;
                        }
                    }
                    if (restoredAny) {
                        bestMatch.setBullets(mergedBullets);
                    }
                } else {
                    log.warn("[ATSEnforcer] Could not find matching experience for company '{}' to enforce bullet parity",
                            origEntry.getCompany());
                }
            }
        }

        // Project bullets - order independent
        if (original.getProjects() != null && reconstructed.getProjects() != null) {
            for (var origEntry : original.getProjects()) {
                if (origEntry.getBullets() == null || origEntry.getBullets().isEmpty()) continue;
                
                // Find matching reconstructed project
                ReconstructedResume.ProjectEntry bestMatch = null;
                for (var reconEntry : reconstructed.getProjects()) {
                    if (isProjectMatch(origEntry.getTitle(), reconEntry.getTitle())) {
                        bestMatch = reconEntry;
                        break;
                    }
                }
                
                if (bestMatch != null && bestMatch.getBullets() != null) {
                    List<String> mergedBullets = new ArrayList<>(bestMatch.getBullets());
                    boolean restoredAny = false;
                    for (String origBullet : origEntry.getBullets()) {
                        if (!isBulletAccountedFor(origBullet, bestMatch.getBullets(), report)) {
                            log.info("[ATSEnforcer] Project '{}': Bullet not accounted for, appending original: '{}'",
                                    bestMatch.getTitle(), origBullet);
                            mergedBullets.add(origBullet);
                            restoredAny = true;
                        }
                    }
                    if (restoredAny) {
                        bestMatch.setBullets(mergedBullets);
                    }
                } else {
                    log.warn("[ATSEnforcer] Could not find matching project for title '{}' to enforce bullet parity",
                            origEntry.getTitle());
                }
            }
        }
    }

    private boolean isCompanyMatch(String comp1, String comp2) {
        if (comp1 == null || comp2 == null) return false;
        String clean1 = comp1.replaceAll("[^a-zA-Z0-9]", "").toLowerCase().trim();
        String clean2 = comp2.replaceAll("[^a-zA-Z0-9]", "").toLowerCase().trim();
        if (clean1.isEmpty() || clean2.isEmpty()) return false;
        return clean1.contains(clean2) || clean2.contains(clean1);
    }

    private boolean isProjectMatch(String title1, String title2) {
        if (title1 == null || title2 == null) return false;
        String clean1 = title1.replaceAll("[^a-zA-Z0-9]", "").toLowerCase().trim();
        String clean2 = title2.replaceAll("[^a-zA-Z0-9]", "").toLowerCase().trim();
        if (clean1.isEmpty() || clean2.isEmpty()) return false;
        return clean1.contains(clean2) || clean2.contains(clean1);
    }

    private boolean isBulletAccountedFor(String origBullet, List<String> reconBullets, ATSReport report) {
        if (origBullet == null || origBullet.isBlank()) return true;
        if (reconBullets == null || reconBullets.isEmpty()) return false;

        // 1. Direct semantic similarity match
        if (isSubstantiallyOverlapping(origBullet, reconBullets)) {
            return true;
        }

        // 2. Check Bullet Rewrites in report
        if (report != null && report.getBulletRewrites() != null) {
            for (var rw : report.getBulletRewrites()) {
                if (rw.getOriginal() != null && rw.getRewritten() != null) {
                    if (isSubstantiallyOverlappingWithThreshold(origBullet, rw.getOriginal(), 0.75)) {
                        if (isSubstantiallyOverlapping(rw.getRewritten(), reconBullets) || isSubstantiallyOverlapping(rw.getOriginal(), reconBullets)) {
                            return true;
                        }
                    }
                }
            }
        }

        // 3. Check Quantification Suggestions in report
        if (report != null && report.getQuantificationSuggestions() != null) {
            for (var q : report.getQuantificationSuggestions()) {
                if (q.getOriginal() != null && q.getSuggestion() != null) {
                    if (isSubstantiallyOverlappingWithThreshold(origBullet, q.getOriginal(), 0.75)) {
                        if (isSubstantiallyOverlapping(q.getSuggestion(), reconBullets) || isSubstantiallyOverlapping(q.getOriginal(), reconBullets)) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    private boolean isSubstantiallyOverlapping(String bullet, List<String> existingBullets) {
        if (bullet == null || existingBullets == null) return false;
        for (String existing : existingBullets) {
            if (isSubstantiallyOverlappingWithThreshold(bullet, existing, 0.60)) {
                return true;
            }
        }
        return false;
    }

    private boolean isSubstantiallyOverlappingWithThreshold(String bullet1, String bullet2, double threshold) {
        if (bullet1 == null || bullet2 == null) return false;
        String clean1 = bullet1.replaceAll("[^a-zA-Z0-9\\s]", "").toLowerCase().trim();
        String clean2 = bullet2.replaceAll("[^a-zA-Z0-9\\s]", "").toLowerCase().trim();
        if (clean1.equals(clean2)) return true;
        if (clean1.contains(clean2) && clean2.length() > 10) return true;
        if (clean2.contains(clean1) && clean1.length() > 10) return true;

        String[] words1 = clean1.split("\\s+");
        String[] words2 = clean2.split("\\s+");
        if (words1.length == 0 || words2.length == 0) return false;

        Set<String> set1 = new HashSet<>(Arrays.asList(words1));
        int overlap = 0;
        for (String w : words2) {
            if (set1.contains(w)) overlap++;
        }
        double ratio = (double) overlap / Math.max(words1.length, words2.length);
        return ratio > threshold;
    }

    private void enforceSkillsCompleteness(ReconstructedResume reconstructed, ResumeData original, ATSReport report) {
        if (original == null || original.getSkills() == null) return;

        List<ReconstructedResume.SkillCategory> genSkills = reconstructed.getSkills();
        if (genSkills == null) {
            genSkills = new ArrayList<>();
            reconstructed.setSkills(genSkills);
        }

        // Build set of all skill values currently in the generated resume
        Set<String> allGenSkillValues = new HashSet<>();
        for (var skill : genSkills) {
            if (skill.getValue() != null) {
                Arrays.stream(skill.getValue().toLowerCase().split("[,;]"))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .forEach(allGenSkillValues::add);
            }
        }

        // Check each original skill category
        for (var origSkill : original.getSkills()) {
            if (origSkill.getValue() == null) continue;
            String[] origValues = origSkill.getValue().split("[,;]");

            List<String> missingValues = new ArrayList<>();
            for (String val : origValues) {
                String trimVal = val.trim().toLowerCase();
                if (!trimVal.isEmpty() && !allGenSkillValues.contains(trimVal)) {
                    missingValues.add(val.trim());
                }
            }

            if (!missingValues.isEmpty()) {
                // Find matching category or add to it
                boolean found = false;
                for (var genSkill : genSkills) {
                    if (genSkill.getLabel() != null
                            && origSkill.getLabel() != null
                            && genSkill.getLabel().equalsIgnoreCase(origSkill.getLabel())) {
                        String existing = genSkill.getValue() != null ? genSkill.getValue() : "";
                        genSkill.setValue(existing + ", " + String.join(", ", missingValues));
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    ReconstructedResume.SkillCategory newCat = new ReconstructedResume.SkillCategory();
                    newCat.setLabel(origSkill.getLabel());
                    newCat.setValue(origSkill.getValue());
                    newCat.setPriority(genSkills.size() + 1);
                    genSkills.add(newCat);
                }
                log.info("[ATSEnforcer] Restored {} missing skills in category '{}'",
                        missingValues.size(), origSkill.getLabel());
            }
        }
    }

    private void enforceProfessionalSummary(ReconstructedResume reconstructed, ATSReport report, ResumeData original) {
        // Use tailored summary from report if available, otherwise keep what was generated
        if (report != null && report.getTailoredSummary() != null && !report.getTailoredSummary().isBlank()) {
            if (reconstructed.getProfessionalSummary() == null || reconstructed.getProfessionalSummary().isBlank()) {
                reconstructed.setProfessionalSummary(report.getTailoredSummary());
                log.info("[ATSEnforcer] Set professional summary from tailored summary");
            }
        } else if (reconstructed.getProfessionalSummary() == null || reconstructed.getProfessionalSummary().isBlank()) {
            if (original != null && original.getSummary() != null && !original.getSummary().isBlank()) {
                reconstructed.setProfessionalSummary(original.getSummary());
                log.info("[ATSEnforcer] Restored professional summary from original resume");
            }
        }
    }

    /**
     * Aggressive fixes applied when the generated score is still lower than the original.
     * This is the last resort to ensure score parity.
     */
    private void applyAggressiveFixes(ReconstructedResume reconstructed, ResumeData original,
                                       ATSReport report, String jdText) {
        log.info("[ATSEnforcer] Applying aggressive ATS fixes");

        // 1. Force-inject ALL missing keywords from the report into a dedicated skills section
        if (report.getMissingKeywords() != null && !report.getMissingKeywords().isEmpty()) {
            String resumeText = buildResumeText(reconstructed).toLowerCase();
            List<String> stillMissing = report.getMissingKeywords().stream()
                    .filter(kw -> !resumeText.contains(kw.toLowerCase()))
                    .collect(Collectors.toList());
            if (!stillMissing.isEmpty()) {
                injectKeywordsIntoSkills(reconstructed, stillMissing, "Technical Proficiencies");
                log.info("[ATSEnforcer] Aggressively injected {} missing keywords", stillMissing.size());
            }
        }

        // 2. If original had more projects/experience entries, restore ALL of them
        if (original != null) {
            if (original.getProjects() != null && reconstructed.getProjects() != null) {
                if (reconstructed.getProjects().size() < original.getProjects().size()) {
                    Set<String> existingTitles = reconstructed.getProjects().stream()
                            .map(p -> p.getTitle() != null ? p.getTitle().toLowerCase() : "")
                            .collect(Collectors.toSet());
                    List<ReconstructedResume.ProjectEntry> restoredProjects = new ArrayList<>(reconstructed.getProjects());
                    for (var origProj : original.getProjects()) {
                        String title = origProj.getTitle() != null ? origProj.getTitle().toLowerCase() : "";
                        if (!existingTitles.contains(title)) {
                            ReconstructedResume.ProjectEntry pe = new ReconstructedResume.ProjectEntry();
                            pe.setTitle(origProj.getTitle()); pe.setTechStack(origProj.getTechStack());
                            pe.setDuration(origProj.getDuration()); pe.setBullets(origProj.getBullets());
                            restoredProjects.add(pe);
                            log.info("[ATSEnforcer] Aggressively restored dropped project: {}", origProj.getTitle());
                        }
                    }
                    reconstructed.setProjects(restoredProjects);
                }
            }

            if (original.getExperience() != null && reconstructed.getExperience() != null) {
                if (reconstructed.getExperience().size() < original.getExperience().size()) {
                    Set<String> existingCompanies = reconstructed.getExperience().stream()
                            .map(e -> e.getCompany() != null ? e.getCompany().toLowerCase() : "")
                            .collect(Collectors.toSet());
                    List<ReconstructedResume.ExperienceEntry> restoredExp = new ArrayList<>(reconstructed.getExperience());
                    for (var origExp : original.getExperience()) {
                        String company = origExp.getCompany() != null ? origExp.getCompany().toLowerCase() : "";
                        if (!existingCompanies.contains(company)) {
                            ReconstructedResume.ExperienceEntry ee = new ReconstructedResume.ExperienceEntry();
                            ee.setCompany(origExp.getCompany()); ee.setRole(origExp.getRole());
                            ee.setDuration(origExp.getDuration()); ee.setBullets(origExp.getBullets());
                            restoredExp.add(ee);
                            log.info("[ATSEnforcer] Aggressively restored dropped experience: {}", origExp.getCompany());
                        }
                    }
                    reconstructed.setExperience(restoredExp);
                }
            }
        }

        // 3. Ensure tech stacks in projects have JD-relevant keywords
        if (reconstructed.getProjects() != null && jdText != null) {
            String jdLower = jdText.toLowerCase();
            for (var proj : reconstructed.getProjects()) {
                if (proj.getTechStack() == null || proj.getTechStack().isBlank()) continue;
                // If project techStack mentions tools in the JD, that's good — leave it
            }
        }
    }

    private void appendIfPresent(StringBuilder sb, String value) {
        if (value != null && !value.isBlank()) {
            sb.append(value).append("\n");
        }
    }

    private void appendListSection(StringBuilder sb, String sectionName, List<String> items) {
        if (items != null && !items.isEmpty()) {
            sb.append("\n").append(sectionName).append("\n");
            for (String item : items) {
                sb.append("• ").append(item).append("\n");
            }
        }
    }
}
