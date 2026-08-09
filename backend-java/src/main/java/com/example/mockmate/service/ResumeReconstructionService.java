package com.example.mockmate.service;

import com.example.mockmate.model.ATSReport;
import com.example.mockmate.model.NormalizedResume;
import com.example.mockmate.model.NormalizedResumeMapper;
import com.example.mockmate.model.ReconstructedResume;
import com.example.mockmate.model.ResumeData;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ResumeReconstructionService {

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL    = "llama-3.3-70b-versatile";

    private static final String SYS = """
        You are an expert resume writer with 15 years of experience writing resumes for Google, Microsoft,
        Amazon, Flipkart, Zepto, and top Indian startups.
        You specialise in ATS-optimized resumes that also impress human recruiters at every company level.

        CRITICAL ATS OPTIMIZATION RULES:
        1. Every bullet: Action Verb + Task + Result format
        2. Add metrics wherever realistic (%, numbers, scale)
        3. Use keywords from JD naturally – never stuff them
        4. Never fabricate – only use provided information
        5. Professional summary: exactly 3 sentences: Who you are + What you bring + What you want
        6. Skills sorted by JD relevance (most relevant first)
        7. All bullets past tense, start with strong verb
        8. Return ONLY valid JSON – no markdown, no explanation
        9. Respect pre-applied improvements: the candidate's summary and bullets have been pre-optimized with specific bullet rewrites and quantification suggestions. Retain these improvements.

        MANDATORY CONTENT PRESERVATION RULES:
        10. NEVER drop or omit ANY section from the original resume. Every achievement, certification, leadership item, project, and experience entry MUST be included.
        11. NEVER reduce the number of bullets per entry. If the original has 4 bullets, your version must have AT LEAST 4 bullets.
        12. ALL matched keywords from the ATS analysis MUST appear in the generated resume.
        13. ALL missing keywords MUST be naturally incorporated into relevant sections (skills, bullets, or summary).
        14. Tech stack for EVERY project must be preserved and enriched with JD-relevant technologies only if the candidate actually used them.
        15. ALL quantified metrics (percentages, numbers, rankings, team sizes) from the original MUST be preserved.
        16. The generated resume must score EQUAL TO OR HIGHER than the original ATS score provided.

        VERIFICATION CHECKLIST (apply before returning):
        - Count of experience entries >= original count
        - Count of project entries >= original count
        - Count of achievements >= original count
        - Count of certifications >= original count
        - All matched keywords present in output
        - Missing keywords incorporated naturally
        - Professional summary is exactly 3 sentences
        - Every bullet starts with a strong action verb
        """;

    private final WebClient    webClient;
    private final ObjectMapper objectMapper;

    @Value("${groq.api-key:}")
    private String groqKey;

    public ResumeReconstructionService(WebClient.Builder builder, ObjectMapper objectMapper) {
        this.webClient    = builder.baseUrl("https://api.groq.com/openai/v1/").build();
        this.objectMapper = objectMapper;
    }

    public ReconstructedResume reconstruct(ResumeData parsed, ATSReport report,
                                            String jobDescription, String templateId) {
        // Pre-apply suggested changes from the report (Tailored Summary, Bullet Rewrites) to a copied instance
        ResumeData modifiedParsed = preApplyReportSuggestions(parsed, report);

        String userPrompt = buildPrompt(modifiedParsed, report, jobDescription);
        log.info("[Reconstruct] Calling Groq for {}, template={}", modifiedParsed.getName(), templateId);
        long t = System.currentTimeMillis();

        List<String> modelsToTry = List.of("llama-3.3-70b-versatile", "mixtral-8x7b-32768", "llama-3.1-8b-instant");
        String raw = null;
        
        for (String modelName : modelsToTry) {
            try {
                log.info("[Reconstruct] Attempting reconstruction using model: {}", modelName);
                Map<String, Object> body = Map.of(
                    "model", modelName, "temperature", 0.3, "max_tokens", 4096,
                    "messages", List.of(
                        Map.of("role","system","content", SYS),
                        Map.of("role","user",  "content", userPrompt)
                    )
                );

                raw = webClient.post().uri("chat/completions")
                    .header("Authorization", "Bearer " + groqKey.trim())
                    .header("Content-Type", "application/json")
                    .bodyValue(body).retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(30)).block();
                
                if (raw != null && !raw.isBlank()) {
                    log.info("[Reconstruct] Successfully reconstructed using model: {}", modelName);
                    break;
                }
            } catch (Exception e) {
                log.warn("[Reconstruct] Model {} failed: {}. Trying next...", modelName, e.getMessage());
            }
        }

        if (raw == null || raw.isBlank()) {
            throw new RuntimeException("All Groq models failed during reconstruction.");
        }

        log.info("[Reconstruct] Groq responded in {}ms", System.currentTimeMillis() - t);
        try {
            var root    = objectMapper.readTree(raw);
            String json = root.path("choices").get(0).path("message").path("content").asText();
            ReconstructedResume result = objectMapper.readValue(stripFences(json), ReconstructedResume.class);
            result.setTemplateId(templateId);
            postApplyReportSuggestions(result, report);
            result.setImprovementsApplied(true);
            return result;
        } catch (Exception e) {
            throw new RuntimeException("Groq parse failed: " + e.getMessage(), e);
        }
    }

    /**
     * NEW PIPELINE METHOD — wraps reconstruct() and returns a NormalizedResume.
     * This is the method the new ATSDownloadService should call.
     * The existing reconstruct() is preserved for backward compatibility.
     */
    public NormalizedResume reconstructToNormalized(ResumeData parsed, ATSReport report,
                                                     String jobDescription, String templateId) {
        ReconstructedResume legacy = reconstruct(parsed, report, jobDescription, templateId);
        NormalizedResume normalized = NormalizedResumeMapper.fromReconstructed(legacy);
        normalized.setSourceReportId(null); // will be set by orchestrator
        normalized.setTemplateId(templateId);
        normalized.setAiEnhanced(true);
        normalized.setGeneratedAt(java.time.LocalDateTime.now());
        return normalized;
    }

    /**
     * NEW PIPELINE METHOD — fallback builder returning NormalizedResume.
     */
    public NormalizedResume buildFallbackNormalized(ResumeData parsed, ATSReport report) {
        ReconstructedResume legacy = buildFallback(parsed, report);
        NormalizedResume normalized = NormalizedResumeMapper.fromReconstructed(legacy);
        normalized.setAiEnhanced(false);
        normalized.setGeneratedAt(java.time.LocalDateTime.now());
        return normalized;
    }

    public ReconstructedResume buildFallback(ResumeData parsed, ATSReport report) {
        log.warn("[Reconstruct] Using fallback builder");
        ResumeData modifiedParsed = preApplyReportSuggestions(parsed, report);

        ReconstructedResume r = new ReconstructedResume();
        r.setName(modifiedParsed.getName()); r.setEmail(modifiedParsed.getEmail());
        r.setPhone(modifiedParsed.getPhone()); r.setLocation(modifiedParsed.getLocation());
        r.setGithub(modifiedParsed.getGithub()); r.setLinkedin(modifiedParsed.getLinkedin());
        r.setProfessionalSummary(modifiedParsed.getSummary());
        if (modifiedParsed.getSkills() != null) {
            r.setSkills(modifiedParsed.getSkills().stream().map(s -> {
                ReconstructedResume.SkillCategory sc = new ReconstructedResume.SkillCategory();
                sc.setLabel(s.getLabel()); sc.setValue(s.getValue()); sc.setPriority(1); return sc;
            }).collect(Collectors.toList()));
        }
        if (modifiedParsed.getExperience() != null) {
            r.setExperience(modifiedParsed.getExperience().stream().map(e -> {
                ReconstructedResume.ExperienceEntry ee = new ReconstructedResume.ExperienceEntry();
                ee.setCompany(e.getCompany()); ee.setRole(e.getRole());
                ee.setDuration(e.getDuration()); ee.setBullets(e.getBullets()); return ee;
            }).collect(Collectors.toList()));
        }
        if (modifiedParsed.getProjects() != null) {
            r.setProjects(modifiedParsed.getProjects().stream().map(p -> {
                ReconstructedResume.ProjectEntry pe = new ReconstructedResume.ProjectEntry();
                pe.setTitle(p.getTitle()); pe.setTechStack(p.getTechStack());
                pe.setDuration(p.getDuration()); pe.setBullets(p.getBullets()); return pe;
            }).collect(Collectors.toList()));
        }
        r.setAchievements(modifiedParsed.getAchievements());
        r.setCertifications(modifiedParsed.getCertifications());
        r.setLeadership(modifiedParsed.getLeadership());
        if (modifiedParsed.getEducation() != null) {
            ReconstructedResume.EducationEntry ed = new ReconstructedResume.EducationEntry();
            ed.setDegree(modifiedParsed.getEducation().getDegree());
            ed.setInstitution(modifiedParsed.getEducation().getInstitution());
            ed.setYear(modifiedParsed.getEducation().getYear());
            ed.setCgpa(modifiedParsed.getEducation().getCgpa());
            r.setEducation(ed);
        }
        r.setTemplateId("classic");
        postApplyReportSuggestions(r, report);
        r.setImprovementsApplied(true);
        return r;
    }

    private ResumeData preApplyReportSuggestions(ResumeData parsed, ATSReport report) {
        ResumeData copied = deepCopy(parsed);
        if (copied == null || report == null) return copied;

        // 1. Apply tailored professional summary
        if (report.getTailoredSummary() != null && !report.getTailoredSummary().isBlank()) {
            copied.setSummary(report.getTailoredSummary());
        }

        List<ATSReport.BulletRewrite> rewrites = report.getBulletRewrites();

        // 2. Pre-apply to experience bullets
        if (copied.getExperience() != null) {
            for (var entry : copied.getExperience()) {
                if (entry.getBullets() != null) {
                    List<String> updatedBullets = new ArrayList<>();
                    for (String bullet : entry.getBullets()) {
                        updatedBullets.add(applyBulletRewrites(bullet, rewrites));
                    }
                    entry.setBullets(updatedBullets);
                }
            }
        }

        // 3. Pre-apply to project bullets
        if (copied.getProjects() != null) {
            for (var entry : copied.getProjects()) {
                if (entry.getBullets() != null) {
                    List<String> updatedBullets = new ArrayList<>();
                    for (String bullet : entry.getBullets()) {
                        updatedBullets.add(applyBulletRewrites(bullet, rewrites));
                    }
                    entry.setBullets(updatedBullets);
                }
            }
        }

        return copied;
    }

    private String applyBulletRewrites(String bullet, List<ATSReport.BulletRewrite> rewrites) {
        if (bullet == null || bullet.isBlank()) return bullet;
        String trimmed = bullet.trim();

        // Try bullet rewrites
        if (rewrites != null) {
            for (var rw : rewrites) {
                if (rw.getOriginal() != null && rw.getRewritten() != null) {
                    if (trimmed.equalsIgnoreCase(rw.getOriginal().trim()) || trimmed.equalsIgnoreCase(rw.getRewritten().trim())) {
                        return rw.getRewritten();
                    }
                    if (isSimilar(trimmed, rw.getOriginal().trim())) {
                        log.info("[Reconstruct] Applying suggested bullet rewrite via similarity: '{}' -> '{}'", trimmed, rw.getRewritten());
                        return rw.getRewritten();
                    }
                }
            }
        }

        return bullet;
    }

    public void postApplyReportSuggestions(ReconstructedResume reconstructed, ATSReport report) {
        if (reconstructed == null || report == null) return;

        // 1. Force tailored professional summary from the report
        if (report.getTailoredSummary() != null && !report.getTailoredSummary().isBlank()) {
            reconstructed.setProfessionalSummary(report.getTailoredSummary());
            log.info("[PostProcess] Forced tailored professional summary from report");
        }

        List<ATSReport.BulletRewrite> rewrites = report.getBulletRewrites();

        // 2. Post-apply to experience bullets
        if (reconstructed.getExperience() != null) {
            for (var entry : reconstructed.getExperience()) {
                if (entry.getBullets() != null) {
                    List<String> updatedBullets = new ArrayList<>();
                    for (String bullet : entry.getBullets()) {
                        updatedBullets.add(applyBulletRewrites(bullet, rewrites));
                    }
                    entry.setBullets(updatedBullets);
                }
            }
        }

        // 3. Post-apply to project bullets
        if (reconstructed.getProjects() != null) {
            for (var entry : reconstructed.getProjects()) {
                if (entry.getBullets() != null) {
                    List<String> updatedBullets = new ArrayList<>();
                    for (String bullet : entry.getBullets()) {
                        updatedBullets.add(applyBulletRewrites(bullet, rewrites));
                    }
                    entry.setBullets(updatedBullets);
                }
            }
        }
    }

    private boolean isSimilar(String s1, String s2) {
        if (s1 == null || s2 == null) return false;
        String clean1 = s1.replaceAll("[^a-zA-Z0-9\\s]", "").toLowerCase().trim();
        String clean2 = s2.replaceAll("[^a-zA-Z0-9\\s]", "").toLowerCase().trim();
        if (clean1.equals(clean2)) return true;
        if (clean1.contains(clean2) && clean2.length() > 10) return true;
        if (clean2.contains(clean1) && clean1.length() > 10) return true;
        
        // Word overlap check
        String[] words1 = clean1.split("\\s+");
        String[] words2 = clean2.split("\\s+");
        if (words1.length == 0 || words2.length == 0) return false;
        
        Set<String> set1 = new HashSet<>(Arrays.asList(words1));
        int intersect = 0;
        for (String w : words2) {
            if (set1.contains(w)) intersect++;
        }
        
        double overlap = (double) intersect / Math.max(words1.length, words2.length);
        return overlap > 0.65;
    }

    private String formatExperience(List<ResumeData.ExperienceEntry> list) {
        if (list == null || list.isEmpty()) return "None";
        StringBuilder sb = new StringBuilder();
        for (var e : list) {
            sb.append("- Role: ").append(safe(e.getRole()))
              .append("\n  Company: ").append(safe(e.getCompany()))
              .append("\n  Duration: ").append(safe(e.getDuration()))
              .append("\n  Bullets:\n");
            if (e.getBullets() != null) {
                for (String bullet : e.getBullets()) {
                    sb.append("    * ").append(bullet).append("\n");
                }
            }
        }
        return sb.toString();
    }

    private String formatProjects(List<ResumeData.ProjectEntry> list) {
        if (list == null || list.isEmpty()) return "None";
        StringBuilder sb = new StringBuilder();
        for (var p : list) {
            sb.append("- Title: ").append(safe(p.getTitle()))
              .append("\n  Tech Stack: ").append(safe(p.getTechStack()))
              .append("\n  Duration: ").append(safe(p.getDuration()))
              .append("\n  Bullets:\n");
            if (p.getBullets() != null) {
                for (String bullet : p.getBullets()) {
                    sb.append("    * ").append(bullet).append("\n");
                }
            }
        }
        return sb.toString();
    }

    private String buildPrompt(ResumeData p, ATSReport r, String jd) {
        String missing  = r != null && r.getMissingKeywords() != null ?
            r.getMissingKeywords().stream().collect(Collectors.joining(", ")) : "";
        String matched  = r != null && r.getMatchedKeywords() != null ?
            r.getMatchedKeywords().stream().collect(Collectors.joining(", ")) : "";
        int originalScore = r != null ? r.getFinalScore() : 0;
        String tailoredSummary = r != null && r.getTailoredSummary() != null ? r.getTailoredSummary() : "";
        
        // Count original items for the LLM to match
        int expCount = p.getExperience() != null ? p.getExperience().size() : 0;
        int projCount = p.getProjects() != null ? p.getProjects().size() : 0;
        int achieveCount = p.getAchievements() != null ? p.getAchievements().size() : 0;
        int certCount = p.getCertifications() != null ? p.getCertifications().size() : 0;
        int leaderCount = p.getLeadership() != null ? p.getLeadership().size() : 0;

        StringBuilder improvements = new StringBuilder();
        if (r != null) {
            if (r.getBulletRewrites() != null && !r.getBulletRewrites().isEmpty()) {
                improvements.append("- Bullet Rewrites (Apply these exact rewrites to the corresponding bullets):\n");
                for (var rw : r.getBulletRewrites()) {
                    if (rw.getOriginal() != null && rw.getRewritten() != null) {
                        improvements.append("  * Replace: \"").append(rw.getOriginal().trim()).append("\"\n");
                        improvements.append("    With: \"").append(rw.getRewritten().trim()).append("\"\n");
                    }
                }
            }
            if (r.getQuantificationSuggestions() != null && !r.getQuantificationSuggestions().isEmpty()) {
                improvements.append("- Quantification & Metrics Suggestions (Rewrite the bullets to integrate these metrics):\n");
                for (var q : r.getQuantificationSuggestions()) {
                    if (q.getOriginal() != null && q.getSuggestion() != null) {
                        improvements.append("  * Bullet: \"").append(q.getOriginal().trim()).append("\"\n");
                        improvements.append("    Suggestion: \"").append(q.getSuggestion().trim()).append("\"\n");
                    }
                }
            }
        }
        String improvementsText = improvements.length() > 0 ? improvements.toString() : "None";
        
        return String.format("""
            Reconstruct this candidate's complete resume, fully optimized for the job description.
            
            ⚠️ CRITICAL ATS SCORE REQUIREMENT:
            The original resume scored %d/100 on ATS analysis.
            Your generated resume MUST score EQUAL TO OR HIGHER than %d.
            To achieve this:
            - Include ALL %d experience entries (do NOT drop any)
            - Include ALL %d project entries (do NOT drop any)
            - Include ALL %d achievements (do NOT drop any)
            - Include ALL %d certifications (do NOT drop any)
            - Include ALL %d leadership items (do NOT drop any)
            - Use the tailored summary provided below as the professional summary
            - Incorporate ALL missing keywords listed below into skills or bullets
            - Preserve ALL matched keywords — they MUST appear in your output
            - Integrate the suggested improvements and quantification metrics listed below
            
            SUGGESTED IMPROVEMENTS & REWRITES:
            %s

            CANDIDATE DATA:
            Name: %s | Phone: %s | Email: %s | Location: %s | GitHub: %s | LinkedIn: %s
            Education: %s %s %s %s
            Summary (use this as professionalSummary): %s
            Skills: %s
            Experience:
            %s
            Projects:
            %s
            Achievements (include ALL of these exactly): %s
            Certifications (include ALL of these exactly): %s
            Leadership (include ALL of these exactly): %s

            JOB DESCRIPTION: %s

            ATS INTELLIGENCE:
            Original ATS Score: %d — your output must score >= this
            MANDATORY keywords to include (currently missing from resume): %s
            Keywords already matched (MUST be preserved): %s
            Tailored professional summary to use: %s

            Return exactly this JSON (all fields required, no markdown):
            {"name":"","jobTitle":"","phone":"","email":"","location":"","github":"","linkedin":"",
            "professionalSummary":"Use the tailored summary provided above",
            "skills":[{"label":"","value":"","priority":1}],
            "experience":[{"company":"","role":"","duration":"","location":"","bullets":[]}],
            "projects":[{"title":"","techStack":"","duration":"","githubLink":null,"bullets":[]}],
            "achievements":[],"certifications":[],"leadership":[],
            "education":{"degree":"","institution":"","year":"","cgpa":"","relevantCoursework":[]},
            "atsOptimizationNote":"what was improved"}
            """,
            originalScore, originalScore,
            expCount, projCount, achieveCount, certCount, leaderCount,
            improvementsText,
            safe(p.getName()), safe(p.getPhone()), safe(p.getEmail()),
            safe(p.getLocation()), safe(p.getGithub()), safe(p.getLinkedin()),
            p.getEducation()!=null?safe(p.getEducation().getDegree()):"",
            p.getEducation()!=null?safe(p.getEducation().getInstitution()):"",
            p.getEducation()!=null?safe(p.getEducation().getYear()):"",
            p.getEducation()!=null?safe(p.getEducation().getCgpa()):"",
            !tailoredSummary.isBlank() ? tailoredSummary : safe(p.getSummary()),
            p.getSkills()!=null?p.getSkills().stream().map(s->s.getLabel()+":"+s.getValue()).collect(Collectors.joining("; ")):"",
            formatExperience(p.getExperience()),
            formatProjects(p.getProjects()),
            p.getAchievements()!=null?String.join("; ",p.getAchievements()):"",
            p.getCertifications()!=null?String.join("; ",p.getCertifications()):"",
            p.getLeadership()!=null?String.join("; ",p.getLeadership()):"",
            safe(jd), originalScore, missing, matched, tailoredSummary
        );
    }

    private ResumeData deepCopy(ResumeData source) {
        if (source == null) return null;
        ResumeData target = new ResumeData();
        target.setName(source.getName());
        target.setJobTitle(source.getJobTitle());
        target.setPhone(source.getPhone());
        target.setEmail(source.getEmail());
        target.setLocation(source.getLocation());
        target.setLinkedin(source.getLinkedin());
        target.setGithub(source.getGithub());
        target.setSummary(source.getSummary());

        if (source.getSkills() != null) {
            target.setSkills(source.getSkills().stream()
                .map(s -> new ResumeData.SkillCategory(s.getLabel(), s.getValue()))
                .collect(Collectors.toList()));
        }

        if (source.getExperience() != null) {
            target.setExperience(source.getExperience().stream()
                .map(e -> {
                    ResumeData.ExperienceEntry ee = new ResumeData.ExperienceEntry();
                    ee.setCompany(e.getCompany());
                    ee.setRole(e.getRole());
                    ee.setDuration(e.getDuration());
                    if (e.getBullets() != null) {
                        ee.setBullets(new ArrayList<>(e.getBullets()));
                    }
                    return ee;
                })
                .collect(Collectors.toList()));
        }

        if (source.getProjects() != null) {
            target.setProjects(source.getProjects().stream()
                .map(p -> {
                    ResumeData.ProjectEntry pe = new ResumeData.ProjectEntry();
                    pe.setTitle(p.getTitle());
                    pe.setTechStack(p.getTechStack());
                    pe.setDuration(p.getDuration());
                    if (p.getBullets() != null) {
                        pe.setBullets(new ArrayList<>(p.getBullets()));
                    }
                    return pe;
                })
                .collect(Collectors.toList()));
        }

        if (source.getAchievements() != null) {
            target.setAchievements(new ArrayList<>(source.getAchievements()));
        }
        if (source.getCertifications() != null) {
            target.setCertifications(new ArrayList<>(source.getCertifications()));
        }
        if (source.getLeadership() != null) {
            target.setLeadership(new ArrayList<>(source.getLeadership()));
        }

        if (source.getEducation() != null) {
            ResumeData.EducationEntry ed = new ResumeData.EducationEntry();
            ed.setDegree(source.getEducation().getDegree());
            ed.setInstitution(source.getEducation().getInstitution());
            ed.setYear(source.getEducation().getYear());
            ed.setCgpa(source.getEducation().getCgpa());
            target.setEducation(ed);
        }

        return target;
    }

    private String safe(String s) { return s != null ? s : ""; }
    private String stripFences(String t) {
        String c = t.trim();
        if (c.startsWith("```json")) c = c.substring(7);
        else if (c.startsWith("```")) c = c.substring(3);
        if (c.endsWith("```")) c = c.substring(0, c.length()-3);
        return c.trim();
    }
}
