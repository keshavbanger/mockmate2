package com.example.mockmate.aiengine;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Structured output of the combined evaluate+strategize LLM call — see
 * InterviewEngineService.evaluateAndStrategize(). Internal interview-control
 * signal only; never shown to the candidate (spec §11/§39).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnswerEvaluation {
    private String answerQuality;       // STRONG | MEDIUM | WEAK | NOT_ANSWERED
    private String relevance;           // HIGH | MEDIUM | LOW
    private String depth;               // HIGH | MEDIUM | LOW
    private String technicalCorrectness;// HIGH | MEDIUM | LOW
    private String specificity;         // HIGH | MEDIUM | LOW
    private List<String> missingInformation;
    // A new area the candidate's answer surfaced (e.g. mentioned
    // "concurrency" while answering a project question) — null if none.
    private String newAreaDiscovered;
    private String recommendedAction;   // FOLLOW_UP | MOVE_TO_NEW_AREA | DEEPER_NEW_AREA | END
    private String reason;
}
