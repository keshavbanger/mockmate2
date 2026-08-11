package com.example.mockmate.controller;

import com.example.mockmate.model.User;
import com.example.mockmate.service.SessionStoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/session")
@RequiredArgsConstructor
public class SessionController {

    private final SessionStoreService sessionStoreService;

    @PostMapping("/create")
    public ResponseEntity<?> createSession(
            @RequestBody(required = false) Map<String, Object> request,
            @AuthenticationPrincipal User user) {
        String sessionId = UUID.randomUUID().toString();
        Map<String, Object> sessionData = new HashMap<>();
        sessionData.put("status", "initialized");
        sessionData.put("created_at", System.currentTimeMillis() / 1000.0);
        // Derived from the authenticated principal, never from the request
        // body — a client-supplied user_id would let anyone claim to be
        // anyone else's session from the moment it's created.
        if (user != null) {
            sessionData.put("user_id", user.getId());
        }
        sessionStoreService.saveSession(sessionId, sessionData);

        return ResponseEntity.ok(Map.of("session_id", sessionId));
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<?> getSession(@PathVariable String sessionId, @AuthenticationPrincipal User user) {
        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        Object ownerId = session.get("user_id");
        if (ownerId != null && (user == null || !ownerId.equals(user.getId()))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("detail", "You do not have access to this session"));
        }
        return ResponseEntity.ok(session);
    }
}
