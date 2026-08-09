package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Transparent, per-component breakdown of the final ATS score so the UI can
 * show exactly where every point came from (and was lost) instead of a single
 * opaque number.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HonestScoreBreakdown {

    private ScoreComponent keywordRelevance;      // 0-20
    private ScoreComponent contentQuality;        // 0-25
    private ScoreComponent semanticMatch;         // 0-15
    private ScoreComponent sectionCompleteness;   // 0-15
    private ScoreComponent formattingStructure;   // 0-10
    private ScoreComponent quantification;        // 0-10
    private ScoreComponent credibility;           // 0-5

    private int totalPenalties;
    private List<PenaltyItem> penaltyBreakdown;

    private int baseScore;
    private int finalScore;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScoreComponent {
        private int score;
        private int maxScore;
        private String reason;
        private String fix;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PenaltyItem {
        private String item;
        private int deduction;
    }
}
