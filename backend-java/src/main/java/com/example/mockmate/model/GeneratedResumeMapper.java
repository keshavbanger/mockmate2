package com.example.mockmate.model;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Maps a {@link GeneratedResume} (the resume-writer's own output shape) into
 * a {@link NormalizedResume}, so it can flow through the existing renderers
 * (HTML/DOCX/LaTeX) unchanged rather than requiring three more renderer
 * rewrites. The renderers already run {@link ResumeContentNormalizer} in
 * {@code ATSEnforcementService}, but a writer-generated resume skips that
 * enforcement pass entirely (there's nothing to "restore" — the writer never
 * drops content in the first place), so this mapper alone is what the
 * renderers see for AI-generated resumes.
 */
public final class GeneratedResumeMapper {

    private GeneratedResumeMapper() {}

    public static NormalizedResume toNormalized(GeneratedResume g) {
        if (g == null) return null;

        NormalizedResume.NormalizedResumeBuilder builder = NormalizedResume.builder();

        if (g.getContact() != null) {
            var c = g.getContact();
            builder.name(c.getName())
                   .jobTitle(c.getTargetTitle())
                   .email(c.getEmail())
                   .phone(c.getPhone())
                   .location(c.getLocation())
                   .linkedin(c.getLinkedinUrl())
                   .github(c.getGithubUrl());
        }

        builder.professionalSummary(g.getSummary());

        if (g.getEducation() != null && !g.getEducation().isEmpty()) {
            var e = g.getEducation().get(0); // primary/most-recent — display shows one entry
            String degree = joinNonBlank(", ", e.getDegree(), e.getSpecialization());
            String institution = e.getAffiliation() != null && !e.getAffiliation().isBlank()
                    ? joinNonBlank(" ", e.getInstitution(), "(" + e.getAffiliation() + ")")
                    : e.getInstitution();
            String year = joinNonBlank(" – ", e.getStartYear(), e.getEndYear());
            builder.education(NormalizedResume.NEducationEntry.builder()
                    .degree(degree)
                    .institution(institution)
                    .year(year)
                    .cgpa(e.getScore())
                    .relevantCoursework(e.getCoursework())
                    .build());
        }

        if (g.getSkills() != null) {
            builder.skills(g.getSkills().stream()
                    .filter(s -> s.getItems() != null && !s.getItems().isEmpty())
                    .map(s -> NormalizedResume.NSkillCategory.builder()
                            .label(s.getCategory())
                            .value(String.join(", ", s.getItems()))
                            .priority(0)
                            .jdRelevant(false)
                            .build())
                    .collect(Collectors.toList()));
        }

        if (g.getProjects() != null) {
            builder.projects(g.getProjects().stream().map(p -> {
                List<String> bulletTexts = p.getBullets() != null
                        ? p.getBullets().stream().map(GeneratedResume.Bullet::getText).collect(Collectors.toList())
                        : List.of();
                boolean isGithub = p.getUrl() != null && p.getUrl().toLowerCase().contains("github.com");
                return NormalizedResume.NProjectEntry.builder()
                        .title(p.getTitle())
                        .techStack(p.getTech() != null ? String.join(", ", p.getTech()) : null)
                        .duration(p.getDuration())
                        .githubLink(isGithub ? p.getUrl() : null)
                        .liveUrl(!isGithub ? p.getUrl() : null)
                        .bullets(bulletTexts)
                        .hasMetrics(false)
                        .build();
            }).collect(Collectors.toList()));
        }

        if (g.getExperience() != null) {
            builder.experience(g.getExperience().stream().map(e ->
                    NormalizedResume.NExperienceEntry.builder()
                            .company(e.getOrg())
                            .role(e.getTitle())
                            .duration(joinNonBlank(" – ", e.getStart(), e.getEnd()))
                            .bullets(e.getBullets())
                            .isVerified(true)
                            .build()
            ).collect(Collectors.toList()));
        }

        if (g.getCertifications() != null) {
            List<String> certLines = new ArrayList<>();
            for (var cert : g.getCertifications()) {
                String line = joinNonBlank(" — ", cert.getName(),
                        joinNonBlank(", ", cert.getIssuer(), cert.getYear() != null ? "(" + cert.getYear() + ")" : null));
                if (line != null && !line.isBlank()) certLines.add(line);
                if (cert.getDetail() != null && !cert.getDetail().isBlank()) certLines.add(cert.getDetail());
            }
            builder.certifications(certLines);
        }

        builder.achievements(g.getAchievements());
        builder.leadership(g.getLeadership());
        builder.aiEnhanced(true);

        return builder.build();
    }

    private static String joinNonBlank(String sep, String... parts) {
        List<String> nonBlank = new ArrayList<>();
        for (String p : parts) {
            if (p != null && !p.isBlank()) nonBlank.add(p.trim());
        }
        return nonBlank.isEmpty() ? null : String.join(sep, nonBlank);
    }
}
