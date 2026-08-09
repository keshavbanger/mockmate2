package com.example.mockmate.model;

import java.util.List;
import java.util.stream.Collectors;

/**
 * NormalizedResumeMapper — bidirectional conversion between
 * {@link NormalizedResume} and the legacy {@link ReconstructedResume}.
 * <p>
 * This exists purely for the migration period. Once all services
 * consume NormalizedResume directly, this class can be deleted.
 */
public final class NormalizedResumeMapper {

    private NormalizedResumeMapper() {}

    // ── NormalizedResume → ReconstructedResume ───────────────────────────────

    public static ReconstructedResume toReconstructed(NormalizedResume n) {
        if (n == null) return null;
        ReconstructedResume r = new ReconstructedResume();

        r.setName(n.getName());
        r.setJobTitle(n.getJobTitle());
        r.setPhone(n.getPhone());
        r.setEmail(n.getEmail());
        r.setLocation(n.getLocation());
        r.setGithub(n.getGithub());
        r.setLinkedin(n.getLinkedin());
        r.setProfessionalSummary(n.getProfessionalSummary());
        r.setAchievements(n.getAchievements());
        r.setCertifications(n.getCertifications());
        r.setLeadership(n.getLeadership());
        r.setImprovementsApplied(n.isImprovementsApplied());
        r.setAddedKeywords(n.getAddedKeywords());
        r.setRewrittenBullets(n.getRewrittenBullets());
        r.setAtsScore(n.getAtsScore());
        r.setAtsOptimizationNote(n.getAtsOptimizationNote());

        // Education
        if (n.getEducation() != null) {
            ReconstructedResume.EducationEntry e = new ReconstructedResume.EducationEntry();
            e.setDegree(n.getEducation().getDegree());
            e.setInstitution(n.getEducation().getInstitution());
            e.setYear(n.getEducation().getYear());
            e.setCgpa(n.getEducation().getCgpa());
            e.setRelevantCoursework(n.getEducation().getRelevantCoursework());
            r.setEducation(e);
        }

        // Skills
        if (n.getSkills() != null) {
            r.setSkills(n.getSkills().stream().map(ns -> {
                ReconstructedResume.SkillCategory sc = new ReconstructedResume.SkillCategory();
                sc.setLabel(ns.getLabel());
                sc.setValue(ns.getValue());
                return sc;
            }).collect(Collectors.toList()));
        }

        // Experience
        if (n.getExperience() != null) {
            r.setExperience(n.getExperience().stream().map(ne -> {
                ReconstructedResume.ExperienceEntry ee = new ReconstructedResume.ExperienceEntry();
                ee.setCompany(ne.getCompany());
                ee.setRole(ne.getRole());
                ee.setDuration(ne.getDuration());
                ee.setLocation(ne.getLocation());
                ee.setBullets(ne.getBullets());
                return ee;
            }).collect(Collectors.toList()));
        }

        // Projects
        if (n.getProjects() != null) {
            r.setProjects(n.getProjects().stream().map(np -> {
                ReconstructedResume.ProjectEntry pe = new ReconstructedResume.ProjectEntry();
                pe.setTitle(np.getTitle());
                pe.setTechStack(np.getTechStack());
                pe.setDuration(np.getDuration());
                pe.setGithubLink(np.getGithubLink());
                pe.setBullets(np.getBullets());
                return pe;
            }).collect(Collectors.toList()));
        }

        return r;
    }

    // ── ReconstructedResume → NormalizedResume ───────────────────────────────

    public static NormalizedResume fromReconstructed(ReconstructedResume r) {
        if (r == null) return null;
        NormalizedResume n = NormalizedResume.builder()
            .name(r.getName())
            .jobTitle(r.getJobTitle())
            .phone(r.getPhone())
            .email(r.getEmail())
            .location(r.getLocation())
            .github(r.getGithub())
            .linkedin(r.getLinkedin())
            .professionalSummary(r.getProfessionalSummary())
            .achievements(r.getAchievements())
            .certifications(r.getCertifications())
            .leadership(r.getLeadership())
            .improvementsApplied(r.isImprovementsApplied())
            .addedKeywords(r.getAddedKeywords())
            .rewrittenBullets(r.getRewrittenBullets())
            .atsScore(r.getAtsScore())
            .atsOptimizationNote(r.getAtsOptimizationNote())
            .build();

        // Education
        if (r.getEducation() != null) {
            n.setEducation(NormalizedResume.NEducationEntry.builder()
                .degree(r.getEducation().getDegree())
                .institution(r.getEducation().getInstitution())
                .year(r.getEducation().getYear())
                .cgpa(r.getEducation().getCgpa())
                .relevantCoursework(r.getEducation().getRelevantCoursework())
                .build());
        }

        // Skills
        if (r.getSkills() != null) {
            n.setSkills(r.getSkills().stream().map(rs ->
                NormalizedResume.NSkillCategory.builder()
                    .label(rs.getLabel())
                    .value(rs.getValue())
                    .priority(0)
                    .jdRelevant(false)
                    .build()
            ).collect(Collectors.toList()));
        }

        // Experience
        if (r.getExperience() != null) {
            n.setExperience(r.getExperience().stream().map(re ->
                NormalizedResume.NExperienceEntry.builder()
                    .company(re.getCompany())
                    .role(re.getRole())
                    .duration(re.getDuration())
                    .location(re.getLocation())
                    .bullets(re.getBullets())
                    .isVerified(true)
                    .build()
            ).collect(Collectors.toList()));
        }

        // Projects
        if (r.getProjects() != null) {
            n.setProjects(r.getProjects().stream().map(rp ->
                NormalizedResume.NProjectEntry.builder()
                    .title(rp.getTitle())
                    .techStack(rp.getTechStack())
                    .duration(rp.getDuration())
                    .githubLink(rp.getGithubLink())
                    .bullets(rp.getBullets())
                    .hasMetrics(false)
                    .build()
            ).collect(Collectors.toList()));
        }

        return n;
    }
}
