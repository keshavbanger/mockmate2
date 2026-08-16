package com.example.mockmate.service;

import com.example.mockmate.dto.request.SendOtpRequest;
import com.example.mockmate.dto.request.VerifyOtpRequest;
import com.example.mockmate.dto.response.OtpResponse;
import com.example.mockmate.model.EmailVerificationOtp;
import com.example.mockmate.repository.EmailVerificationOtpRepository;
import com.example.mockmate.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
@Slf4j
@RequiredArgsConstructor
public class OtpService {

    private final EmailVerificationOtpRepository otpRepository;
    private final UserRepository userRepository;
    private final ResendEmailService resendEmailService;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public OtpResponse sendOtp(SendOtpRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        String purpose = request.getPurpose() != null ? request.getPurpose().toUpperCase() : "SIGNUP";

        if ("SIGNUP".equals(purpose) && userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("An account with this email already exists. Please log in instead.");
        }
        if ("RESET_PASSWORD".equals(purpose) && !userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("No account found with this email address.");
        }

        // Generate 6-digit numeric OTP
        String otpCode = String.format("%06d", random.nextInt(1000000));

        // Invalidate old OTPs for this email
        try {
            otpRepository.deleteByEmail(email);
        } catch (Exception e) {
            log.warn("Could not cleanup old OTPs for {}: {}", email, e.getMessage());
        }

        EmailVerificationOtp otp = EmailVerificationOtp.builder()
                .email(email)
                .otpCode(otpCode)
                .purpose(purpose)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .isUsed(false)
                .build();

        otpRepository.save(otp);

        // Send email via Resend (mockmate.live) asynchronously
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            boolean sent = resendEmailService.sendVerificationEmail(email, otpCode);
            log.info("OTP email sent result for {}: {}", email, sent);
        });

        return OtpResponse.builder()
                .success(true)
                .message("Verification code sent to " + email)
                .email(email)
                .build();
    }

    @Transactional
    public OtpResponse verifyOtp(VerifyOtpRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        String purpose = request.getPurpose() != null ? request.getPurpose().toUpperCase() : "SIGNUP";
        String inputCode = request.getOtpCode() != null ? request.getOtpCode().trim() : "";

        EmailVerificationOtp otp = otpRepository
                .findTopByEmailAndPurposeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                        email, purpose, LocalDateTime.now())
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired OTP code. Please request a new code."));

        if (!otp.getOtpCode().equals(inputCode)) {
            throw new IllegalArgumentException("Incorrect OTP code. Please check your email and try again.");
        }

        otp.setUsed(true);
        otpRepository.save(otp);

        return OtpResponse.builder()
                .success(true)
                .message("Email verified successfully")
                .email(email)
                .build();
    }
}
