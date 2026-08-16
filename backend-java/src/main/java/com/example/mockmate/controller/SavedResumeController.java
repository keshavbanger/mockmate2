package com.example.mockmate.controller;

import com.example.mockmate.model.SavedResume;
import com.example.mockmate.model.User;
import com.example.mockmate.service.SavedResumeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * REST surface for the user's saved resume(s) — upload once, reuse across
 * Mock Interview, Technical Interview Lab, ATS Checker, and Resume Builder.
 *
 * Security: every handler injects {@code @AuthenticationPrincipal User user}
 * (resolved by JwtAuthenticationFilter) — matches the ownership pattern
 * already used by ResumeBuilderController.
 */
@Slf4j
@RestController
@RequestMapping("/api/resumes/saved")
@RequiredArgsConstructor
public class SavedResumeController {

    private final SavedResumeService savedResumeService;

    @PostMapping
    public ResponseEntity<?> upload(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "label", required = false) String label,
            @RequestParam(value = "setAsDefault", required = false, defaultValue = "false") boolean setAsDefault) {
        if (user == null) return unauthorized();
        try {
            SavedResume saved = savedResumeService.upload(user.getId(), file, label, setAsDefault);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("[SavedResume] upload failed for user {}: {}", user.getId(), e.getMessage());
            return error("Failed to save resume: " + e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal User user) {
        if (user == null) return unauthorized();
        return ResponseEntity.ok(savedResumeService.list(user.getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id, @AuthenticationPrincipal User user) {
        if (user == null) return unauthorized();
        try {
            return ResponseEntity.ok(savedResumeService.get(user.getId(), id));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable String id,
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> body) {
        if (user == null) return unauthorized();
        try {
            SavedResume resume;
            if (body.containsKey("label")) {
                resume = savedResumeService.rename(user.getId(), id, String.valueOf(body.get("label")));
            } else {
                resume = savedResumeService.get(user.getId(), id);
            }
            if (Boolean.TRUE.equals(body.get("setAsDefault"))) {
                resume = savedResumeService.setDefault(user.getId(), id);
            }
            return ResponseEntity.ok(resume);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, @AuthenticationPrincipal User user) {
        if (user == null) return unauthorized();
        try {
            savedResumeService.delete(user.getId(), id);
            return ResponseEntity.ok(Map.of("status", "deleted", "id", id));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Authentication required"));
    }

    private ResponseEntity<?> error(String message) {
        return ResponseEntity.internalServerError().body(Map.of("error", message));
    }
}
