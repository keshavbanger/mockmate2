package com.example.mockmate.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * NormalizedResume — the single canonical model for all resume renderers.
 * <p>
 * This is the SINGLE SOURCE OF TRUTH consumed by every renderer (DOCX, HTML, LaTeX).
 * It is produced by the Content Layer (Groq AI), validated by the Enforcement Layer,
 * and persisted to disk at: {@code resumes/{resumeId}/normalized.json}
 * <p>
 * Switching templates loads this from disk → re-renders → zero AI calls.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class NormalizedResume {

    // ── Identity ────────────────────────────────────────────────────────────
    private String resumeId;
    private String userId;
    private String sourceReportId;
    private LocalDateTime generatedAt;
    private String templateId;
    private boolean aiEnhanced;

    // ── Contact ─────────────────────────────────────────────────────────────
    private String name;
    private String jobTitle;
    private String phone;
    private String email;
    private String location;
    private String github;
    private String linkedin;

    // ── Content Sections ────────────────────────────────────────────────────
    private String professionalSummary;
    private List<NSkillCategory>    skills;
    private List<NExperienceEntry>  experience;
    private List<NProjectEntry>     projects;
    private List<String>            achievements;
    private List<String>            certifications;
    private List<String>            leadership;
    private NEducationEntry         education;

    // ── ATS Metadata (used by enforcement layer) ────────────────────────────
    private List<String> addedKeywords;
    private List<String> rewrittenBullets;
    private int          atsScore;
    private String       atsOptimizationNote;
    private boolean      validationPassed;

    // ── Legacy compat (maps to old ReconstructedResume field) ────────────────
    @Builder.Default
    private boolean improvementsApplied = false;

    // ── Inner Models ────────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NSkillCategory {
        private String  label;
        private String  value;
        private int     priority;       // 1 = most relevant to JD
        private boolean jdRelevant;     // true if JD mentioned this
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NExperienceEntry {
        private String       company;
        private String       role;
        private String       duration;
        private String       location;
        private List<String> bullets;
        private boolean      isVerified; // true if dates + role present
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NProjectEntry {
        private String       title;
        private String       techStack;
        private String       duration;
        private String       githubLink;
        private String       liveUrl;
        private List<String> bullets;
        private boolean      hasMetrics;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NEducationEntry {
        private String       degree;
        private String       institution;
        private String       year;
        private String       cgpa;
        private List<String> relevantCoursework;
    }
}
