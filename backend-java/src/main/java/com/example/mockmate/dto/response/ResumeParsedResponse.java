package com.example.mockmate.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Result of AI-based resume parsing (see ResumeParserService).
 *
 * The flat fields (name, email, skills, jobTitles, companies, education,
 * totalExperienceYears, summary) are load-bearing for the mock-interview
 * question-generation flow (QuestionGeneratorService, InterviewController,
 * QuestionController, ResumeController) — do not rename or retype them.
 *
 * The nested fields below were added for the Resume Builder's "Import PDF/
 * DOCX" flow, which needs the full resume structure (bulleted experience,
 * dated education, projects, categorized skills, certifications,
 * achievements), not just the flat summary fields. Previously the Resume
 * Builder reused this same narrow DTO and silently dropped everything except
 * name/email/skills/summary/first-job-title on import — this is what fixes
 * that without touching the interview flow's existing contract.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResumeParsedResponse {
    private String name;
    private String email;
    private List<String> skills;
    private double totalExperienceYears;
    private List<String> jobTitles;
    private List<String> companies;
    private List<String> education;
    private String summary;

    // ── Added for the Resume Builder import flow ──
    private String professionalTitle;
    private String phone;
    private String location;
    private String linkedin;
    private String github;
    private String portfolio;

    private List<Experience> experience;
    private List<EducationEntry> educationDetails;
    private List<Project> projects;
    private List<SkillEntry> skillDetails;
    private List<Certification> certifications;
    private List<Achievement> achievements;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Experience {
        private String jobTitle;
        private String company;
        private String location;
        private String startDate;
        private String endDate;
        // Lombok's getter for a "isX" boolean field is isCurrent() — Jackson's
        // default naming strips the "is" prefix from boolean getters, so
        // without this annotation the JSON key would come out as "current",
        // silently mismatching the frontend's isCurrent field.
        @JsonProperty("isCurrent")
        private boolean isCurrent;
        private List<String> bullets;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EducationEntry {
        private String institution;
        private String degree;
        private String fieldOfStudy;
        private String location;
        private String startDate;
        private String endDate;
        private String gpa;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Project {
        private String name;
        private String description;
        private String technologies;
        private List<String> bullets;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SkillEntry {
        private String skill;
        private String category;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Certification {
        private String name;
        private String issuingOrganization;
        private String issueDate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Achievement {
        private String title;
        private String description;
        private String date;
    }
}
