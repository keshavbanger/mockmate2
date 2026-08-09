package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

/**
 * Holds per-field confidence scores for a parsed resume.
 * LOW confidence (< 0.6) → field shown in the "missing fields" modal.
 * MEDIUM (0.6–0.85)       → shown but pre-filled.
 * HIGH (> 0.85)           → silently accepted.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ResumeFieldConfidence {

    /** Overall confidence 0.0–1.0 */
    private double overallConfidence;

    /** Per-field scores: fieldName → 0.0–1.0 */
    private Map<String, Double> fieldScores;

    /** Fields the user must fill before generation (score < LOW_THRESHOLD) */
    private List<MissingField> missingFields;

    /** Fields we auto-populated but the user may want to review */
    private List<String> uncertainFields;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class MissingField {
        private String fieldKey;        // e.g. "email", "phone", "jobTitle"
        private String label;           // Human-readable label for the modal
        private String placeholder;     // Hint text in the input
        private String section;         // "contact" | "education" | "summary"
        private boolean required;       // If true, blocks generation until filled
    }

    // Thresholds
    public static final double LOW_THRESHOLD    = 0.55;
    public static final double MEDIUM_THRESHOLD = 0.80;
}
