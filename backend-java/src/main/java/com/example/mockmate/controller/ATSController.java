package com.example.mockmate.controller;

import com.example.mockmate.model.ATSReport;
import com.example.mockmate.service.ATSAnalyzerService;
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
@RequiredArgsConstructor
public class ATSController {

    private final ATSAnalyzerService atsAnalyzerService;
    private final JwtUtil            jwtUtil;

    // ── POST /api/ats/analyze ──────────────────────────────────────────────────
    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> analyze(
            @RequestParam("file")   MultipartFile file,
            @RequestParam("jdText") String jdText,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String userId = resolveUserId(authHeader);
        log.info("[ATS] /analyze → userId={} file={} jdLen={}", userId, file.getOriginalFilename(), jdText.length());

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Resume file is required"));
        }
        if (jdText == null || jdText.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Job description text is required"));
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

    // ── GET /api/ats/report/{reportId} ────────────────────────────────────────
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

    // ── GET /api/ats/history/{userId} ─────────────────────────────────────────
    @GetMapping("/history/{userId}")
    public ResponseEntity<?> getHistory(
            @PathVariable String userId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        List<ATSReport> history = atsAnalyzerService.getHistory(userId);
        return ResponseEntity.ok(Map.of("reports", history, "count", history.size()));
    }

    // ── Helper: extract userId from JWT or fall back to "anonymous" ────────────
    private String resolveUserId(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            try {
                String token = authHeader.substring(7);
                return jwtUtil.extractEmail(token);
            } catch (Exception e) {
                log.debug("Could not resolve userId from token: {}", e.getMessage());
            }
        }
        return "anonymous";
    }
}
