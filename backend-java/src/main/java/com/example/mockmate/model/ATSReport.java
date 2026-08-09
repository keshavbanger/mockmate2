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

    /** One of: Exceptional | Strong | Decent | Below Average | Weak | Poor | Not Ready */
    private String scoreLabel;

    /** Detected CGPA (on a 10-point scale), null if not found in the resume */
    private Double cgpa;

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

    // ── Sub-scores (all 0–100) ──
    private int keywordOverlapScore;
    private int semanticScore;
    private int roleAlignmentScore;
    private int sectionScore;
    private int formattingScore;
    private int quantificationScore;

    // ── NEW: Additional deterministic sub-scores ──
    private int actionVerbScore;
    private int grammarScore;
    private int consistencyScore;
    private int contentQualityScore;

    // ── Flags ──
    @Builder.Default
    private boolean aiAnalysisAvailable = true;

    // ── Brutal Honesty Content ──
    private String executiveSummary;
    private List<FeedbackItem> contentFeedback;
    private List<FeedbackItem> formattingFeedback;
    private List<FeedbackItem> keywordFeedback;
    private List<String> criticalMissingItems;
    private List<String> genuineStrengths;
    private List<FakeMetric> fakeMetrics;
    private MarketReadiness marketReadiness;
    private List<PriorityFix> prioritizedFixList;

    // ── NEW: Enhanced Intelligence Fields ──
    private EnhancedExecutiveSummary enhancedSummary;
    private ATSParserPreview parserPreview;
    private List<ImprovementScenario> improvementScenarios;
    private List<CompanyFit> companyReadiness;
    private ConsistencyCheckResult consistencyCheck;
    private WritingAnalysis writingAnalysis;
    private RecruiterSimulation recruiterSimulation;
    private List<CategoryKeywordMatch> categoryKeywords;
    private List<RiskItem> riskItems;

    // ── Hard-truth intelligence (rebuilt scoring engine) ───────────────────
    private HonestScoreBreakdown honestScoreBreakdown;
    private CgpaAssessment cgpaAssessment;
    private List<TopProblem> topProblems;
    private List<BulletQualityItem> bulletQuality;
    private List<UnverifiableMetric> unverifiableMetrics;

    // ── JD-calibrated assessment (see HonestResumeAssessment) ──────────────
    // band/fit/confidence are the code-derived labels from the band table —
    // finalScore/verdict above stay populated too (verdict = fit) so existing
    // consumers (compare, history list) keep working unchanged.
    private String band;
    private String fit;
    private String confidence;
    private HonestResumeAssessment honestAssessment;

    // ── Nested classes ──

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BulletRewrite {
        private String original;
        private String rewritten;
        private String rule;
        // NEW enhanced fields
        private List<String> improvements;
        private List<String> keywordsAdded;
        private int atsGain;
        private int confidenceScore;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoleLevelGap {
        private String       detectedLevel; // Fresher|Junior|Mid|Senior
        private String       requiredLevel; // Fresher|Junior|Mid|Senior
        private boolean      hasGap;
        private List<String> gaps;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuantSuggestion {
        private String original;
        private String suggestion;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FeedbackItem {
        private String severity;
        private String section; // only for contentFeedback
        private String keyword; // only for keywordFeedback
        private String issue;
        private String fix;
        // NEW: AI confidence
        private int confidenceScore;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FakeMetric {
        private String bullet;
        private String issue;
        private String fix;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MarketReadiness {
        private boolean tier1Companies;
        private boolean tier2Companies;
        private boolean tier3Companies;
        private String readinessNote;

        // NEW: honest, per-tier detail (companies, % readiness, why, what's needed)
        private TierReadiness tier1Detail;
        private TierReadiness tier2Detail;
        private TierReadiness tier3Detail;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TierReadiness {
        private List<String> companies;
        private int          readiness; // 0-100, honestly calibrated
        private String       reason;
        private List<String> whatNeeded;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PriorityFix {
        private int priority;
        private String action;
        private String impact;
        private String timeToFix;
        private int    atsPointsGained;
        private String recruiterImpact;
    }
}
