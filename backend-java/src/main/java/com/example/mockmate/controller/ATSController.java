package com.example.mockmate.controller;

import com.example.mockmate.model.ATSReport;
import com.example.mockmate.model.SavedResume;
import com.example.mockmate.model.User;
import com.example.mockmate.service.ATSAnalyzerService;
import com.example.mockmate.service.ATSCompareService;
import com.example.mockmate.service.ATSDownloadService;
import com.example.mockmate.service.SavedResumeService;
import com.example.mockmate.security.AtsReportAccessGuard;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/ats")
@RequiredArgsConstructor
public class ATSController {

    private final ATSAnalyzerService atsAnalyzerService;
    private final ATSDownloadService atsDownloadService;
    private final ATSCompareService  atsCompareService;
    private final AtsReportAccessGuard accessGuard;
    private final SavedResumeService savedResumeService;

    // ── POST /api/ats/analyze ──────────────────────────────────────────────────────
    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> analyze(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam("jdText") String jdText,
            // Reuse a previously saved resume instead of re-uploading — see
            // SavedResumeController. When present, `file` is ignored.
            @RequestParam(value = "savedResumeId", required = false) String savedResumeId,
            @RequestParam(value = "saveAsResume", required = false, defaultValue = "false") boolean saveAsResume,
            @RequestParam(value = "label", required = false) String label,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @AuthenticationPrincipal User user) {

        // NOTE: ATS reports/history are owned by the caller's JWT EMAIL (via
        // accessGuard — this endpoint also supports anonymous scans, unlike
        // the other 3 saved-resume call sites), but SavedResume rows are
        // always keyed by the real User UUID (user.getId()), same as every
        // other controller that reads/writes them. Mixing the two here is
        // what caused "Saved resume not found" for a resume that genuinely
        // existed and listed correctly — the lookup was querying by email
        // against rows keyed by UUID. Use `userId` (email) ONLY for
        // ATSReport/AtsAnalysis ownership below; use `user.getId()` for
        // every SavedResumeService call.
        String userId = accessGuard.resolveUserId(authHeader);
        boolean usingSavedResume = savedResumeId != null && !savedResumeId.isBlank();
        log.info("[ATS] /analyze userId={} file={} savedResumeId={} jdLen={}",
                userId, usingSavedResume ? null : (file != null ? file.getOriginalFilename() : null), savedResumeId, jdText.length());

        if (jdText == null || jdText.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Job description text is required"));
        }
        if (jdText.length() < 50) {
            return ResponseEntity.badRequest().body(Map.of("error", "Job description is too short — please paste the full JD"));
        }

        if (usingSavedResume) {
            if (user == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Authentication required to use a saved resume"));
            }
            try {
                SavedResume saved = savedResumeService.get(user.getId(), savedResumeId);
                ATSReport report = atsAnalyzerService.analyzeText(saved.getRawText(), saved.getFileName(), jdText, userId);
                return ResponseEntity.ok(report);
            } catch (NoSuchElementException e) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
            } catch (Exception e) {
                log.error("[ATS] Analysis from saved resume failed", e);
                return ResponseEntity.internalServerError().body(Map.of("error", "Analysis failed: " + e.getMessage()));
            }
        }

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Resume file is required"));
        }

        String name = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only PDF and DOCX files are supported"));
        }

        try {
            ATSReport report = atsAnalyzerService.analyze(file, jdText, userId);
            if (saveAsResume && user != null) {
                try {
                    savedResumeService.upload(user.getId(), file, label, false);
                } catch (Exception e) {
                    log.warn("Failed to save resume for reuse (user {}): {}", userId, e.getMessage());
                }
            }
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            log.error("[ATS] Analysis failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Analysis failed: " + e.getMessage()));
        }
    }

    // ── GET /api/ats/report/{reportId} ────────────────────────────────────────────
    @GetMapping("/report/{reportId}")
    public ResponseEntity<?> getReport(
            @PathVariable String reportId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<ATSReport> report = atsAnalyzerService.getReport(reportId);
        if (report.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        if (!accessGuard.isOwnedByCaller(report.get(), authHeader)) {
            return ResponseEntity.status(403).body(Map.of("error", "You do not have access to this report"));
        }
        return ResponseEntity.ok(report.get());
    }

    // ── GET /api/ats/report/{reportId}/download ───────────────────────────────────
    @GetMapping("/report/{reportId}/download")
    public ResponseEntity<byte[]> downloadImproved(
            @PathVariable String reportId,
            @RequestParam(required = false, defaultValue = "") String jd,
            @RequestParam(required = false, defaultValue = "classic") String template,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        log.info("[ATS] /download reportId={} template={}", reportId, template);

        Optional<ATSReport> existing = atsAnalyzerService.getReport(reportId);
        if (existing.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        if (!accessGuard.isOwnedByCaller(existing.get(), authHeader)) {
            return ResponseEntity.status(403).build();
        }

        try {
            com.example.mockmate.model.ATSDownloadResult result =
                atsDownloadService.generate(reportId, jd, template);
            String name = result.getReconstructed() != null && result.getReconstructed().getName() != null
                ? result.getReconstructed().getName().trim().replaceAll("[^a-zA-Z0-9_\\-]","_").toLowerCase()
                : "improved";
            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + name + "_resume.docx\"")
                    .header("X-ATS-Score", String.valueOf(result.getValidation().getAtsScore()))
                    .header(org.springframework.http.HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, "X-ATS-Score")
                    .contentType(org.springframework.http.MediaType.parseMediaType(
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                    .body(result.getDocxBytes());
        } catch (Exception e) {
            log.error("[ATS] Download failed for reportId={}", reportId, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // ── GET /api/ats/history/{userId} ─────────────────────────────────────────────
    // Note: {userId} in the path is NOT trusted — history is always scoped to the
    // caller's own identity as resolved from their JWT, to prevent one user from
    // reading another user's report history by guessing/enumerating userIds.
    @GetMapping("/history/{userId}")
    public ResponseEntity<?> getHistory(
            @PathVariable String userId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String callerId = accessGuard.resolveUserId(authHeader);
        if ("anonymous".equals(callerId)) {
            return ResponseEntity.status(401).body(Map.of("error", "Login required to view report history"));
        }

        List<ATSReport> history = atsAnalyzerService.getHistory(callerId);
        return ResponseEntity.ok(Map.of("reports", history, "count", history.size()));
    }

    // ── POST /api/ats/compare ─────────────────────────────────────────────────────
    @PostMapping(value = "/compare", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> compare(
            @RequestParam("fileA")  MultipartFile fileA,
            @RequestParam("fileB")  MultipartFile fileB,
            @RequestParam("jdText") String jdText,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String userId = accessGuard.resolveUserId(authHeader);
        log.info("[ATS] /compare userId={} fileA={} fileB={}", userId,
                fileA.getOriginalFilename(), fileB.getOriginalFilename());

        if (fileA.isEmpty() || fileB.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Both resume files are required"));
        }
        if (jdText == null || jdText.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Job description is required"));
        }

        try {
            ATSCompareService.ATSCompareResult result =
                    atsCompareService.compare(fileA, fileB, jdText, userId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[ATS] Compare failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Compare failed: " + e.getMessage()));
        }
    }
}
