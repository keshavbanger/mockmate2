package com.example.mockmate.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class ResendEmailService {

    private final String apiKey;
    private final String fromEmail;
    private final RestClient restClient;
    private final SendGridEmailService sendGridEmailService;

    public ResendEmailService(
            @Value("${resend.api-key:}") String apiKey,
            @Value("${resend.from-email:MockMate <noreply@mockmate.live>}") String fromEmail,
            SendGridEmailService sendGridEmailService) {
        this.apiKey = apiKey;
        this.fromEmail = (fromEmail != null && !fromEmail.isBlank()) ? fromEmail : "MockMate <noreply@mockmate.live>";
        this.sendGridEmailService = sendGridEmailService;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        requestFactory.setReadTimeout((int) Duration.ofSeconds(10).toMillis());

        this.restClient = RestClient.builder()
                .baseUrl("https://api.resend.com")
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .requestFactory(requestFactory)
                .build();
    }

    public boolean sendWelcomeEmail(String toEmail, String fullName) {
        String displayName = (fullName != null && !fullName.isBlank()) ? fullName : "Developer";
        String template = """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; margin: 0; padding: 40px 20px; }
                .card { max-width: 560px; margin: 0 auto; background: #151d30; border-radius: 20px; padding: 40px; border: 1px solid #23304a; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
                .logo { font-size: 24px; font-weight: 900; color: #818cf8; margin-bottom: 28px; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block; }
                h1 { color: #ffffff; font-size: 24px; font-weight: 800; margin-bottom: 16px; line-height: 1.3; }
                p { color: #94a3b8; font-size: 15px; line-height: 1.7; margin-bottom: 24px; }
                .btn { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 14px 34px; border-radius: 99px; font-weight: 700; font-size: 15px; shadow: 0 10px 20px rgba(99,102,241,0.3); }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #23304a; color: #64748b; font-size: 13px; line-height: 1.5; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="logo">🎙️ MOCKMATE AI</div>
                <h1>Welcome to MockMate, {{NAME}}! 🚀</h1>
                <p>We are thrilled to have you onboard! MockMate is your ultimate AI-powered interview preparation platform, built to sharpen your DSA problem-solving skills, system design confidence, and resume ATS score.</p>
                <p>Start practicing mock AI interviews, receiving instant structured feedback, and taking your tech career to the next level today.</p>
                <a href="https://mockmate.live" class="btn">Launch MockMate App →</a>
                <div class="footer">
                  Sent from <strong>mockmate.live</strong><br>
                  © 2026 MockMate AI. All rights reserved.
                </div>
              </div>
            </body>
            </html>
            """;

        String htmlContent = template.replace("{{NAME}}", displayName);
        return sendEmail(toEmail, "Welcome to MockMate AI 🚀", htmlContent);
    }

    public boolean sendVerificationEmail(String toEmail, String code) {
        String template = """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; margin: 0; padding: 40px 20px; }
                .card { max-width: 560px; margin: 0 auto; background: #151d30; border-radius: 20px; padding: 40px; border: 1px solid #23304a; box-shadow: 0 20px 40px rgba(0,0,0,0.6); text-align: center; }
                .logo { font-size: 24px; font-weight: 900; color: #818cf8; margin-bottom: 28px; text-transform: uppercase; letter-spacing: 1.5px; }
                h1 { color: #ffffff; font-size: 22px; font-weight: 800; margin-bottom: 12px; }
                p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
                .code-box { background: #0b0f19; border: 2px dashed #6366f1; border-radius: 14px; padding: 20px; text-align: center; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #a855f7; margin: 24px 0; font-family: 'Courier New', monospace; }
                .expiry { color: #f43f5e; font-weight: 600; font-size: 13px; margin-top: 12px; }
                .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #23304a; color: #64748b; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="logo">🎙️ MOCKMATE AI</div>
                <h1>Verification Code 🔒</h1>
                <p>Use the 6-digit verification code below to verify your email address and complete your MockMate sign up:</p>
                <div class="code-box">{{CODE}}</div>
                <div class="expiry">⏱️ This code will expire in 10 minutes.</div>
                <div class="footer">
                  If you did not request this verification code, you can safely ignore this email.<br>
                  Sent securely via <strong>mockmate.live</strong>
                </div>
              </div>
            </body>
            </html>
            """;

        String htmlContent = template.replace("{{CODE}}", code);
        return sendEmail(toEmail, "Your MockMate Verification Code: " + code, htmlContent);
    }

    public boolean sendEmail(String toEmail, String subject, String htmlContent) {
        if (apiKey != null && !apiKey.isBlank()) {
            try {
                Map<String, Object> payload = Map.of(
                        "from", fromEmail,
                        "to", List.of(toEmail),
                        "subject", subject,
                        "html", htmlContent
                );

                log.info("[ResendEmailService] Sending email via Resend ({}) to: {} | Subject: {}", fromEmail, toEmail, subject);

                String response = restClient.post()
                        .uri("/emails")
                        .body(payload)
                        .retrieve()
                        .body(String.class);

                log.info("[ResendEmailService] Resend email sent successfully. Response: {}", response);
                return true;
            } catch (Exception e) {
                log.error("[ResendEmailService] Error sending email via Resend to {}: {}. Falling back to SendGrid if configured...", toEmail, e.getMessage());
            }
        } else {
            log.warn("[ResendEmailService] RESEND_API_KEY is not set. Checking SendGrid fallback...");
        }

        // Fallback to SendGrid if configured
        if (sendGridEmailService != null) {
            return sendGridEmailService.sendEmail(toEmail, subject, htmlContent);
        }
        return false;
    }
}
