package com.example.mockmate.controller;

import com.example.mockmate.service.SessionStoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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
    public ResponseEntity<?> createSession() {
        String sessionId = UUID.randomUUID().toString();
        Map<String, Object> sessionData = new HashMap<>();
        sessionData.put("status", "initialized");
        sessionData.put("created_at", System.currentTimeMillis() / 1000.0);
        sessionStoreService.saveSession(sessionId, sessionData);
        
        return ResponseEntity.ok(Map.of("session_id", sessionId));
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<?> getSession(@PathVariable String sessionId) {
        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(session);
    }
}
