package com.example.mockmate.model;

import lombok.Getter;

import java.util.List;

/**
 * Thrown by {@code ResumeGenerationGateService} when generation is blocked —
 * not caveated — because a required field is missing or unreliable. The
 * controller catches this and routes the candidate to the Fill Gaps Wizard
 * instead of letting the writer LLM guess.
 */
@Getter
public class NeedsUserInputException extends RuntimeException {

    private final List<String> fields;

    public NeedsUserInputException(List<String> fields) {
        super("Generation blocked — required fields need user input: " + fields);
        this.fields = fields;
    }
}
