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

    private String resumeFileName;
    private String originalText;

    // ── Final weighted score ──
    private int    finalScore;
    private String verdict;
    private String verdictReason;

    // ── AI-generated content ──
    private String tailoredSummary;

    // ── Keyword analysis ──
    private List<String>          matchedKeywords;
    private List<String>          missingKeywords;
    private Map<String, Double>   weightedMatchedKeywords;
    private Map<String, Double>   weightedMissingKeywords;

    // ── Section health ──
    private Map<String, String> sectionFeedback;  // key → "present"|"weak"|"missing"

    // ── Formatting ──
    private List<String> formattingRisks;

    // ── Bullet rewrites ──
    private List<BulletRewrite> bulletRewrites;

    // ── Strength lines ──
    private List<String> strengthLines;

    // ── Skill depth map ──
    private Map<String, Integer> skillDepthMap;  // skill → 1(basic)|2(intermediate)|3(expert)

    // ── Role level gap ──
    private RoleLevelGap roleLevelGap;

    // ── Quantification suggestions ──
    private List<QuantSuggestion> quantificationSuggestions;

    // ── Sub-scores (all 0-100) ──
    private int keywordOverlapScore;
    private int semanticScore;
    private int roleAlignmentScore;
    private int sectionScore;
    private int formattingScore;
    private int quantificationScore;

    // ── Flags ──
    @Builder.Default
    private boolean aiAnalysisAvailable = true;

    // ── Nested classes ──

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BulletRewrite {
        private String original;
        private String rewritten;
        private String reason;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoleLevelGap {
        private String       detectedLevel; // Junior|Mid|Senior
        private String       requiredLevel; // Junior|Mid|Senior
        private List<String> gaps;          // empty list if none
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuantSuggestion {
        private String original;
        private String suggestion;
    }
}
