package com.example.mockmate.controller;

import com.example.mockmate.model.ATSReport;
import com.example.mockmate.service.ATSAnalyzerService;
import com.example.mockmate.service.ATSCompareService;
import com.example.mockmate.service.ATSDownloadService;
import com.example.mockmate.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/ats")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class ATSController {

    private final ATSAnalyzerService atsAnalyzerService;
    private final ATSDownloadService atsDownloadService;
    private final ATSCompareService  atsCompareService;
    private final JwtUtil            jwtUtil;

    // ── POST /api/ats/analyze ──────────────────────────────────────────────────────
    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> analyze(
            @RequestParam("file")   MultipartFile file,
            @RequestParam("jdText") String jdText,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String userId = resolveUserId(authHeader);
        log.info("[ATS] /analyze userId={} file={} jdLen={}", userId, file.getOriginalFilename(), jdText.length());

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Resume file is required"));
        }
        if (jdText == null || jdText.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Job description text is required"));
        }
        if (jdText.length() < 50) {
            return ResponseEntity.badRequest().body(Map.of("error", "Job description is too short — please paste the full JD"));
        }

        String name = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only PDF and DOCX files are supported"));
        }

        try {
            ATSReport report = atsAnalyzerService.analyze(file, jdText, userId);
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
        return ResponseEntity.ok(report.get());
    }

    // ── GET /api/ats/report/{reportId}/download ───────────────────────────────────
    @GetMapping("/report/{reportId}/download")
    public ResponseEntity<byte[]> downloadImproved(@PathVariable String reportId) {
        log.info("[ATS] /download reportId={}", reportId);
        try {
            byte[] docxBytes = atsDownloadService.generate(reportId);
            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"improved_resume.docx\"")
                    .contentType(org.springframework.http.MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                    .body(docxBytes);
        } catch (Exception e) {
            log.error("[ATS] Download failed for reportId={}", reportId, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // ── GET /api/ats/history/{userId} ─────────────────────────────────────────────
    @GetMapping("/history/{userId}")
    public ResponseEntity<?> getHistory(
            @PathVariable String userId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        List<ATSReport> history = atsAnalyzerService.getHistory(userId);
        return ResponseEntity.ok(Map.of("reports", history, "count", history.size()));
    }

    // ── POST /api/ats/compare ─────────────────────────────────────────────────────
    @PostMapping(value = "/compare", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> compare(
            @RequestParam("fileA")  MultipartFile fileA,
            @RequestParam("fileB")  MultipartFile fileB,
            @RequestParam("jdText") String jdText,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String userId = resolveUserId(authHeader);
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

    // ── Helper: extract userId from JWT or fall back to "anonymous" ───────────────
    private String resolveUserId(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            try {
                return jwtUtil.extractEmail(authHeader.substring(7));
            } catch (Exception e) {
                log.debug("[ATS] Could not resolve userId from token: {}", e.getMessage());
            }
        }
        return "anonymous";
    }
}
