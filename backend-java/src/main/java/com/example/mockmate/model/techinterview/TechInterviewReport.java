package com.example.mockmate.model.techinterview;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
public class TechInterviewReport {

    private String reportId;
    private String sessionId;
    private String userId;
    private long generatedAt;
    private long interviewDurationMinutes;

    // ── Meta ──────────────────────────────────────────────────
    private String roleLevel;
    private String interviewType;
    private String companyStyle;
    private String preferredLanguage;

    // ── Overall Results ───────────────────────────────────────
    private int overallScore;           // 0-100
    private HiringDecision hiringDecision;
    private String hiringDecisionLabel; // "STRONG HIRE", "HIRE", etc.
    private String hiringDecisionReason;
    private boolean dealBreakerTriggered;
    private String dealBreakerReason;

    // ── Score Breakdown ───────────────────────────────────────
    private Map<String, Integer> scoreByCategory; // "DSA" → 75
    private Map<String, Integer> categoryWeights;

    // ── Radar Chart Data ──────────────────────────────────────
    private RadarData radarData;

    // ── Round Summaries ───────────────────────────────────────
    private List<RoundSummary> roundSummaries;

    // ── DSA Detailed Review ───────────────────────────────────
    private List<DSAReview> dsaReviews;

    // ── SQL Review ────────────────────────────────────────────
    private List<SQLReview> sqlReviews;

    // ── Full Transcript ───────────────────────────────────────
    private List<TechInterviewSession.InterviewTurn> fullTranscript;

    // ── Strengths & Weaknesses ────────────────────────────────
    private List<StrengthItem> topStrengths;
    private List<WeaknessItem> topWeaknesses;

    // ── Study Plan ────────────────────────────────────────────
    private StudyPlan studyPlan;

    // ── Company Readiness ─────────────────────────────────────
    private List<CompanyReadiness> companyReadiness;

    // ── Next Interview Recommendation ─────────────────────────
    private String retakeInWeeks;
    private List<String> focusBeforeRetake;

    // ── Candidate Profile ─────────────────────────────────────
    private CandidateProfile candidateProfile;

    // ── Enums ─────────────────────────────────────────────────
    public enum HiringDecision {
        STRONG_HIRE, HIRE, BORDERLINE, NO_HIRE, STRONG_NO_HIRE
    }

    // ── Nested classes ─────────────────────────────────────────

    @Data @NoArgsConstructor
    public static class RadarData {
        private int dsaScore;
        private int csTheoryScore;
        private int sqlScore;
        private int systemDesignScore;
        private int communicationScore;
        private int projectKnowledgeScore;
    }

    @Data @NoArgsConstructor
    public static class RoundSummary {
        private String roundId;
        private String roundName;
        private String roundType;
        private int score;
        private int elapsedMinutes;
        private String summary;
        private List<String> keyMoments;
        private String strengthsInRound;
        private String weaknessesInRound;
    }

    @Data @NoArgsConstructor
    public static class DSAReview {
        private String problemId;
        private String problemTitle;
        private String leetcodeUrl;
        private String difficulty;
        private int leetcodeId;
        private String candidateCode;
        private String language;
        private int testCasesPassed;
        private int totalTestCases;
        private boolean allPassed;
        private String approachQuality;
        private String timeComplexityAnswer;
        private String spaceComplexityAnswer;
        private boolean complexityCorrect;
        private int hintsUsed;
        private int timeSpentMinutes;
        private int score;
        private List<String> whatMissed;
        private String optimalApproach;
        private String optimalTimeComplexity;
        private String optimalSpaceComplexity;
        private Map<String, String> modelSolution; // language → code
    }

    @Data @NoArgsConstructor
    public static class SQLReview {
        private String problemId;
        private String question;
        private String candidateQuery;
        private String correctQuery;
        @JsonProperty("isCorrect")
        private boolean isCorrect;
        private int score;
        private String feedback;
    }

    @Data @NoArgsConstructor
    public static class StrengthItem {
        private String strength;
        private String evidence;  // specific turn transcript excerpt
        private String roundName;
    }

    @Data @NoArgsConstructor
    public static class WeaknessItem {
        private String weakness;
        private String evidence;
        private String fix;       // specific action to improve
        private String resources; // links or book recommendations
    }

    @Data @NoArgsConstructor
    public static class StudyPlan {
        private String week1;
        private String week2;
        private String week3;
        private String week4;
        private List<String> leetcodeListsToComplete;
        private List<String> topicsToRevise;
        private List<String> projectsToBuild;
        private List<String> resourceLinks;
    }

    @Data @NoArgsConstructor
    public static class CompanyReadiness {
        private String company;
        private int readinessPercent;
        private String assessment;
        private List<String> gapsToFill;
    }
}
