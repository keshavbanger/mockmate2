package com.example.mockmate.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReconstructedResume {
    private String name;
    private String jobTitle;
    private String phone;
    private String email;
    private String location;
    private String github;
    private String linkedin;
    private String professionalSummary;
    private List<SkillCategory>    skills;
    private List<ExperienceEntry>  experience;
    private List<ProjectEntry>     projects;
    private List<String>           achievements;
    private List<String>           certifications;
    private List<String>           leadership;
    private EducationEntry         education;
    private String                 atsOptimizationNote;
    private String                 templateId;
    private boolean                improvementsApplied;

    // ── Metadata fields (populated by enforcement pipeline) ──
    private List<String>           addedKeywords;
    private List<String>           rewrittenBullets;
    private int                    atsScore;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SkillCategory {
        private String label;
        private String value;
        private int    priority;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ExperienceEntry {
        private String       company;
        private String       role;
        private String       duration;
        private String       location;
        private List<String> bullets;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ProjectEntry {
        private String       title;
        private String       techStack;
        private String       duration;
        private String       githubLink;
        private List<String> bullets;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class EducationEntry {
        private String       degree;
        private String       institution;
        private String       year;
        private String       cgpa;
        private List<String> relevantCoursework;
    }
}
