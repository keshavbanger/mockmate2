package com.example.mockmate.model;

import lombok.Getter;

import java.util.List;

/**
 * Thrown by {@code ResumeGenerationValidator} when generated resume content
 * violates any post-validation rule (banned language, PII, invented
 * numbers, unconfirmed skills, scaffolding leaks, sentence fragments, print
 * artifacts). This fails CLOSED — the caller must not render or download
 * the offending document, only surface the violations and let the writer
 * retry or the user intervene.
 */
@Getter
public class ResumeValidationException extends RuntimeException {

    private final List<String> violations;

    public ResumeValidationException(List<String> violations) {
        super("Generated resume failed post-validation: " + violations);
        this.violations = violations;
    }
}
