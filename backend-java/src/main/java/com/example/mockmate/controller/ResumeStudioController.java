package com.example.mockmate.controller;

import com.example.mockmate.model.*;
import com.example.mockmate.service.ATSDownloadService;
import com.example.mockmate.service.ResumeHtmlGeneratorService;
import com.example.mockmate.renderer.LatexRenderer;
import com.example.mockmate.registry.TemplateRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/resume-studio")
@CrossOrigin(origins = {"http://localhost:5173","http://localhost:3000"})
@RequiredArgsConstructor
public class ResumeStudioController {

    private final ATSDownloadService atsDownloadService;
    private final ResumeHtmlGeneratorService resumeHtmlGeneratorService;
    private final LatexRenderer latexRenderer;
    private final TemplateRegistry templateRegistry;

    // -- Load reconstructed resume for editor -----------------------------------
    @GetMapping("/load/{reportId}")
    public ResponseEntity<?> load(
            @PathVariable String reportId,
            @RequestParam(defaultValue = "") String jd,
            @RequestParam(defaultValue = "classic") String template) {
        try {
            log.info("[Studio] Load reportId={} template={}", reportId, template);
            ReconstructedResume resume = atsDownloadService.loadForStudio(reportId, jd, template);
            return ResponseEntity.ok(resume);
        } catch (Exception e) {
            log.error("[Studio] Load failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // -- Save edited resume ----------------------------------------------------
    @PostMapping("/save/{reportId}")
    public ResponseEntity<Map<String, String>> save(
            @PathVariable String reportId,
            @RequestBody ReconstructedResume edited) {
        log.info("[Studio] Save reportId={}", reportId);
        atsDownloadService.saveReconstructed(reportId, edited);
        return ResponseEntity.ok(Map.of("status", "saved", "reportId", reportId));
    }

    // -- Generate DOCX from studio data ----------------------------------------
    @PostMapping("/download")
    public ResponseEntity<byte[]> download(
            @RequestBody ReconstructedResume resume,
            @RequestParam(defaultValue = "classic") String template) {
        try {
            log.info("[Studio] Download template={} name={}", template, resume.getName());
            ATSDownloadResult result = atsDownloadService.renderFromStudio(resume, template);
            String filename = sanitizeFilename(resume.getName()) + "_resume.docx";
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header("X-ATS-Score", String.valueOf(result.getValidation().getAtsScore()))
                .header("X-Critical-Fails", String.valueOf(result.getValidation().getCriticalFails().size()))
                .header("X-Major-Fails",    String.valueOf(result.getValidation().getMajorFails().size()))
                .header("X-Minor-Warnings", String.valueOf(result.getValidation().getMinorWarnings().size()))
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, "X-ATS-Score,X-Critical-Fails,X-Major-Fails,X-Minor-Warnings")
                .contentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .body(result.getDocxBytes());
        } catch (Exception e) {
            log.error("[Studio] Download failed: {}", e.getMessage());
            return ResponseEntity.status(500).build();
        }
    }

    // -- Live ATS score (local, fast, no API) ----------------------------------
    @PostMapping("/score")
    public ResponseEntity<?> score(
            @RequestBody ReconstructedResume resume,
            @RequestParam(defaultValue = "") String jd) {
        try {
            ATSScoreResult result = atsDownloadService.scoreLocally(resume, jd);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[Studio] Score failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // -- Legacy: download from report ID ---------------------------------------
    @GetMapping("/report/{reportId}/download")
    public ResponseEntity<byte[]> downloadFromReport(
            @PathVariable String reportId,
            @RequestParam(required = false, defaultValue = "") String jd,
            @RequestParam(defaultValue = "classic") String template) {
        try {
            log.info("[Studio] DownloadFromReport reportId={} template={}", reportId, template);
            ATSDownloadResult result = atsDownloadService.generate(reportId, jd, template);
            String name = result.getReconstructed() != null && result.getReconstructed().getName() != null
                ? sanitizeFilename(result.getReconstructed().getName()) : "resume";
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "_resume.docx\"")
                .header("X-ATS-Score", String.valueOf(result.getValidation().getAtsScore()))
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, "X-ATS-Score")
                .contentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .body(result.getDocxBytes());
        } catch (Exception e) {
            log.error("[Studio] DownloadFromReport failed: {}", e.getMessage());
            return ResponseEntity.status(500).build();
        }
    }

    // -- Confidence check for "Generate My Resume" flow ----------------------
    @GetMapping("/confidence/{reportId}")
    public ResponseEntity<?> confidence(
            @PathVariable String reportId,
            @RequestParam(defaultValue = "") String jd,
            @RequestParam(defaultValue = "classic") String template) {
        try {
            log.info("[Studio] Confidence check reportId={}", reportId);
            ReconstructedResume resume = atsDownloadService.loadForStudio(reportId, jd, template);
            ResumeFieldConfidence conf = resumeHtmlGeneratorService.analyzeConfidence(resume);
            return ResponseEntity.ok(Map.of(
                "confidence", conf,
                "resume",     resume
            ));
        } catch (Exception e) {
            log.error("[Studio] Confidence check failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // -- Generate beautiful HTML resume ---------------------------------------
    @PostMapping("/generate-html")
    public ResponseEntity<byte[]> generateHtml(
            @RequestBody ReconstructedResume resume,
            @RequestParam(defaultValue = "classic") String template) {
        try {
            log.info("[Studio] GenerateHtml template={} name={}", template, resume.getName());
            String html = resumeHtmlGeneratorService.generateHtml(resume, template);
            String filename = sanitizeFilename(resume.getName()) + "_resume.html";
            byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(HttpHeaders.CONTENT_TYPE, "text/html; charset=UTF-8")
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, "Content-Disposition")
                .contentType(MediaType.parseMediaType("text/html; charset=UTF-8"))
                .body(bytes);
        } catch (Exception e) {
            log.error("[Studio] GenerateHtml failed: {}", e.getMessage());
            return ResponseEntity.status(500).build();
        }
    }

    // -- Generate beautiful LaTeX resume --------------------------------------
    @PostMapping("/generate-latex")
    public ResponseEntity<byte[]> generateLatex(
            @RequestBody ReconstructedResume resume,
            @RequestParam(defaultValue = "classic") String template) {
        try {
            log.info("[Studio] GenerateLatex template={} name={}", template, resume.getName());
            NormalizedResume nr = NormalizedResumeMapper.fromReconstructed(resume);
            TemplateConfig config = templateRegistry.get(template);
            String tex = latexRenderer.renderToString(nr, config);
            String filename = sanitizeFilename(resume.getName()) + "_resume.tex";
            byte[] bytes = tex.getBytes(StandardCharsets.UTF_8);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(HttpHeaders.CONTENT_TYPE, "application/x-latex; charset=UTF-8")
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, "Content-Disposition")
                .contentType(MediaType.parseMediaType("application/x-latex; charset=UTF-8"))
                .body(bytes);
        } catch (Exception e) {
            log.error("[Studio] GenerateLatex failed: {}", e.getMessage());
            return ResponseEntity.status(500).build();
        }
    }

    // -- Generate HTML as inline string (for preview) -------------------------
    @PostMapping("/preview-html")
    public ResponseEntity<Map<String, String>> previewHtml(
            @RequestBody ReconstructedResume resume,
            @RequestParam(defaultValue = "classic") String template) {
        try {
            log.info("[Studio] PreviewHtml template={}", template);
            String html = resumeHtmlGeneratorService.generateHtml(resume, template);
            return ResponseEntity.ok(Map.of("html", html));
        } catch (Exception e) {
            log.error("[Studio] PreviewHtml failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // NEW ENDPOINT: Template switching (zero AI, <1s)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Switches the template for a resume without any AI calls.
     * Loads persisted NormalizedResume → re-renders with new template → returns DOCX.
     */
    @PutMapping("/{resumeId}/template")
    public ResponseEntity<?> switchTemplate(
            @PathVariable String resumeId,
            @RequestParam String templateId) {
        try {
            log.info("[Studio] Template switch resumeId={} newTemplate={}", resumeId, templateId);
            long start = System.currentTimeMillis();
            ATSDownloadResult result = atsDownloadService.switchTemplate(resumeId, templateId);
            long elapsed = System.currentTimeMillis() - start;
            log.info("[Studio] Template switch completed in {}ms", elapsed);

            String name = result.getReconstructed() != null && result.getReconstructed().getName() != null
                ? sanitizeFilename(result.getReconstructed().getName()) : "resume";
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "_resume.docx\"")
                .header("X-ATS-Score", String.valueOf(result.getValidation().getAtsScore()))
                .header("X-Template-Id", templateId)
                .header("X-Render-Time-Ms", String.valueOf(elapsed))
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                    "X-ATS-Score,X-Template-Id,X-Render-Time-Ms")
                .contentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .body(result.getDocxBytes());
        } catch (Exception e) {
            log.error("[Studio] Template switch failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    private String sanitizeFilename(String name) {
        if (name == null) return "resume";
        return name.trim().replaceAll("[^a-zA-Z0-9_\\-]", "_").toLowerCase();
    }
}
