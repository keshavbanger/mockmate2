package com.example.mockmate.model.techinterview;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TechInterviewSession {

    private String sessionId;
    private String userId;
    private String planId;
    private InterviewPlan plan;

    // ── State Machine ──────────────────────────────────────────
    private int currentRoundIndex;
    private InterviewState interviewState;
    private long startedAt;
    private long lastActivityAt;
    private int totalElapsedMinutes;
    private boolean ended;

    public String getCurrentRoundId() {
        if (plan != null && plan.getInterviewPlan() != null && plan.getInterviewPlan().getRounds() != null && !plan.getInterviewPlan().getRounds().isEmpty()) {
            int idx = Math.min(currentRoundIndex, plan.getInterviewPlan().getRounds().size() - 1);
            if (idx >= 0) {
                return plan.getInterviewPlan().getRounds().get(idx).getRoundId();
            }
        }
        return "round_1";
    }

    public void setCurrentRoundId(String roundId) {
        if (plan != null && plan.getInterviewPlan() != null && plan.getInterviewPlan().getRounds() != null) {
            var rounds = plan.getInterviewPlan().getRounds();
            for (int i = 0; i < rounds.size(); i++) {
                if (rounds.get(i).getRoundId() != null && rounds.get(i).getRoundId().equalsIgnoreCase(roundId)) {
                    this.currentRoundIndex = i;
                    break;
                }
            }
        }
    }

    // ── Per-Round Tracking ────────────────────────────────────
    private List<RoundState> roundStates;

    // ── Candidate Performance Tracking ────────────────────────
    private CandidatePerformance candidatePerformance;

    // ── Turn History ──────────────────────────────────────────
    private List<InterviewTurn> turns;

    // ── DSA Tracking ──────────────────────────────────────────
    private Map<String, DSAAttempt> dsaAttempts; // problemId → attempt
    // Tracks whichever DSA problem the candidate currently has open, so a
    // GIVE_HINT turn (which happens over chat, not a code submission) knows
    // which attempt's hintsUsed counter to bump. Set whenever the AI opens
    // the code editor for a specific problem.
    private String activeDsaProblemId;

    // ── SQL Tracking ──────────────────────────────────────────
    private List<SQLAttempt> sqlAttempts;

    // ── Whiteboard ────────────────────────────────────────────
    private String whiteboardSnapshot; // base64 encoded

    public enum InterviewState {
        ON_TRACK, RUNNING_BEHIND, AHEAD_OF_SCHEDULE, ENDED
    }

    // ── Nested: Round State ───────────────────────────────────
    @Data
    @NoArgsConstructor
    public static class RoundState {
        private String roundId;
        private boolean started;
        private boolean completed;
        private long startedAt; // epoch seconds — set the first time this round is entered
        private int elapsedMinutes;
        private int questionsAsked;
        private List<String> topicsCovered;
        private int score; // 0-100
        private String summary;
    }

    // ── Nested: Candidate Performance ─────────────────────────
    @Data
    @NoArgsConstructor
    public static class CandidatePerformance {
        private String overallTrend; // IMPROVING | DECLINING | CONSISTENT
        private List<AnswerQuality> lastThreeAnswers;
        private int runningAverageScore;
        private List<String> weaknesses;
        private List<String> strengths;

        @Data
        @NoArgsConstructor
        public static class AnswerQuality {
            private String quality; // STRONG | ADEQUATE | WEAK | NO_ANSWER
            private int score;
            private String topic;
        }
    }

    // ── Nested: Interview Turn ────────────────────────────────
    @Data
    @NoArgsConstructor
    public static class InterviewTurn {
        private int turnId;
        private String roundId;
        private long timestamp;
        private String question;
        private String candidateAnswer;
        private String aiResponse;
        private String action;
        private int score;
        private String quality;
        private String topicAssessed;
        private List<String> correctPoints;
        private List<String> missedPoints;
        private List<String> misconceptions;
        private String internalNote;
    }

    // ── Nested: DSA Attempt ───────────────────────────────────
    @Data
    @NoArgsConstructor
    public static class DSAAttempt {
        private String problemId;
        private String finalCode;
        private String language;
        private int hintsUsed;
        private int timeSpentMinutes;
        private int testCasesPassed;
        private int totalTestCases;
        private boolean allPassed;
        private String approachQuality; // OPTIMAL | BRUTE_FORCE | WRONG
        private String timeComplexityAnswer;
        private String spaceComplexityAnswer;
        private boolean complexityCorrect;
        private List<String> followUpAnswers;
        private int score; // 0-100
        private List<String> missedPoints;
    }

    // ── Nested: SQL Attempt ───────────────────────────────────
    @Data
    @NoArgsConstructor
    public static class SQLAttempt {
        private String problemId;
        private String finalQuery;
        @JsonProperty("isCorrect")
        private boolean isCorrect;
        private int score;
        private String optimizationAnswer;
    }
}
