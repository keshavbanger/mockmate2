package com.example.mockmate.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Output of the resume-writer prompt (Part 2 of the Prompt Pack). Deserialized
 * with a snake_case-aware ObjectMapper (see {@code ResumeWriterService}), so
 * these are plain camelCase fields — JSON {@code target_title} maps straight
 * onto {@code targetTitle}, no per-field {@code @JsonProperty} needed.
 * <p>
 * This is a deliberately separate model from {@link NormalizedResume} — see
 * {@link GeneratedResumeMapper} for the conversion. Keeping them separate
 * means the writer's output shape can be validated (Part 3) against exactly
 * what the prompt promises, before it's converted into whatever shape the
 * existing renderers expect.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class GeneratedResume {

    private Contact contact;
    private String summary;
    private List<EducationItem> education;
    private List<SkillGroup> skills;
    private List<ProjectItem> projects;
    private List<ExperienceItem> experience;
    private List<CertificationItem> certifications;
    private List<String> achievements;
    private List<String> leadership;
    private List<String> omittedFields;
    private List<UnresolvedPlaceholder> unresolvedPlaceholders;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Contact {
        private String name;
        private String targetTitle;
        private String email;
        private String phone;
        private String location;
        private String linkedinUrl;
        private String githubUrl;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EducationItem {
        private String degree;
        private String specialization;
        private String institution;
        private String affiliation;
        private String startYear;
        private String endYear;
        private String score;
        private List<String> coursework;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SkillGroup {
        private String category;
        private List<String> items;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ProjectItem {
        private String title;
        private List<String> tech;
        private String duration;
        private String url;
        private List<Bullet> bullets;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ExperienceItem {
        private String org;
        private String title;
        private String start;
        private String end;
        private List<String> bullets;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CertificationItem {
        private String name;
        private String issuer;
        private String year;
        private String detail;
    }

    // Weaker fallback models occasionally flatten this to a plain JSON string
    // instead of the {text, has_placeholder} object the prompt specifies —
    // the @JsonCreator factory below tolerates that instead of failing the
    // whole generation when the primary model is unavailable.
    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Bullet {
        private String text;
        private boolean hasPlaceholder;

        // Mode must be explicit: with parameter-name introspection on the
        // classpath (AppConfig's objectMapper.findAndRegisterModules()),
        // Jackson otherwise treats a single named parameter as a
        // properties-mode creator (expects {"text": ...}) instead of a
        // delegating one (expects a bare JSON string) — silently defeating
        // this whole fallback.
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        public static Bullet fromText(String text) {
            boolean placeholder = text != null && text.matches(".*\\[[^\\]]+\\].*");
            return new Bullet(text, placeholder);
        }
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UnresolvedPlaceholder {
        private String bullet;
        private String token;
    }
}
