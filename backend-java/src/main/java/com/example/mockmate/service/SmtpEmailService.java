package com.example.mockmate.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Sends account emails via Gmail SMTP instead of Resend. Resend requires a
 * verified custom domain to send to anyone other than its own account
 * owner — this project has no domain, so Resend can only ever reach the
 * developer's own inbox, not real users. A personal Gmail account (with an
 * App Password) can send to any recipient today, no domain needed, in
 * exchange for a lower daily send cap (~500/day) than a real transactional
 * provider. Swap back to {@link ResendEmailService} once a domain exists.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SmtpEmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromAddress;

    // Brand palette — kept identical to frontend/src/index.css's --brand-*
    // custom properties, so the email matches the actual app instead of
    // being redesigned from scratch. Table layout + inline styles throughout
    // (not <style> in <head>, not flexbox/gradients on the button) because
    // Outlook's desktop rendering engine (Word) ignores most CSS placed in a
    // <head><style> block and most modern layout properties — the previous
    // template likely rendered broken/unstyled in exactly the clients that
    // don't support it, which is the most common reason a transactional
    // email "looks bad" despite looking fine in the browser preview.
    private static final String BRAND_PRIMARY   = "#6B46C1"; // deep purple
    private static final String BRAND_SECONDARY = "#9F7AEA"; // light purple
    private static final String BRAND_ACCENT    = "#6366F1"; // electric indigo
    private static final String BRAND_LIGHT_BG  = "#F3E8FF"; // very light purple
    private static final String INK             = "#111827"; // headings, matches app's text-[#111]
    private static final String MUTED           = "#6B7280"; // body copy
    private static final String PAGE_BG         = "#F5F3FA";

    // ── Main template ──────────────────────────────────────────────────────
    // The shared shell every account email renders through: top gradient
    // bar, 🎙️ MockMate logo, white card, footer. Individual emails only
    // supply the middle content block — this is what keeps every email
    // looking like the same product instead of a one-off design each time.
    private String mainTemplate(String contentHtml, String footerHtml) {
        return """
                <!DOCTYPE html>
                <html>
                <body style="margin:0; padding:0; background-color:%s; font-family: 'Segoe UI', Helvetica, Arial, sans-serif;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:%s; padding: 40px 16px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(107,70,193,0.12);">
                          <tr>
                            <td style="height:6px; background-color:%s; background-image:linear-gradient(90deg, %s 0%%, %s 100%%); font-size:0; line-height:0;">&nbsp;</td>
                          </tr>
                          <tr>
                            <td style="padding: 40px 40px 8px 40px;">
                              <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="font-size:20px; font-weight:800; color:%s; letter-spacing:0.5px;">
                                    🎙️ MockMate
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 24px 40px 0 40px;">
                              %s
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 36px 40px 28px 40px;">
                              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEE9F7;">
                                <tr>
                                  <td style="padding-top:20px; font-size:12px; line-height:1.5; color:#9CA3AF;">
                                    %s
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(PAGE_BG, PAGE_BG, BRAND_PRIMARY, BRAND_PRIMARY, BRAND_ACCENT,
                              BRAND_PRIMARY, contentHtml, footerHtml);
    }

    private static final String STANDARD_FOOTER =
            "© 2026 MockMate AI. All rights reserved.";

    public boolean sendWelcomeEmail(String toEmail, String fullName) {
        String displayName = (fullName != null && !fullName.isBlank()) ? fullName : "there";
        String content = """
                <h1 style="margin:0 0 16px 0; font-size:22px; line-height:1.3; color:%s; font-weight:800;">Welcome aboard, {{NAME}} 👋</h1>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6; color:%s;">Your account is ready. MockMate is your AI-powered interview prep platform — practice technical interviews, sharpen your DSA problem-solving, and get real-time feedback on your resume's ATS score.</p>
                <p style="margin:0 0 28px 0; font-size:15px; line-height:1.6; color:%s;">Jump back in whenever you're ready — your dashboard is waiting.</p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:999px; background-color:%s;">
                      <a href="https://mockmate2.vercel.app" style="display:inline-block; padding:13px 32px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:999px;">Open MockMate →</a>
                    </td>
                  </tr>
                </table>
                """.formatted(INK, MUTED, MUTED, BRAND_PRIMARY);

        String footer = "You're receiving this because an account was created with this email address on MockMate.<br>" + STANDARD_FOOTER;
        String html = mainTemplate(content, footer).replace("{{NAME}}", displayName);

        return sendEmail(toEmail, "Welcome to MockMate 🎙️", html);
    }

    public boolean sendVerificationEmail(String toEmail, String code) {
        String content = """
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:40px; height:40px; border-radius:999px; background-color:%s; text-align:center; vertical-align:middle; font-size:18px;">🔒</td>
                    <td style="padding-left:14px; font-size:20px; font-weight:800; color:%s;">Verify it's you</td>
                  </tr>
                </table>
                <p style="margin:20px 0 0 0; font-size:15px; line-height:1.6; color:%s;">Enter this code to complete your sign-in to MockMate:</p>
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td align="center" style="background-color:%s; border:1px solid %s; border-radius:12px; padding:20px;">
                      <span style="font-size:32px; font-weight:800; letter-spacing:10px; color:%s; font-family: 'Courier New', monospace;">{{CODE}}</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0; font-size:13px; line-height:1.6; color:%s;">This code expires in <strong>10 minutes</strong>.</p>
                <p style="margin:0 0 28px 0; font-size:13px; line-height:1.6; color:%s;">Didn't request this? You can safely ignore this email — no changes will be made to your account.</p>
                """.formatted(BRAND_LIGHT_BG, INK, MUTED, BRAND_LIGHT_BG, BRAND_SECONDARY, BRAND_PRIMARY, MUTED, MUTED);

        String html = mainTemplate(content, STANDARD_FOOTER).replace("{{CODE}}", code);

        return sendEmail(toEmail, "Your MockMate verification code: " + code, html);
    }

    public boolean sendEmail(String toEmail, String subject, String htmlContent) {
        if (fromAddress == null || fromAddress.isBlank()) {
            log.warn("[SmtpEmailService] GMAIL_SMTP_USERNAME not configured. Skipping email to: {}", toEmail);
            return false;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromAddress, "MockMate");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            log.info("[SmtpEmailService] Sending email to: {} | Subject: {}", toEmail, subject);
            mailSender.send(message);
            log.info("[SmtpEmailService] Email sent successfully to: {}", toEmail);
            return true;
        } catch (MailException | java.io.UnsupportedEncodingException | jakarta.mail.MessagingException e) {
            log.error("[SmtpEmailService] Failed to send email to {}: {}", toEmail, e.getMessage(), e);
            return false;
        }
    }
}
