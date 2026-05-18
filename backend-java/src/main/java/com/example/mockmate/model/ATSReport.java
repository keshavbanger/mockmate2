package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ATSReport {

    @Builder.Default
    private String reportId = UUID.randomUUID().toString();

    private String userId;

    @Builder.Default
    private String timestamp = Instant.now().toString();

    // ── Final weighted score ──
    private int finalScore;
    private String verdict;
    private String verdictReason;

    // ── Keyword analysis ──
    private List<String> matchedKeywords;
    private List<String> missingKeywords;

    // ── Section health ──
    private Map<String, String> sectionFeedback;  // key → "present"|"weak"|"missing"

    // ── Formatting ──
    private List<String> formattingRisks;

    // ── Bullet rewrites ──
    private List<BulletRewrite> bulletRewrites;

    // ── Strength lines ──
    private List<String> strengthLines;

    // ── Sub-scores (all 0-100) ──
    private int keywordOverlapScore;
    private int semanticScore;
    private int roleAlignmentScore;
    private int sectionScore;
    private int formattingScore;
    private int quantificationScore;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BulletRewrite {
        private String original;
        private String rewritten;
        private String reason;
    }
}
