package com.example.mockmate.controller;

import com.example.mockmate.dto.request.SendOtpRequest;
import com.example.mockmate.dto.request.TokenVerificationRequest;
import com.example.mockmate.dto.request.UserLoginRequest;
import com.example.mockmate.dto.request.UserSignupRequest;
import com.example.mockmate.dto.request.VerifyOtpRequest;
import com.example.mockmate.dto.response.OtpResponse;
import com.example.mockmate.dto.response.TokenResponse;
import com.example.mockmate.dto.response.UserResponse;
import com.example.mockmate.model.User;
import com.example.mockmate.service.AuthService;
import com.example.mockmate.service.OtpService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;
    private final OtpService otpService;

    @PostMapping("/send-otp")
    public ResponseEntity<OtpResponse> sendOtp(@Valid @RequestBody SendOtpRequest request) {
        try {
            return ResponseEntity.ok(otpService.sendOtp(request));
        } catch (IllegalArgumentException e) {
            log.warn("Validation error in sendOtp: {}", e.getMessage());
            return ResponseEntity.badRequest().body(OtpResponse.builder()
                    .success(false)
                    .message(e.getMessage())
                    .email(request.getEmail())
                    .build());
        } catch (Exception e) {
            log.error("Unhandled exception in sendOtp: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(OtpResponse.builder()
                    .success(false)
                    .message("Internal server error sending code: " + e.getMessage())
                    .email(request.getEmail())
                    .build());
        }
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<OtpResponse> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        try {
            return ResponseEntity.ok(otpService.verifyOtp(request));
        } catch (IllegalArgumentException e) {
            log.warn("Validation error in verifyOtp: {}", e.getMessage());
            return ResponseEntity.badRequest().body(OtpResponse.builder()
                    .success(false)
                    .message(e.getMessage())
                    .email(request.getEmail())
                    .build());
        } catch (Exception e) {
            log.error("Unhandled exception in verifyOtp: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(OtpResponse.builder()
                    .success(false)
                    .message("Internal server error verifying code: " + e.getMessage())
                    .email(request.getEmail())
                    .build());
        }
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

    // Account-level Interview Preferences (role/track/company/language/
    // duration) — see User.prefRoleLevel etc. Partial update: only keys
    // present in the body are touched, so the frontend can save one field
    // at a time or all five together.
    @PatchMapping("/preferences")
    public ResponseEntity<?> updatePreferences(
            @AuthenticationPrincipal User user,
            @RequestBody java.util.Map<String, Object> updates) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            return ResponseEntity.ok(authService.updatePreferences(user, updates));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    // Personal/candidate profile details (name, username, mobile, social
    // links, education, target domain/companies) — see AuthService.updateProfile.
    @PatchMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @AuthenticationPrincipal User user,
            @RequestBody java.util.Map<String, Object> updates) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            return ResponseEntity.ok(authService.updateProfile(user, updates));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PostMapping(value = "/avatar", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadAvatar(
            @AuthenticationPrincipal User user,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            return ResponseEntity.ok(authService.uploadAvatar(user, file));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        } catch (java.io.IOException e) {
            log.error("Avatar upload failed for user {}", user.getId(), e);
            return ResponseEntity.internalServerError().body(java.util.Map.of("error", "Failed to process image"));
        }
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
