package com.example.mockmate.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class ResendEmailService {

    private final String apiKey;
    private final String fromEmail;
    private final RestClient restClient;

    public ResendEmailService(
            @Value("${resend.api-key:}") String apiKey,
            @Value("${resend.from-email:MockMate <onboarding@resend.dev>}") String fromEmail) {
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
        this.restClient = RestClient.builder()
                .baseUrl("https://api.resend.com")
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public boolean sendWelcomeEmail(String toEmail, String fullName) {
        try {
            if (apiKey == null || apiKey.isBlank()) {
                log.warn("[ResendEmailService] RESEND_API_KEY not configured. Skipping welcome email to: {}", toEmail);
                return false;
            }

            String displayName = (fullName != null && !fullName.isBlank()) ? fullName : "Developer";
            String template = """
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
                    .card { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                    .logo { font-size: 24px; font-weight: 800; color: #6366f1; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px; }
                    h1 { color: #f8fafc; font-size: 22px; margin-bottom: 16px; }
                    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 20px; }
                    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 8px; }
                    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #334155; color: #64748b; font-size: 12px; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <div class="logo">🚀 MockMate</div>
                    <h1>Welcome to MockMate, {{NAME}}! 👋</h1>
                    <p>We're thrilled to have you onboard! MockMate is your ultimate AI-powered interview prep platform, built to sharpen your DSA problem-solving, system design, and resume ATS score.</p>
                    <p>Start practicing tech interviews, receiving real-time AI feedback, and leveling up your career today.</p>
                    <a href="https://mockmate2.vercel.app" class="btn">Launch MockMate App</a>
                    <div class="footer">
                      © 2026 MockMate AI. All rights reserved.
                    </div>
                  </div>
                </body>
                </html>
                """;

            String htmlContent = template.replace("{{NAME}}", displayName);
            return sendEmail(toEmail, "Welcome to MockMate! 🚀", htmlContent);
        } catch (Exception e) {
            log.error("[ResendEmailService] Unexpected error in sendWelcomeEmail to {}: {}", toEmail, e.getMessage(), e);
            return false;
        }
    }

    public boolean sendVerificationEmail(String toEmail, String code) {
        try {
            if (apiKey == null || apiKey.isBlank()) {
                log.warn("[ResendEmailService] RESEND_API_KEY not configured. Skipping verification email to: {}", toEmail);
                return false;
            }

            String template = """
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
                    .card { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; }
                    .code-box { background: #0f172a; border: 1px dashed #6366f1; border-radius: 8px; padding: 16px; text-align: center; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #818cf8; margin: 24px 0; }
                    p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <h2 style="color:#f8fafc;">Verify Your MockMate Account</h2>
                    <p>Use the verification code below to complete your authentication request:</p>
                    <div class="code-box">{{CODE}}</div>
                    <p>This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
                  </div>
                </body>
                </html>
                """;

            String htmlContent = template.replace("{{CODE}}", code);
            return sendEmail(toEmail, "Your MockMate Verification Code: " + code, htmlContent);
        } catch (Exception e) {
            log.error("[ResendEmailService] Unexpected error in sendVerificationEmail to {}: {}", toEmail, e.getMessage(), e);
            return false;
        }
    }

    public boolean sendEmail(String toEmail, String subject, String htmlContent) {
        try {
            Map<String, Object> payload = Map.of(
                    "from", fromEmail,
                    "to", List.of(toEmail),
                    "subject", subject,
                    "html", htmlContent
            );

            log.info("[ResendEmailService] Sending email to: {} | Subject: {}", toEmail, subject);

            String response = restClient.post()
                    .uri("/emails")
                    .body(payload)
                    .retrieve()
                    .body(String.class);

            log.info("[ResendEmailService] Email sent successfully. Response: {}", response);
            return true;
        } catch (Exception e) {
            log.error("[ResendEmailService] Failed to send email to: {}. Error: {}", toEmail, e.getMessage());
            return false;
        }
    }
}
