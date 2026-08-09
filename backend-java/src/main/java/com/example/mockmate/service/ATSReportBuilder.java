package com.example.mockmate.service;

import com.example.mockmate.model.*;
import com.example.mockmate.service.ATSScoringService.ScoringResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ATSReportBuilder {

    private final EnhancedScoringService    enhancedScoringService;
    private final ConsistencyCheckerService consistencyCheckerService;
    private final ImprovementSimulatorService improvementSimulatorService;
    private final CompanyReadinessService   companyReadinessService;

    public ATSReport build(String userId,
                           String resumeFileName,
                           String originalText,
                           ScoringResult scoring,
                           HonestResumeAssessment assessment) {

        // Only the empty fallback (Groq unreachable / no API key) leaves
        // dimensionScores null — a real response always has one, even for a
        // 0-scored resume.
        boolean aiAvailable = assessment != null && assessment.getDimensionScores() != null;

        // ── Deterministic enhanced scores (unrelated to the LLM assessment —
        // these are independent Java-side analyses that keep working exactly
        // as before) ────────────────────────────────────────────────────────
        int actionVerbScore      = scoring.getActionVerbScore();
        ConsistencyCheckResult consistency = consistencyCheckerService.runAllChecks(originalText);
        ATSParserPreview parserPreview     = enhancedScoringService.computeParserPreview(
                originalText, scoring.getMatchedKeywords());

        // ── Score & verdict now come straight from the JD-calibrated
        // assessment — code computes the weighted total and band per the
        // prompt's own Rule 4, GroqATSService does that arithmetic and hands
        // back overallScore/band/fit/confidence already derived. No more
        // blended/penalty-stacked scoring formula here.
        int finalScore = aiAvailable ? assessment.getOverallScore()
                : deterministicOnlyScore(scoring.getKeywordOverlapScore(),
                        scoring.getSectionScore(), scoring.getFormattingScore(),
                        scoring.getQuantificationScore(), actionVerbScore,
                        consistency.getConsistencyScore());
        String verdict       = aiAvailable ? assessment.getFit() : gradeToHonestVerdict(finalScore);
        String band          = aiAvailable ? assessment.getBand() : "Borderline";
        String confidence    = aiAvailable ? assessment.getConfidence() : "Low";
        String verdictReason = aiAvailable && assessment.getRecruiterAssessment() != null
                ? assessment.getRecruiterAssessment()
                : buildFallbackReason(finalScore, scoring);

        // Rough proxy for the old contentQualityScore field (0-25 raw → 0-100),
        // used only by a couple of other deterministic services below.
        int contentQualityScore = scoring.getHardTruthSignals() != null
                ? Math.min(100, scoring.getHardTruthSignals().getContentQualityScore() * 4)
                : 70;

        // ── Build partial report for improvement simulator ────────────────────
        ATSReport partialReport = ATSReport.builder()
                .finalScore(finalScore)
                .missingKeywords(scoring.getMissingKeywords())
                .quantificationScore(scoring.getQuantificationScore())
                .actionVerbScore(actionVerbScore)
                .build();
        List<ImprovementScenario> scenarios = improvementSimulatorService.computeScenarios(partialReport, originalText);
        List<CompanyFit> companyFits        = companyReadinessService.computeCompanyFit(partialReport, originalText);

        // ── Build EnhancedExecutiveSummary ────────────────────────────────────
        List<String> topStrengths = aiAvailable && assessment.getStrengths() != null
                ? assessment.getStrengths().stream().map(HonestResumeAssessment.Strength::getPoint).toList()
                : List.of();
        List<String> topWeaknesses = aiAvailable && assessment.getWeaknesses() != null
                ? assessment.getWeaknesses().stream().map(HonestResumeAssessment.Weakness::getPoint).toList()
                : List.of();

        EnhancedExecutiveSummary enhancedSummary = EnhancedExecutiveSummary.builder()
                .targetRole(resumeFileName)
                .overallQuality(Math.max(1, Math.min(5, finalScore / 20)))
                .atsReadinessPercent(scoring.getKeywordOverlapScore())
                .recruiterConfidence(confidence)
                .estimatedInterviewProbability(Math.min(95, finalScore + 5))
                .estimatedATSPassProbability(Math.min(95, scoring.getKeywordOverlapScore() + 10))
                .topStrengths(topStrengths)
                .topWeaknesses(topWeaknesses)
                .paragraphSummary(aiAvailable ? nvl(assessment.getTailoredSummary(), assessment.getRecruiterAssessment()) : "")
                .build();

        // ── WritingAnalysis: the new prompt doesn't grade writing mechanics
        // (grammar/tone/passive-voice) at all, so this is always the
        // deterministic fallback now rather than sometimes-Groq/sometimes-not.
        WritingAnalysis writingAnalysis = WritingAnalysis.builder()
                .grammarScore(80)
                .professionalToneScore(75)
                .actionVerbScore(actionVerbScore)
                .readabilityScore(75)
                .buzzwordOveruse(enhancedScoringService.detectBuzzwords(originalText))
                .passiveVoiceInstances(List.of())
                .conciseness("Good")
                .grammarErrors(List.of())
                .build();

        log.info("[ATSReportBuilder] userId={} score={} band={} verdict={} aiAvailable={} scenarios={} companies={}",
                userId, finalScore, band, verdict, aiAvailable, scenarios.size(), companyFits.size());

        // ── Bridge new bullet_rewrites (id/before/after/needs_user_input) into
        // the legacy BulletRewrite shape so Resume Studio's existing "apply AI
        // rewrites" DOCX regeneration flow (ResumeReconstructionService /
        // ResumeATSEnforcer) keeps working without needing its own rewrite.
        List<ATSReport.BulletRewrite> legacyRewrites = aiAvailable && assessment.getBulletRewrites() != null
                ? assessment.getBulletRewrites().stream()
                        .map(r -> ATSReport.BulletRewrite.builder()
                                .original(r.getBefore())
                                .rewritten(r.getAfter())
                                .rule(r.isNeedsUserInput() ? "NEEDS_MORE_INFO" : "HONEST_IMPROVEMENT")
                                .improvements(List.of())
                                .keywordsAdded(List.of())
                                .atsGain(0)
                                .confidenceScore(r.isNeedsUserInput() ? 50 : 80)
                                .build())
                        .toList()
                : List.of();

        // ── Build final report ────────────────────────────────────────────────
        return ATSReport.builder()
                .userId(userId)
                .resumeFileName(resumeFileName)
                .originalText(originalText)
                .finalScore(finalScore)
                .verdict(verdict)
                .band(band)
                .fit(verdict)
                .confidence(confidence)
                .verdictReason(verdictReason)
                .sectionFeedback(scoring.getSectionFeedback())
                .formattingRisks(scoring.getFormattingRisks())
                .skillDepthMap(scoring.getSkillDepthMap())
                .keywordOverlapScore(scoring.getKeywordOverlapScore())
                .sectionScore(scoring.getSectionScore())
                .formattingScore(scoring.getFormattingScore())
                .quantificationScore(scoring.getQuantificationScore())
                .actionVerbScore(actionVerbScore)
                .consistencyScore(consistency.getConsistencyScore())
                .contentQualityScore(contentQualityScore)
                .aiAnalysisAvailable(aiAvailable)
                .matchedKeywords(scoring.getMatchedKeywords())
                .missingKeywords(scoring.getMissingKeywords())
                .enhancedSummary(enhancedSummary)
                .parserPreview(parserPreview)
                .improvementScenarios(scenarios)
                .companyReadiness(companyFits)
                .consistencyCheck(consistency)
                .writingAnalysis(writingAnalysis)
                .categoryKeywords(scoring.getCategoryKeywords())
                .tailoredSummary(aiAvailable ? assessment.getTailoredSummary() : "")
                .bulletRewrites(legacyRewrites)
                .genuineStrengths(topStrengths)
                .strengthLines(topStrengths)
                .honestAssessment(assessment)
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private int deterministicOnlyScore(int keyword, int section, int formatting,
                                       int quant, int actionVerb, int consistency) {
        double score = (keyword     * 0.35)
                     + (section     * 0.25)
                     + (formatting  * 0.15)
                     + (quant       * 0.10)
                     + (actionVerb  * 0.10)
                     + (consistency * 0.05);
        return clamp(score);
    }

    private int clamp(double score) {
        return (int) Math.round(Math.max(0, Math.min(100, score)));
    }

    private String gradeToHonestVerdict(int score) {
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

    private String nvl(String a, String b) {
        return (a != null && !a.isBlank()) ? a : (b != null ? b : "");
    }
}
