package com.example.mockmate.service;

import com.example.mockmate.model.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * ATSEnforcementService — the Enforcement Layer in the new pipeline.
 * <p>
 * Takes a NormalizedResume (from the Content Layer / Groq) and deterministically
 * enforces ATS parity: keyword retention, bullet restoration, section preservation.
 * <p>
 * Internally delegates to the existing {@link ResumeATSEnforcer} via
 * bidirectional mapping through {@link NormalizedResumeMapper}.
 * <p>
 * Enforcement is:
 * <ul>
 *   <li>Deterministic (no AI calls)</li>
 *   <li>Idempotent (running twice produces the same result)</li>
 *   <li>Score-preserving (ATS score can only go up, never down)</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ATSEnforcementService {

    private final ResumeATSEnforcer legacyEnforcer;

    /**
     * Runs full ATS enforcement on a NormalizedResume.
     *
     * @param normalized     The AI-generated resume content
     * @param originalParsed The original parsed resume data (for content parity)
     * @param report         The ATS analysis report (for keyword targets)
     * @param jdText         The job description text
     * @return The enforced NormalizedResume with guaranteed ATS content preservation
     */
    public NormalizedResume enforce(NormalizedResume normalized,
                                    ResumeData originalParsed,
                                    ATSReport report,
                                    String jdText) {

        log.info("[ATSEnforcementService] Starting enforcement for: {}", normalized.getName());

        // Convert to legacy format → run enforcer → convert back
        ReconstructedResume legacy = NormalizedResumeMapper.toReconstructed(normalized);
        ReconstructedResume enforced = legacyEnforcer.enforce(legacy, originalParsed, report, jdText);
        NormalizedResume result = NormalizedResumeMapper.fromReconstructed(enforced);

        // Both the Groq reconstruction and the enforcer's own content-
        // restoration merges above can introduce duplicate/blank list items
        // and "unbundled" skill categories (one row per individual skill
        // instead of grouped categories) — neither dedupes what it emits.
        // Normalizing here, right before this result reaches ANY renderer
        // (HTML/DOCX/LaTeX all consume this same NormalizedResume), is the
        // one place that guarantees clean output regardless of which
        // upstream step introduced the mess.
        result = ResumeContentNormalizer.normalize(result);

        // Carry over metadata fields that the mapper doesn't know about
        result.setResumeId(normalized.getResumeId());
        result.setUserId(normalized.getUserId());
        result.setSourceReportId(normalized.getSourceReportId());
        result.setGeneratedAt(normalized.getGeneratedAt());
        result.setTemplateId(normalized.getTemplateId());
        result.setAiEnhanced(normalized.isAiEnhanced());
        result.setValidationPassed(true);

        log.info("[ATSEnforcementService] Enforcement complete. Score: {}", result.getAtsScore());
        return result;
    }

    /**
     * Computes the ATS score for a NormalizedResume without modifying it.
     * Useful for validation checks and score display.
     */
    public int computeScore(NormalizedResume normalized, String jdText) {
        ReconstructedResume legacy = NormalizedResumeMapper.toReconstructed(normalized);
        return legacyEnforcer.computeATSScore(legacy, jdText);
    }

    /**
     * Builds a plain-text representation for ATS scoring from a NormalizedResume.
     */
    public String buildResumeText(NormalizedResume normalized) {
        ReconstructedResume legacy = NormalizedResumeMapper.toReconstructed(normalized);
        return legacyEnforcer.buildResumeText(legacy);
    }
}
