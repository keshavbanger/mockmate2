package com.example.mockmate.model.techinterview;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AIInterviewerResponse {

    private String responseText;    // What AI says — 2-4 sentences max
    private String action;          // FOLLOW_UP | NEXT_QUESTION | GIVE_HINT | CHANGE_TOPIC | NEXT_ROUND | OPEN_CODE_EDITOR | OPEN_SQL_EDITOR | OPEN_WHITEBOARD | CLOSE_EDITOR | END_INTERVIEW
    private String nextQuestion;
    private String topicBeingAssessed;
    private boolean systemError;    // True if exception occurred, rendered as system warning banner NOT AI dialogue
    private String errorMessage;    // Detailed system error message
    private EditorConfig editorConfig;
    private AnswerEvaluation currentAnswerEvaluation;
    private RoundProgress roundProgress;
    private Adaptations adaptations;

    // ── Nested: Editor Config ─────────────────────────────────
    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EditorConfig {
        private String type;        // CODE | SQL | WHITEBOARD
        private String problemId;
        private String language;
        private boolean loadProblem;
        private String roundType;   // for whiteboard template selection
    }

    // ── Nested: Answer Evaluation ─────────────────────────────
    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AnswerEvaluation {
        private int score;          // 0-100
        private String quality;     // STRONG | ADEQUATE | WEAK | NO_ANSWER
        private String topicAssessed;
        private List<String> correctPoints;
        private List<String> missedPoints;
        private List<String> misconceptions;
        private boolean shouldFollowUp;
        private String internalNote;
    }

    // ── Nested: Round Progress ────────────────────────────────
    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RoundProgress {
        private boolean shouldContinueRound;
        private int roundCompletionPercent;
        private String reasonToEndRound;
    }

    // ── Nested: Adaptations ───────────────────────────────────
    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Adaptations {
        private String difficultyAdjustment; // INCREASE | DECREASE | MAINTAIN
        private boolean skipNextTopic;
        private String reason;
    }
}
