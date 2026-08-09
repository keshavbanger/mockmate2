package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * The "verified structured record" the resume-writer prompt expects as
 * input — everything on this object has already been confirmed by the
 * candidate through the Fill Gaps Wizard. The writer LLM is told, and this
 * object's shape enforces, that it does not parse, score, or critique — it
 * only writes from what's already been verified here.
 * <p>
 * Distinguishing this from {@link ResumeData} on purpose: ResumeData is raw
 * parser output (may be wrong, incomplete, or contain a section-header
 * string where a name should be). VerifiedResumeInput is what's left after
 * a human confirmed it — the gate (see {@code ResumeGenerationGateService})
 * is exactly the boundary between the two.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerifiedResumeInput {

    // ── Contact ──────────────────────────────────────────────────────────
    private String name;
    private String targetJobTitle;
    private String email;
    private String phone;
    private String location;
    private String linkedinUrl;
    private String githubUrl;

    // ── Education ────────────────────────────────────────────────────────
    private String degree;
    private String specialization;
    private String institution;
    private String graduationMonthYear;
    private Integer graduationEndYear; // parsed/confirmed numeric year, for the eligibility gate
    private boolean includeCgpa;
    private String cgpaValue; // null when includeCgpa is false
    private List<String> coursework;

    // ── Skills ───────────────────────────────────────────────────────────
    // The whitelist: only what the candidate explicitly confirmed. A
    // suggested skill the user did not confirm must not appear here — the
    // validator (Part 3) rejects any generated skill not in this set.
    private List<String> confirmedSkills;

    // ── Experience / Projects ────────────────────────────────────────────
    private List<VerifiedEntry> experience;
    private List<VerifiedEntry> projects;

    // ── Pass-through lists (writer may reformat wording, not invent items) ─
    private List<String> achievements;
    private List<String> certifications;
    private List<String> leadership;

    // ── Placeholder resolution ──────────────────────────────────────────
    // Keyed by "project:{idx}:{bulletIdx}" / "experience:{idx}:{bulletIdx}".
    // A present-but-blank value means the user chose to leave it blank —
    // the writer must REMOVE that clause entirely, not fill it with a
    // placeholder or an invented number.
    private Map<String, String> placeholderResolutions;

    private boolean includePersonalDetails; // default false — see Fill Gaps wizard

    private String jdText;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VerifiedEntry {
        private String title;      // project title, or role for experience
        private String org;        // company, or empty for personal projects
        private String techStack;  // comma-separated, projects only
        private String duration;
        private String url;
        private List<String> bullets;
    }
}
