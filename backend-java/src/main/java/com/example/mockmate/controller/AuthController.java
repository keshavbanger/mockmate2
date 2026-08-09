package com.example.mockmate.controller;

import com.example.mockmate.dto.request.TokenVerificationRequest;
import com.example.mockmate.dto.request.UserLoginRequest;
import com.example.mockmate.dto.request.UserSignupRequest;
import com.example.mockmate.dto.response.TokenResponse;
import com.example.mockmate.dto.response.UserResponse;
import com.example.mockmate.model.User;
import com.example.mockmate.service.AuthService;
import com.example.mockmate.service.ResendEmailService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final ResendEmailService resendEmailService;

    public AuthController(AuthService authService, ResendEmailService resendEmailService) {
        this.authService = authService;
        this.resendEmailService = resendEmailService;
    }

    @GetMapping("/trial-email")
    public ResponseEntity<java.util.Map<String, Object>> trialEmail(@RequestParam(required = false) String email) {
        String target = (email != null && !email.isBlank()) ? email.trim() : "bangerkeshav247@gmail.com";
        java.util.Map<String, Object> responseMap = new java.util.HashMap<>();
        responseMap.put("recipient", target);
        try {
            String result = resendEmailService.testWelcomeEmail(target);
            responseMap.put("status", (result != null && result.startsWith("SUCCESS")) ? "SUCCESS" : "FAIL");
            responseMap.put("resendDetails", String.valueOf(result));
        } catch (Throwable e) {
            responseMap.put("status", "ERROR");
            responseMap.put("error", e.getClass().getName() + ": " + e.getMessage());
        }
        return ResponseEntity.ok(responseMap);
    }

    @PostMapping("/verify")
    public ResponseEntity<TokenResponse> verify(@Valid @RequestBody TokenVerificationRequest request) {
        try {
            return ResponseEntity.ok(authService.verify(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    @PostMapping("/register")
    public ResponseEntity<TokenResponse> register(@Valid @RequestBody TokenVerificationRequest request) {
        try {
            return ResponseEntity.ok(authService.register(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(authService.mapToResponse(user));
    }

    @PostMapping("/signup")
    public ResponseEntity<TokenResponse> signup(@Valid @RequestBody UserSignupRequest request) {
        return ResponseEntity.ok(authService.signup(request));
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody UserLoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @DeleteMapping("/account")
    public ResponseEntity<Void> deleteAccount(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        authService.deleteAccount(user);
        return ResponseEntity.noContent().build();
    }
}
