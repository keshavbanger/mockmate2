package com.example.mockmate.aiengine;

import com.example.mockmate.model.User;
import com.example.mockmate.service.SessionStoreService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * AI Interview Engine (BETA, no Tavus) — a self-contained, isolated
 * parallel feature. Does not modify or call TavusService/InterviewController
 * in any way; the existing Tavus-based AI Mock Interview is untouched.
 *
 * Reuses SessionStoreService (same session store the Tavus flow and
 * Technical Interview Lab already use) so /api/session/create,
 * /api/parse-resume, /api/generate-questions, and /api/generate-report all
 * work unmodified against sessions created here.
 */
@Slf4j
@RestController
@RequestMapping("/api/ai-engine")
@RequiredArgsConstructor
public class AiInterviewEngineController {

    private final SessionStoreService sessionStoreService;
    private final InterviewEngineService interviewEngineService;
    private final SpeechToTextProvider speechToTextProvider;

    private ResponseEntity<?> ownershipError() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("detail", "You do not have access to this session"));
    }

    private boolean isOwnedByOther(Map<String, Object> session, User user) {
        Object ownerId = session.get("user_id");
        if (ownerId == null) return false;
        if (user == null) return true;
        return !ownerId.equals(user.getId());
    }

    // Same paid-plan-or-admin gate InterviewController.startInterview already
    // uses for the real AI Mock Interview — this beta feature isn't linked
    // from any nav menu, but should still behave like the feature it may
    // one day replace rather than being an accidental free bypass.
    private boolean hasAccess(User user) {
        return user != null && (user.getPlanType() == User.PlanType.PRO || user.getRole() == User.UserRole.ADMIN);
    }

    @PostMapping("/{sessionId}/start")
    public ResponseEntity<?> start(
            @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, Object> request,
            @AuthenticationPrincipal User user) {
        if (!hasAccess(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("detail", "Upgrade to a paid plan to access AI Mock Interviews", "code", "PLAN_REQUIRED"));
        }
        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }
        if (isOwnedByOther(session, user)) {
            return ownershipError();
        }
        session.put("user_id", user.getId());

        // Full interview config arrives here and nowhere else — the beta flow
        // no longer pre-calls /api/generate-questions, so this is the single
        // entry point for a new adaptive interview (B1.2).
        Map<String, Object> result = interviewEngineService.start(sessionId, session,
                request != null ? request : Map.of());
        if (Boolean.FALSE.equals(result.get("success"))) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(result);
        }
        return ResponseEntity.ok(result);
    }

    // Multipart audio in, { transcript } out. Deliberately does NOT write a
    // turn (unlike the existing /api/save-audio-turn) — turn-writing happens
    // in handleMessage() below, after classification, so REPEAT/CLARIFICATION
    // turns never get mistaken for a scored answer.
    @PostMapping(value = "/{sessionId}/transcribe", consumes = "multipart/form-data")
    public ResponseEntity<?> transcribe(
            @PathVariable String sessionId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User user) {
        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }
        if (isOwnedByOther(session, user)) {
            return ownershipError();
        }
        try {
            String transcript = speechToTextProvider.transcribe(file.getBytes(), file.getOriginalFilename());
            return ResponseEntity.ok(Map.of("transcript", transcript == null ? "" : transcript));
        } catch (Exception e) {
            log.error("[AI Engine] Transcription failed for session {}", sessionId, e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false, "error", "STT_FAILED", "message", "Could not transcribe audio. Please try again."));
        }
    }

    @PostMapping("/{sessionId}/message")
    public ResponseEntity<?> message(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal User user) {
        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }
        if (isOwnedByOther(session, user)) {
            return ownershipError();
        }
        String message = (String) request.get("message");
        if (message == null || message.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Missing message"));
        }
        try {
            Map<String, Object> result = interviewEngineService.handleMessage(sessionId, session, message);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[AI Engine] handleMessage failed for session {}", sessionId, e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false, "error", "AI_PROVIDER_UNAVAILABLE", "message", "The AI interviewer is temporarily unavailable."));
        }
    }

    @PostMapping("/{sessionId}/end")
    public ResponseEntity<?> end(@PathVariable String sessionId, @AuthenticationPrincipal User user) {
        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }
        if (isOwnedByOther(session, user)) {
            return ownershipError();
        }
        return ResponseEntity.ok(interviewEngineService.end(sessionId, session));
    }

    @GetMapping("/{sessionId}/status")
    public ResponseEntity<?> status(@PathVariable String sessionId, @AuthenticationPrincipal User user) {
        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }
        if (isOwnedByOther(session, user)) {
            return ownershipError();
        }
        List<?> questions = (List<?>) session.getOrDefault("questions", List.of());
        return ResponseEntity.ok(Map.of(
                "status", session.getOrDefault("status", "unknown"),
                "questionsAsked", questions.size(),
                "area", session.getOrDefault("current_area", "introduction")
        ));
    }
}
