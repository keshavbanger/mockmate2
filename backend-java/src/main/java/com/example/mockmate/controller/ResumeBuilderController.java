package com.example.mockmate.controller;

import com.example.mockmate.model.ResumeBuilder;
import com.example.mockmate.model.User;
import com.example.mockmate.service.ResumeBuilderService;
import com.example.mockmate.service.ResumeAIService;
import com.example.mockmate.service.ResumeParserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

/**
 * REST controller for the Resume Builder module.
 *
 * Route convention matches the existing project:
 *   /api/resumes/**             - CRUD operations
 *   /api/resumes/{id}/duplicate - duplicate a resume
 *   /api/resumes/import         - PDF/DOCX import
 *   /api/ai/resume/summary      - AI summary generation
 *   /api/ai/resume/improve-bullet - AI bullet improvement
 *
 * Security: every handler injects {@code @AuthenticationPrincipal User user}
 * (resolved by {@code JwtAuthenticationFilter}) — user identity is NEVER
 * trusted from the request body, only from the verified JWT.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class ResumeBuilderController {

    private final ResumeBuilderService builderService;
    private final ResumeAIService      aiService;
    private final ResumeParserService  parserService;

    // ════════════════════════════════════════════════════════════════════════
    // CRUD
    // ════════════════════════════════════════════════════════════════════════

    /** List all resumes for the authenticated user. */
    @GetMapping("/api/resumes")
    public ResponseEntity<?> list(@AuthenticationPrincipal User user) {
        if (user == null) return unauthorized();
        try {
            List<ResumeBuilder> list = builderService.listForUser(user);
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            log.error("[ResumeBuilder] list failed: {}", e.getMessage());
            return error(e.getMessage());
        }
    }

    /** Create a new resume. */
    @PostMapping("/api/resumes")
    public ResponseEntity<?> create(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> body) {
        if (user == null) return unauthorized();
        try {
            ResumeBuilder created = builderService.create(user, body);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (Exception e) {
            log.error("[ResumeBuilder] create failed: {}", e.getMessage());
            return error(e.getMessage());
        }
    }

    /** Get a single resume by ID (must be owned by caller). */
    @GetMapping("/api/resumes/{id}")
    public ResponseEntity<?> get(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {
        if (user == null) return unauthorized();
        try {
            return ResponseEntity.ok(builderService.getForUser(id, user));
        } catch (Exception e) {
            log.warn("[ResumeBuilder] get id={}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /** Update (full or partial) — content, title, template, settings. */
    @PutMapping("/api/resumes/{id}")
    public ResponseEntity<?> update(
            @PathVariable String id,
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> body) {
        if (user == null) return unauthorized();
        try {
            return ResponseEntity.ok(builderService.update(id, user, body));
        } catch (Exception e) {
            log.error("[ResumeBuilder] update id={}: {}", id, e.getMessage());
            return error(e.getMessage());
        }
    }

    /** Soft-delete a resume. */
    @DeleteMapping("/api/resumes/{id}")
    public ResponseEntity<?> delete(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {
        if (user == null) return unauthorized();
        try {
            builderService.delete(id, user);
            return ResponseEntity.ok(Map.of("status", "deleted", "id", id));
        } catch (Exception e) {
            log.error("[ResumeBuilder] delete id={}: {}", id, e.getMessage());
            return error(e.getMessage());
        }
    }

    /** Duplicate a resume. */
    @PostMapping("/api/resumes/{id}/duplicate")
    public ResponseEntity<?> duplicate(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {
        if (user == null) return unauthorized();
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(builderService.duplicate(id, user));
        } catch (Exception e) {
            log.error("[ResumeBuilder] duplicate id={}: {}", id, e.getMessage());
            return error(e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Import (reuses existing ResumeParserService)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Upload a PDF or DOCX resume and parse it into structured JSON.
     * The parsed data is returned for user review — it is NOT automatically
     * saved. The user confirms it in the UI, then calls POST /api/resumes.
     */
    @PostMapping("/api/resumes/import")
    public ResponseEntity<?> importResume(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User user) {
        if (user == null) return unauthorized();
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Please upload a file"));
        }

        String contentType = file.getContentType();
        boolean isPdf  = "application/pdf".equals(contentType);
        boolean isDocx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(contentType);

        if (!isPdf && !isDocx) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only PDF and DOCX files are supported"));
        }

        try {
            byte[] bytes = file.getBytes();
            // Reuse existing ResumeParserService (PDF + AI parsing already implemented)
            var parsed = parserService.parseResumeWithGemini(bytes);
            return ResponseEntity.ok(Map.of("parsed", parsed, "status", "review_required"));
        } catch (Exception e) {
            log.error("[ResumeBuilder] import failed: {}", e.getMessage());
            return error("Failed to parse resume: " + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // AI Writing Assistant
    // ════════════════════════════════════════════════════════════════════════

    /** Generate a professional summary. */
    @PostMapping("/api/ai/resume/summary")
    public ResponseEntity<?> generateSummary(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> body) {
        if (user == null) return unauthorized();
        try {
            String result = aiService.generateSummary(
                getString(body, "jobTitle", "Professional"),
                getString(body, "yearsExp", ""),
                getString(body, "skills", ""),
                getString(body, "style", "professional")
            );
            return ResponseEntity.ok(Map.of("suggestion", result));
        } catch (Exception e) {
            log.error("[ResumeAI] generateSummary: {}", e.getMessage());
            return error(e.getMessage());
        }
    }

    /** Improve a single bullet point. */
    @PostMapping("/api/ai/resume/improve-bullet")
    public ResponseEntity<?> improveBullet(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> body) {
        if (user == null) return unauthorized();
        try {
            String result = aiService.improveBullet(
                getString(body, "original", ""),
                getString(body, "style", "professional")
            );
            return ResponseEntity.ok(Map.of("suggestion", result));
        } catch (Exception e) {
            log.error("[ResumeAI] improveBullet: {}", e.getMessage());
            return error(e.getMessage());
        }
    }

    /** Generate bullet points from job info. */
    @PostMapping("/api/ai/resume/generate-bullets")
    public ResponseEntity<?> generateBullets(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> body) {
        if (user == null) return unauthorized();
        try {
            int count = body.containsKey("count") ? ((Number) body.get("count")).intValue() : 4;
            List<String> bullets = aiService.generateBullets(
                getString(body, "jobTitle", ""),
                getString(body, "company", ""),
                getString(body, "responsibilities", ""),
                Math.min(count, 8)
            );
            return ResponseEntity.ok(Map.of("suggestions", bullets));
        } catch (Exception e) {
            log.error("[ResumeAI] generateBullets: {}", e.getMessage());
            return error(e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Helpers
    // ════════════════════════════════════════════════════════════════════════

    private ResponseEntity<Map<String, String>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Authentication required"));
    }

    private ResponseEntity<Map<String, String>> error(String message) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", message));
    }

    private String getString(Map<String, Object> map, String key, String fallback) {
        Object v = map.get(key);
        return v instanceof String s ? s : fallback;
    }
}
