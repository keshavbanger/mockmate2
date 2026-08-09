package com.example.mockmate.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Structured output of the "JD is the only standard" resume-assessment
 * prompt. Deserialized with a snake_case-aware ObjectMapper (see
 * GroqATSService), so these are plain camelCase fields with no per-field
 * {@code @JsonProperty} needed — e.g. JSON {@code "jd_requirement_met"} maps
 * straight onto {@code jdRequirementMet}.
 * <p>
 * overallScore/band/fit/confidence are NOT part of the LLM's JSON — they are
 * computed by {@link com.example.mockmate.service.GroqATSService} from
 * dimensionScores via the weight table and band table, per the prompt's own
 * Rule 4 ("derive all labels from the score — do not form an independent
 * impression and then attach a number to it").
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class HonestResumeAssessment {

    private DimensionScores dimensionScores;
    private List<Blocker> blockers;
    private List<Strength> strengths;
    private List<Weakness> weaknesses;
    private Coverage coverage;
    private List<BulletRewriteV2> bulletRewrites;
    private String tailoredSummary;
    private List<ActionStep> actionPlan;
    private List<ParseWarning> parseWarnings;
    private String recruiterAssessment;

    // ── Computed in Java, not by the LLM ──
    private int overallScore;
    private String band;        // Excellent|Good|Borderline|Weak|Poor
    private String fit;         // Strong Fit|Good Fit|Borderline Fit|Weak Fit|Not a Fit
    private String confidence;  // High|Moderate|Low
    private String seniority;   // FRESHER|MID_SENIOR — which weight table was applied

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DimensionScores {
        private DimensionScore eligibility;
        private DimensionScore skillCoverage;
        private DimensionScore projectEvidence;
        private DimensionScore relevantExperience;
        private DimensionScore resumeCraft;
        private DimensionScore softSkills;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DimensionScore {
        private int score;
        private String reasoning;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Blocker {
        private String issue;
        private String severity; // blocking|high|medium
        private String evidence;
        private String fix;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Strength {
        private String point;
        private String evidenceFromResume;
        private String jdRequirementMet;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Weakness {
        private String point;
        private String jdRequirement;
        private String severity; // high|medium|low
        private String fix;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Coverage {
        private List<SatisfiedItem> satisfied;
        private List<UnsatisfiedItem> unsatisfied;
        private List<QuickWin> quickWins;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SatisfiedItem {
        private String jdRequirement;
        private String resumeEvidence;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UnsatisfiedItem {
        private String jdRequirement;
        private String importance; // required|preferred
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class QuickWin {
        private String skill;
        private String whyLikelyPresent;
        private String gain; // high|medium
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class BulletRewriteV2 {
        private String id;
        private String before;
        private String after;
        private boolean needsUserInput;
        private List<String> placeholders;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ActionStep {
        private String step;
        private String impact; // high|medium|low
        private String effort; // minutes|hours|weeks
        private int expectedGainPoints;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ParseWarning {
        private String field;
        private String observed;
        private String likelyCause;
        private String userAction;
    }
}
