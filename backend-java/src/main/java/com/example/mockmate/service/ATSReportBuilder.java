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
     * Combines deterministic scoring with Groq's semantic analysis into
     * a final ATSReport using the following weighted formula:
     *
     *  keyword overlap   20%
     *  semantic          25%
     *  role alignment    20%
     *  section complete  15%
     *  formatting safety 10%
     *  quantification    10%
     */
    public ATSReport build(String userId, ScoringResult scoring, GroqATSResult groq) {

        int finalScore = weightedScore(
                scoring.getKeywordOverlapScore(),
                groq.getSemanticScore(),
                groq.getRoleAlignmentScore(),
                scoring.getSectionScore(),
                scoring.getFormattingScore(),
                scoring.getQuantificationScore()
        );

        // Merge section feedback: prefer Groq values, fallback to deterministic
        Map<String, String> mergedSections = new LinkedHashMap<>(scoring.getSectionFeedback());
        if (groq.getSectionFeedback() != null) {
            groq.getSectionFeedback().forEach((k, v) -> {
                if (v != null && !v.isBlank()) mergedSections.put(k, v);
            });
        }

        log.info("[ATSReportBuilder] userId={} finalScore={} verdict={}", userId, finalScore, groq.getVerdict());

        return ATSReport.builder()
                .userId(userId)
                .finalScore(finalScore)
                .verdict(groq.getVerdict())
                .verdictReason(groq.getVerdictReason())
                .matchedKeywords(groq.getMatchedKeywords())
                .missingKeywords(groq.getMissingKeywords())
                .sectionFeedback(mergedSections)
                .formattingRisks(scoring.getFormattingRisks())
                .bulletRewrites(groq.getBulletRewrites())
                .strengthLines(groq.getStrengthLines())
                .keywordOverlapScore(scoring.getKeywordOverlapScore())
                .semanticScore(groq.getSemanticScore())
                .roleAlignmentScore(groq.getRoleAlignmentScore())
                .sectionScore(scoring.getSectionScore())
                .formattingScore(scoring.getFormattingScore())
                .quantificationScore(scoring.getQuantificationScore())
                .build();
    }

    private int weightedScore(int keyword, int semantic, int role,
                               int section, int formatting, int quant) {
        double score = (keyword   * 0.20)
                     + (semantic  * 0.25)
                     + (role      * 0.20)
                     + (section   * 0.15)
                     + (formatting* 0.10)
                     + (quant     * 0.10);
        return (int) Math.round(Math.max(0, Math.min(100, score)));
    }
}
