package com.example.mockmate.service;

import com.example.mockmate.model.*;
import com.example.mockmate.registry.TemplateRegistry;
import com.example.mockmate.renderer.DocxRenderer;
import com.example.mockmate.renderer.HtmlRenderer;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.*;

/**
 * ATSDownloadService — the ORCHESTRATOR of the new layered pipeline.
 * <p>
 * Pipeline flow:
 * <pre>
 *   1. Content Layer  → ResumeReconstructionService (Groq AI, one-time)
 *   2. Enforcement    → ATSEnforcementService (deterministic, always runs)
 *   3. Persistence    → Save NormalizedResume to disk (resumes/{id}/normalized.json)
 *   4. Rendering      → DocxRenderer / HtmlRenderer / LatexRenderer (from TemplateConfig)
 *   5. Validation     → ATSDocxValidator (on DOCX output)
 * </pre>
 * <p>
 * Template switching (Step 4 only, no AI) is achieved via {@link #switchTemplate}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ATSDownloadService {

    // ── Dependencies ────────────────────────────────────────────────────────
    private final ResumeParser                resumeParser;
    private final ResumeReconstructionService reconstructionService;
    private final ATSEnforcementService       enforcementService;
    private final ATSDocxValidator            atsValidator;
    private final ATSScoringService           atsScoringService;
    private final ObjectMapper                objectMapper;

    // New pipeline renderers
    private final DocxRenderer     docxRenderer;
    private final HtmlRenderer     htmlRenderer;
    private final TemplateRegistry templateRegistry;

    // Legacy renderer — kept for backward compat until all callers migrate
    private final ResumeTemplateRenderer templateRenderer;
    private final ResumeATSEnforcer      atsEnforcer;

    static final String ATS_DIR = "reports/ats";

    // ══════════════════════════════════════════════════════════════════════════
    // MAIN PIPELINE: generate() → Content → Enforce → Persist → Render → Validate
    // ══════════════════════════════════════════════════════════════════════════

    public ATSDownloadResult generate(String reportId, String jobDescription, String templateId) throws Exception {
        String tid = templateId != null ? templateId : "classic";
        log.info("[Download] reportId={} template={}", reportId, tid);

        // Try loading cached NormalizedResume first
        NormalizedResume normalized = loadNormalized(reportId);

        if (normalized != null) {
            log.info("[Download] Loaded cached NormalizedResume for reportId={}", reportId);
        } else {
            // Fall back to legacy cached ReconstructedResume
            normalized = loadFromLegacyCache(reportId, tid, jobDescription);
        }

        if (normalized == null) {
            // Full pipeline: Content Layer → Enforcement Layer
            normalized = runFullPipeline(reportId, jobDescription, tid);
        }

        // Persist
        saveNormalized(reportId, normalized);

        // Render → Validate
        return renderAndValidate(normalized, tid);
    }

    /**
     * Runs the full content + enforcement pipeline.
     */
    private NormalizedResume runFullPipeline(String reportId, String jobDescription, String templateId) throws Exception {
        ATSReport report = readReport(reportId);
        String rawText = loadRawText(reportId, report);
        if (rawText == null || rawText.isBlank())
            throw new RuntimeException("Raw resume text not found for reportId: " + reportId);

        ResumeData parsed = resumeParser.parse(rawText);

        // Content Layer (AI)
        NormalizedResume normalized;
        try {
            normalized = reconstructionService.reconstructToNormalized(parsed, report, jobDescription, templateId);
        } catch (Exception e) {
            log.error("[Download] Groq reconstruction failed, falling back: {}", e.getMessage());
            normalized = reconstructionService.buildFallbackNormalized(parsed, report);
            normalized.setTemplateId(templateId);
        }
        normalized.setSourceReportId(reportId);

        // Enforcement Layer (deterministic)
        log.info("[Download] Running ATS enforcement for reportId={}", reportId);
        normalized = enforcementService.enforce(normalized, parsed, report, jobDescription);

        // Score Validation Loop
        int originalScore = report.getFinalScore();
        int generatedScore = enforcementService.computeScore(normalized, jobDescription);
        log.info("[Download] ATS Score Check: original={} generated={}", originalScore, generatedScore);

        int maxRefinements = 2;
        int refinement = 0;
        while (generatedScore < originalScore && refinement < maxRefinements) {
            refinement++;
            log.warn("[Download] Generated score ({}) < original ({}). Refinement pass {}/{}",
                    generatedScore, originalScore, refinement, maxRefinements);
            normalized = enforcementService.enforce(normalized, parsed, report, jobDescription);
            generatedScore = enforcementService.computeScore(normalized, jobDescription);
            log.info("[Download] After refinement {}: score={}", refinement, generatedScore);
        }

        if (generatedScore < originalScore) {
            log.warn("[Download] Final score ({}) still lower than original ({}) after {} refinements.",
                    generatedScore, originalScore, maxRefinements);
        } else {
            log.info("[Download] ✅ ATS score parity achieved: original={} generated={}", originalScore, generatedScore);
        }

        normalized.setAtsScore(generatedScore);
        normalized.setValidationPassed(generatedScore >= originalScore);
        return normalized;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STUDIO: Load / Save / Render
    // ══════════════════════════════════════════════════════════════════════════

    public ReconstructedResume loadForStudio(String reportId, String jd, String templateId) throws Exception {
        // Try new pipeline first
        NormalizedResume normalized = loadNormalized(reportId);

        if (normalized == null) {
            // Fall back to legacy cache
            normalized = loadFromLegacyCache(reportId, templateId, jd);
        }

        if (normalized == null) {
            // Full pipeline
            normalized = runFullPipelineForStudio(reportId, jd, templateId);
        }

        if (templateId != null && !templateId.isBlank()) {
            normalized.setTemplateId(templateId);
        }

        saveNormalized(reportId, normalized);

        // Return as ReconstructedResume for backward compat with controller/frontend JSON shape
        return NormalizedResumeMapper.toReconstructed(normalized);
    }

    private NormalizedResume runFullPipelineForStudio(String reportId, String jd, String templateId) throws Exception {
        ATSReport report = readReport(reportId);
        String rawText = loadRawText(reportId, report);

        if (rawText != null && !rawText.isBlank()) {
            ResumeData parsed = resumeParser.parse(rawText);
            NormalizedResume normalized;
            try {
                normalized = reconstructionService.reconstructToNormalized(
                    parsed, report, jd, templateId != null ? templateId : "classic");
            } catch (Exception e) {
                log.error("[Studio] Groq reconstruction failed, using fallback: {}", e.getMessage());
                normalized = reconstructionService.buildFallbackNormalized(parsed, report);
            }
            normalized.setSourceReportId(reportId);
            normalized = enforcementService.enforce(normalized, parsed, report, jd != null ? jd : "");
            return normalized;
        } else {
            log.warn("[Studio] No raw text for reportId={}, building report-only stub", reportId);
            return buildStubNormalized(report, templateId);
        }
    }

    /**
     * Builds a minimal NormalizedResume from ATSReport fields alone.
     */
    private NormalizedResume buildStubNormalized(ATSReport report, String templateId) {
        NormalizedResume n = NormalizedResume.builder()
            .templateId(templateId != null ? templateId : "classic")
            .build();
        if (report.getMatchedKeywords() != null && !report.getMatchedKeywords().isEmpty()) {
            n.setSkills(List.of(
                NormalizedResume.NSkillCategory.builder()
                    .label("Matched Skills")
                    .value(String.join(", ", report.getMatchedKeywords()))
                    .priority(1)
                    .jdRelevant(true)
                    .build()
            ));
        }
        log.info("[Studio] Stub built from report — all contact/personal fields left blank for user input");
        return n;
    }

    // ── Save & Load (NEW format: normalized.json) ───────────────────────────

    public void saveNormalized(String reportId, NormalizedResume resume) {
        try {
            Path dir = Path.of(ATS_DIR);
            Files.createDirectories(dir);
            Path filePath = dir.resolve(reportId + "_normalized.json");
            objectMapper.writeValue(filePath.toFile(), resume);
            log.info("[Download] Saved NormalizedResume for reportId={}", reportId);
        } catch (Exception e) {
            log.error("[Download] Failed to save NormalizedResume for {}: {}", reportId, e.getMessage());
        }
    }

    private NormalizedResume loadNormalized(String reportId) {
        Path path = Path.of(ATS_DIR, reportId + "_normalized.json");
        if (Files.exists(path)) {
            try {
                return objectMapper.readValue(path.toFile(), NormalizedResume.class);
            } catch (Exception e) {
                log.warn("[Download] Failed to load normalized resume: {}", e.getMessage());
            }
        }
        return null;
    }

    /**
     * Loads a legacy _reconstructed.json and converts it to NormalizedResume.
     */
    private NormalizedResume loadFromLegacyCache(String reportId, String templateId, String jd) {
        Path path = Path.of(ATS_DIR, reportId + "_reconstructed.json");
        if (Files.exists(path)) {
            try {
                ReconstructedResume legacy = objectMapper.readValue(path.toFile(), ReconstructedResume.class);
                log.info("[Download] Loaded legacy _reconstructed.json, converting to NormalizedResume");
                if (!legacy.isImprovementsApplied()) {
                    ATSReport report = readReport(reportId);
                    reconstructionService.postApplyReportSuggestions(legacy, report);
                    legacy.setImprovementsApplied(true);
                }
                NormalizedResume normalized = NormalizedResumeMapper.fromReconstructed(legacy);
                normalized.setSourceReportId(reportId);
                normalized.setTemplateId(templateId != null ? templateId : "classic");
                return normalized;
            } catch (Exception e) {
                log.warn("[Download] Failed to load legacy cache: {}", e.getMessage());
            }
        }
        return null;
    }

    // ── Backward compat: save as ReconstructedResume ─────────────────────────

    public void saveReconstructed(String reportId, ReconstructedResume resume) {
        try {
            Path dir = Path.of(ATS_DIR);
            Files.createDirectories(dir);
            Path filePath = dir.resolve(reportId + "_reconstructed.json");
            objectMapper.writeValue(filePath.toFile(), resume);
            log.info("[Studio] Saved reconstructed resume for reportId={}", reportId);
            // Also save as NormalizedResume
            NormalizedResume normalized = NormalizedResumeMapper.fromReconstructed(resume);
            normalized.setSourceReportId(reportId);
            saveNormalized(reportId, normalized);
        } catch (Exception e) {
            log.error("[Studio] Failed to save reconstructed resume for {}: {}", reportId, e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TEMPLATE SWITCHING (zero AI, <1s)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Switches the template for a resume. Loads the persisted NormalizedResume,
     * updates the templateId, and re-renders. No AI call.
     *
     * @return The re-rendered ATSDownloadResult with new template
     */
    public ATSDownloadResult switchTemplate(String reportId, String newTemplateId) throws Exception {
        NormalizedResume normalized = loadNormalized(reportId);
        if (normalized == null) {
            normalized = loadFromLegacyCache(reportId, newTemplateId, "");
        }
        if (normalized == null) {
            throw new RuntimeException("No cached resume found for reportId: " + reportId + ". Generate first.");
        }
        normalized.setTemplateId(newTemplateId);
        saveNormalized(reportId, normalized);
        return renderAndValidate(normalized, newTemplateId);
    }

    /**
     * Returns an HTML preview string for a NormalizedResume + template.
     * No AI call, pure rendering.
     */
    public String previewHtml(NormalizedResume resume, String templateId) {
        TemplateConfig config = templateRegistry.get(templateId);
        return htmlRenderer.renderToString(resume, config);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STUDIO: render from edited data + live scoring
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Renders DOCX from a ReconstructedResume (called from controller).
     * Backward compatible — converts internally.
     */
    public ATSDownloadResult renderFromStudio(ReconstructedResume resume, String templateId) {
        String tid = templateId != null ? templateId : "classic";
        // Use new pipeline internally
        NormalizedResume normalized = NormalizedResumeMapper.fromReconstructed(resume);
        return renderAndValidate(normalized, tid);
    }

    /**
     * Live ATS score computation for studio editing.
     */
    public ATSScoreResult scoreLocally(ReconstructedResume resume, String jd) {
        String resumeText = atsEnforcer.buildResumeText(resume);
        ATSScoringService.ScoringResult scoring = atsScoringService.score(resumeText, jd != null ? jd : "");

        int overall = (int) Math.round(
            scoring.getKeywordOverlapScore() * 0.35 +
            scoring.getSectionScore()        * 0.25 +
            scoring.getFormattingScore()     * 0.20 +
            scoring.getQuantificationScore() * 0.20
        );
        overall = Math.max(0, Math.min(100, overall));

        List<String> fixes = new ArrayList<>();
        if (resume.getProfessionalSummary() == null || resume.getProfessionalSummary().isBlank())
            fixes.add("Add a professional summary");
        if (scoring.getMissingKeywords().size() > 3)
            fixes.add("Add missing keywords: " + String.join(", ",
                scoring.getMissingKeywords().subList(0, Math.min(5, scoring.getMissingKeywords().size()))));
        if (scoring.getSectionScore() < 80)
            fixes.add("Ensure all key sections are present (education, skills, experience, projects)");
        if (scoring.getFormattingScore() < 80 && scoring.getFormattingRisks() != null && !scoring.getFormattingRisks().isEmpty())
            fixes.add("Fix formatting issues: " + String.join("; ",
                scoring.getFormattingRisks().subList(0, Math.min(2, scoring.getFormattingRisks().size()))));
        if (scoring.getQuantificationScore() < 50)
            fixes.add("Add more quantified metrics (percentages, numbers, team sizes)");

        return ATSScoreResult.builder()
            .overallScore(overall)
            .keywordScore(scoring.getKeywordOverlapScore())
            .sectionScore(scoring.getSectionScore())
            .formattingScore(scoring.getFormattingScore())
            .missingKeywords(scoring.getMissingKeywords().subList(0, Math.min(8, scoring.getMissingKeywords().size())))
            .quickFixes(fixes)
            .build();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Renders a NormalizedResume to DOCX via the NEW DocxRenderer pipeline,
     * then validates the output via ATSDocxValidator.
     */
    private ATSDownloadResult renderAndValidate(NormalizedResume normalized, String templateId) {
        TemplateConfig config = templateRegistry.get(templateId);
        byte[] docxBytes = docxRenderer.renderToBytes(normalized, config);
        ATSValidationResult validation = atsValidator.validate(docxBytes);

        log.info("[Download] Rendered template={} atsScore={} criticals={}",
            templateId, validation.getAtsScore(), validation.getCriticalFails().size());

        // Return with legacy ReconstructedResume for API compat
        ReconstructedResume legacy = NormalizedResumeMapper.toReconstructed(normalized);
        return new ATSDownloadResult(docxBytes, validation, legacy);
    }

    public void saveRawText(String reportId, String rawText) {
        try {
            Path dir = Path.of(ATS_DIR);
            Files.createDirectories(dir);
            Files.writeString(dir.resolve(reportId + "_raw.txt"), rawText);
            log.info("[Download] Raw text saved for reportId={} chars={}", reportId, rawText.length());
        } catch (IOException e) {
            log.error("[Download] Failed to save raw text for {}: {}", reportId, e.getMessage());
        }
    }

    /**
     * Loads and parses the raw resume text for a report — the ResumeData
     * shape the pipeline gate (see ResumeGenerationGateService) and the Fill
     * Gaps Wizard both need, without going through AI reconstruction.
     */
    public ResumeData loadParsedResumeData(String reportId) throws Exception {
        ATSReport report = readReport(reportId);
        String rawText = loadRawText(reportId, report);
        return resumeParser.parse(rawText);
    }

    public ATSReport loadReport(String reportId) throws Exception {
        return readReport(reportId);
    }

    private ATSReport readReport(String reportId) throws Exception {
        File f = new File(ATS_DIR, reportId + ".json");
        if (!f.exists()) throw new RuntimeException("Report not found: " + reportId);
        return objectMapper.readValue(f, ATSReport.class);
    }

    private String loadRawText(String reportId, ATSReport report) {
        Path rawPath = Path.of(ATS_DIR, reportId + "_raw.txt");
        if (Files.exists(rawPath)) {
            try { return Files.readString(rawPath); } catch (IOException ignored) {}
        }
        return report.getOriginalText();
    }
}
