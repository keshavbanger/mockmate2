package com.example.mockmate.controller;

import com.example.mockmate.model.*;
import com.example.mockmate.service.ATSDownloadService;
import com.example.mockmate.service.ResumeGenerationGateService;
import com.example.mockmate.service.ResumeGenerationValidator;
import com.example.mockmate.service.ResumeWriterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * The resume-WRITER's own controller — deliberately separate from
 * {@link ResumeStudioController}'s AI-reconstruction endpoints, which use
 * the older, "score parity at all costs" ResumeReconstructionService. This
 * is the entry point for the Fill Gaps Wizard → gate → writer → validator
 * pipeline described in the Resume Generator Prompt Pack.
 */
@Slf4j
@RestController
@RequestMapping("/api/resume-generator")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
@RequiredArgsConstructor
public class ResumeGeneratorController {

    private final ATSDownloadService atsDownloadService;
    private final ResumeGenerationGateService gateService;
    private final ResumeWriterService writerService;
    private final ResumeGenerationValidator validator;

    // ── Step 0: parsed data + gate result + skill suggestions ────────────
    // The Fill Gaps Wizard's starting point: what was actually parsed, which
    // fields are blocking, and which skills to offer for per-skill
    // confirmation (sourced from the ATS engine's own coverage.quick_wins —
    // skills the project bullets already imply but the Skills section never
    // listed, exactly the "near-zero effort" fix the analysis prompt ranks
    // highest).
    @GetMapping("/parsed/{reportId}")
    public ResponseEntity<?> parsed(@PathVariable String reportId) {
        try {
            ResumeData resumeData = atsDownloadService.loadParsedResumeData(reportId);
            ATSReport report = atsDownloadService.loadReport(reportId);

            List<String> suggestedSkills = List.of();
            if (report.getHonestAssessment() != null && report.getHonestAssessment().getCoverage() != null
                    && report.getHonestAssessment().getCoverage().getQuickWins() != null) {
                suggestedSkills = report.getHonestAssessment().getCoverage().getQuickWins().stream()
                        .map(HonestResumeAssessment.QuickWin::getSkill)
                        .toList();
            }

            List<String> blockingFields = List.of();
            try {
                gateService.checkGate(resumeData);
            } catch (NeedsUserInputException e) {
                blockingFields = e.getFields();
            }

            return ResponseEntity.ok(Map.of(
                    "resume", resumeData,
                    "suggestedSkills", suggestedSkills,
                    "blockingFields", blockingFields
            ));
        } catch (Exception e) {
            log.error("[ResumeGenerator] parsed() failed for reportId={}", reportId, e);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // ── Step N: generate the final resume from a verified record ─────────
    @PostMapping("/generate")
    public ResponseEntity<?> generate(@RequestBody VerifiedResumeInput input) {
        try {
            GeneratedResume generated = writerService.generate(input);
            validator.validate(generated, input);

            NormalizedResume normalized = GeneratedResumeMapper.toNormalized(generated);
            ReconstructedResume reconstructed = NormalizedResumeMapper.toReconstructed(normalized);

            return ResponseEntity.ok(Map.of(
                    "resume", reconstructed,
                    "omittedFields", generated.getOmittedFields() != null ? generated.getOmittedFields() : List.of(),
                    "unresolvedPlaceholders", generated.getUnresolvedPlaceholders() != null ? generated.getUnresolvedPlaceholders() : List.of()
            ));
        } catch (ResumeValidationException e) {
            log.warn("[ResumeGenerator] Validation failed: {}", e.getViolations());
            return ResponseEntity.status(422).body(Map.of(
                    "error", "Generated resume failed validation",
                    "violations", e.getViolations()
            ));
        } catch (Exception e) {
            log.error("[ResumeGenerator] generate() failed", e);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
