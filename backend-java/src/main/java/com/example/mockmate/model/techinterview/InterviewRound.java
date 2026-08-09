package com.example.mockmate.model.techinterview;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class InterviewRound {

    private String roundId;
    private String roundName;
    private RoundType roundType;
    private int allocatedMinutes;
    private List<String> topics;
    private int questionCount;
    private Difficulty difficulty;
    private ToolRequired toolRequired;
    private String language;
    private List<String> focusAreas;
    private List<DSAProblemRef> dsaProblems;   // only for DSA rounds
    private String sqlProblemId;               // only for SQL rounds
    private String lldProblemId;               // only for LLD rounds
    private String hldProblemId;               // only for HLD rounds
    private List<String> mustCoverPoints;
    private boolean skipIfCandidateWeak;
    private boolean escalationEnabled;

    // ── Runtime state (not from Groq) ─────────────────────────
    private int elapsedMinutes;
    private int questionsAsked;
    private List<String> topicsCovered;
    private int currentDsaIndex;  // which DSA problem we're on
    private boolean completed;
    private int roundScore;

    // ── Enums ─────────────────────────────────────────────────
    public enum RoundType {
        INTRO, TECHNICAL_THEORY, DSA, SQL, SYSTEM_DESIGN,
        LLD, DATABASE_DESIGN, DEBUGGING, BEHAVIORAL,
        PROJECT_DEEP_DIVE, WRAP_UP
    }

    public enum Difficulty {
        EASY, MEDIUM, HARD, MIXED
    }

    public enum ToolRequired {
        CODE_EDITOR, SQL_EDITOR, WHITEBOARD, NONE
    }

    // ── Nested: DSA Problem Reference ─────────────────────────
    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DSAProblemRef {
        private int leetcodeId;
        private String title;
        private String difficulty;
        private String topic;
        private String url;
        private String whySelected;
        private String problemId; // resolved local ID e.g. "lc-001"
    }
}
