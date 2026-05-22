package com.example.mockmate.service;

import com.example.mockmate.model.ATSReport;
import com.example.mockmate.service.ATSScoringService.ScoringResult;
import com.example.mockmate.service.GroqATSService.GroqATSResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
public class ATSReportBuilder {

    /**
     * Final weighted score formula:
     *   Weighted keyword overlap   25%
     *   Semantic match (Groq)      20%
     *   Role alignment (Groq)      20%
     *   Section completeness       15%
     *   Formatting safety          10%
     *   Quantification             10%
     *
     * Grade mapping:
     *   85-100 → Strong fit
     *   70-84  → Good fit
     *   50-69  → Moderate fit
     *   0-49   → Weak fit
     *
     * If Groq fails, computes score from deterministic scores only
     * and sets aiAnalysisAvailable=false.
     */
    public ATSReport build(String userId,
                           String resumeFileName,
                           String originalText,
                           ScoringResult scoring,
                           GroqATSResult groq) {

        boolean aiAvailable = groq != null
                && (groq.getSemanticScore() > 0 || groq.getRoleAlignmentScore() > 0
                    || (groq.getMatchedKeywords() != null && !groq.getMatchedKeywords().isEmpty()));

        int finalScore = aiAvailable
                ? weightedScore(
                        scoring.getKeywordOverlapScore(),
                        groq.getSemanticScore(),
                        groq.getRoleAlignmentScore(),
                        scoring.getSectionScore(),
                        scoring.getFormattingScore(),
                        scoring.getQuantificationScore())
                : deterministicOnlyScore(
                        scoring.getKeywordOverlapScore(),
                        scoring.getSectionScore(),
                        scoring.getFormattingScore(),
                        scoring.getQuantificationScore());

        String verdict       = aiAvailable ? groq.getVerdict()       : gradeToVerdict(finalScore);
        String verdictReason = aiAvailable ? groq.getVerdictReason() : buildFallbackReason(finalScore, scoring);

        // Merge section feedback: prefer Groq values, fallback to deterministic
        Map<String, String> mergedSections = new LinkedHashMap<>(scoring.getSectionFeedback());
        if (aiAvailable && groq.getSectionFeedback() != null) {
            groq.getSectionFeedback().forEach((k, v) -> {
                if (v != null && !v.isBlank()) mergedSections.put(k, v);
            });
        }

        log.info("[ATSReportBuilder] userId={} fileName={} finalScore={} verdict={} aiAvailable={}",
                userId, resumeFileName, finalScore, verdict, aiAvailable);

        ATSReport.ATSReportBuilder builder = ATSReport.builder()
                .userId(userId)
                .resumeFileName(resumeFileName)
                .originalText(originalText)
                .finalScore(finalScore)
                .verdict(verdict)
                .verdictReason(verdictReason)
                .sectionFeedback(mergedSections)
                .formattingRisks(scoring.getFormattingRisks())
                .skillDepthMap(scoring.getSkillDepthMap())
                .keywordOverlapScore(scoring.getKeywordOverlapScore())
                .sectionScore(scoring.getSectionScore())
                .formattingScore(scoring.getFormattingScore())
                .quantificationScore(scoring.getQuantificationScore())
                .aiAnalysisAvailable(aiAvailable);

        if (aiAvailable) {
            builder
                .matchedKeywords(groq.getMatchedKeywords())
                .missingKeywords(groq.getMissingKeywords())
                .bulletRewrites(groq.getBulletRewrites())
                .strengthLines(groq.getStrengthLines())
                .semanticScore(groq.getSemanticScore())
                .roleAlignmentScore(groq.getRoleAlignmentScore())
                .tailoredSummary(groq.getTailoredSummary())
                .roleLevelGap(groq.getRoleLevelGap())
                .quantificationSuggestions(groq.getQuantificationSuggestions());
        } else {
            builder
                .matchedKeywords(List.of())
                .missingKeywords(List.of())
                .bulletRewrites(List.of())
                .strengthLines(List.of())
                .semanticScore(0)
                .roleAlignmentScore(0)
                .tailoredSummary("")
                .roleLevelGap(ATSReport.RoleLevelGap.builder()
                        .detectedLevel("Mid").requiredLevel("Mid").gaps(List.of()).build())
                .quantificationSuggestions(List.of());
        }

        return builder.build();
    }

    // ── Weighted score (with AI) ───────────────────────────────────────────────────
    private int weightedScore(int keyword, int semantic, int role,
                               int section, int formatting, int quant) {
        double score = (keyword    * 0.25)
                     + (semantic   * 0.20)
                     + (role       * 0.20)
                     + (section    * 0.15)
                     + (formatting * 0.10)
                     + (quant      * 0.10);
        return clamp(score);
    }

    // ── Deterministic-only score (fallback) ───────────────────────────────────────
    private int deterministicOnlyScore(int keyword, int section, int formatting, int quant) {
        double score = (keyword    * 0.40)
                     + (section    * 0.30)
                     + (formatting * 0.15)
                     + (quant      * 0.15);
        return clamp(score);
    }

    private int clamp(double score) {
        return (int) Math.round(Math.max(0, Math.min(100, score)));
    }

    // ── Grade mapping ──────────────────────────────────────────────────────────────
    private String gradeToVerdict(int score) {
        if (score >= 85) return "Strong fit";
        if (score >= 70) return "Good fit";
        if (score >= 50) return "Moderate fit";
        return "Weak fit";
    }

    private String buildFallbackReason(int score, ScoringResult scoring) {
        return String.format(
            "Deterministic analysis scored this resume at %d/100 based on keyword overlap, " +
            "section completeness, and formatting. AI analysis was unavailable — " +
            "section score: %d, formatting score: %d, keyword overlap: %d.",
            score, scoring.getSectionScore(), scoring.getFormattingScore(), scoring.getKeywordOverlapScore()
        );
    }
}
