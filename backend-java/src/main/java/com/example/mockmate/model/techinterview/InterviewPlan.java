package com.example.mockmate.model.techinterview;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class InterviewPlan {

    private String planId;
    private String userId;
    private CandidateProfile candidateProfile;
    private PlanDetails interviewPlan;
    private InterviewPlanConfig config;
    private long createdAt;

    // ── Raw Groq JSON (for debugging) ─────────────────────────
    private String rawGroqResponse;

    // ── Nested: Plan Details ───────────────────────────────────
    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PlanDetails {
        private int totalMinutes;
        private List<InterviewRound> rounds;
        private AdaptationRules adaptationRules;
        private String companyStyleGuidance;
        private EvaluationCriteria evaluationCriteria;
        private List<String> roundWeights; // e.g. {"DSA": 30, "TECHNICAL_THEORY": 25}
    }

    // ── Nested: Adaptation Rules ───────────────────────────────
    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AdaptationRules {
        private String ifCandidateExcels;
        private String ifCandidateStruggles;
        private List<String> minimumRoundsRequired;
        private int timeWarningAt;
    }

    // ── Nested: Evaluation Criteria ───────────────────────────
    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EvaluationCriteria {
        private List<String> primaryFactors;
        private List<String> dealBreakers;
    }
}
