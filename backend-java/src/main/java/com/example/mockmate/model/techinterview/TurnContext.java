package com.example.mockmate.model.techinterview;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
public class TurnContext {

    private InterviewPlanSummary interviewPlan;
    private CurrentRoundInfo currentRound;
    private CandidatePerformanceSummary candidatePerformance;
    private DSAContextInfo currentDSA;
    private List<ExchangeHistory> lastExchanges;
    private String candidateAnswer;
    private int timeRemainingMinutes;
    private String interviewState;
    // Previously only used once at plan-generation time to build the round
    // topic labels, then never seen again — every per-turn question/follow-up
    // was generated with zero visibility into the actual resume/JD content,
    // which is why questions felt generic and repetitive instead of grounded
    // in the candidate's real projects/technologies and the job requirements.
    private CandidateProfile candidateProfile;
    private String resumeExcerpt;
    private String jdExcerpt;

    // ── Nested: Plan Summary ──────────────────────────────────
    @Data
    @NoArgsConstructor
    public static class InterviewPlanSummary {
        private String roleLevel;
        private String interviewType;
        private String companyStyle;
        private int totalMinutes;
        private List<String> roundNames;
        private String companyStyleGuidance;
        private List<String> dealBreakers;
    }

    // ── Nested: Current Round ─────────────────────────────────
    @Data
    @NoArgsConstructor
    public static class CurrentRoundInfo {
        private String roundType;
        private String roundName;
        private int allocatedMinutes;
        private int elapsedMinutes;
        private int questionsAsked;
        private List<String> topicsCovered;
        private List<String> topicsRemaining;
        private List<String> focusAreas;
        private List<String> mustCoverPoints;
        private boolean escalationEnabled;
    }

    // ── Nested: Candidate Performance Summary ─────────────────
    @Data
    @NoArgsConstructor
    public static class CandidatePerformanceSummary {
        private String overallTrend;
        private List<Map<String, Object>> lastThreeAnswers;
        private int runningAverageScore;
        private List<String> weaknesses;
        private List<String> strengths;
    }

    // ── Nested: DSA Context ───────────────────────────────────
    @Data
    @NoArgsConstructor
    public static class DSAContextInfo {
        private String problemId;
        private String problemTitle;
        private String difficulty;
        private String testCasesPassed;  // e.g. "3/5 passed"
        private int hintsGiven;
        private int timeSpentMinutes;
        private String currentCode;
        private boolean allTestsPassed;
    }

    // ── Nested: Exchange History ──────────────────────────────
    @Data
    @NoArgsConstructor
    public static class ExchangeHistory {
        private String question;
        private String answer;
        private int score;
        private String quality;
        private String topic;
    }
}
