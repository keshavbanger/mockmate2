package com.example.mockmate.renderer;

import com.example.mockmate.model.NormalizedResume;
import com.example.mockmate.model.NormalizedResume.*;
import com.example.mockmate.model.TemplateConfig;
import com.example.mockmate.model.TemplateConfig.BorderStyle;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * HtmlRenderer — produces a self-contained HTML resume from NormalizedResume.
 * <p>
 * Migrated from ResumeHtmlGeneratorService (HTML generation part only).
 * Used for both browser preview (srcDoc iframe) AND PDF compilation.
 * Print-ready with @media print styles.
 * <p>
 * Never calls Groq. Never modifies the NormalizedResume.
 */
@Slf4j
@Service("htmlRenderer")
public class HtmlRenderer implements IResumeRenderer {

    @Override
    public byte[] renderToBytes(NormalizedResume resume, TemplateConfig config) {
        return renderToString(resume, config).getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public String renderToString(NormalizedResume resume, TemplateConfig config) {
        log.info("[HtmlRenderer] Generating HTML for name={} accent={}",
                resume.getName(), config.getColorAccent());

        String css  = buildCss(config, config.getTemplateId() != null ? config.getTemplateId() : "");
        StringBuilder body = new StringBuilder();

        body.append("<div class='resume'>");

        // ── Header ──
        body.append("<header class='resume-header'>");
        body.append("<h1 class='resume-name'>").append(esc(resume.getName())).append("</h1>");
        if (notBlank(resume.getJobTitle()))
            body.append("<p class='resume-title'>").append(esc(resume.getJobTitle())).append("</p>");
        // Plain text, no emoji/icon glyphs — emoji render inconsistently
        // across PDF fonts and break older ATS parsers. LinkedIn/GitHub show
        // their full visible URL rather than link-text like "LinkedIn", so
        // the address survives even if links get stripped during parsing.
        List<String> contacts = new ArrayList<>();
        if (notBlank(resume.getEmail()))    contacts.add(esc(resume.getEmail()));
        if (notBlank(resume.getPhone()))    contacts.add(esc(resume.getPhone()));
        if (notBlank(resume.getLocation())) contacts.add(esc(resume.getLocation()));
        if (notBlank(resume.getLinkedin())) contacts.add("<a href='" + esc(resume.getLinkedin()) + "' target='_blank'>" + esc(displayUrl(resume.getLinkedin())) + "</a>");
        if (notBlank(resume.getGithub()))   contacts.add("<a href='" + esc(resume.getGithub()) + "' target='_blank'>" + esc(displayUrl(resume.getGithub())) + "</a>");
        body.append("<p class='resume-contact'>").append(String.join(" | ", contacts)).append("</p>");
        body.append("</header>");

        // ── Professional Summary ──
        if (notBlank(resume.getProfessionalSummary())) {
            body.append(sectionHeader("Professional Summary"));
            body.append("<p class='resume-summary'>").append(esc(resume.getProfessionalSummary())).append("</p>");
        }

        // ── Education ──
        if (resume.getEducation() != null) {
            NEducationEntry edu = resume.getEducation();
            body.append(sectionHeader("Education"));
            body.append("<div class='entry'>");
            body.append("<div class='entry-header'><span class='entry-title'>").append(esc(edu.getInstitution())).append("</span>");
            body.append("<span class='entry-date'>").append(esc(edu.getYear())).append("</span></div>");
            body.append("<span class='entry-sub'>").append(esc(edu.getDegree())).append("</span>");
            if (notBlank(edu.getCgpa()))
                body.append(" &nbsp;·&nbsp; <span class='entry-meta'>CGPA: ").append(esc(edu.getCgpa())).append("</span>");
            if (edu.getRelevantCoursework() != null && !edu.getRelevantCoursework().isEmpty())
                body.append("<p class='entry-meta'>Coursework: ").append(String.join(", ", edu.getRelevantCoursework())).append("</p>");
            body.append("</div>");
        }

        // ── Technical Skills ──
        if (resume.getSkills() != null && !resume.getSkills().isEmpty()) {
            body.append(sectionHeader("Technical Skills"));
            body.append("<table class='skills-table'>");
            for (NSkillCategory sk : resume.getSkills()) {
                body.append("<tr><td class='skill-label'>").append(esc(sk.getLabel())).append("</td>");
                body.append("<td class='skill-value'>").append(esc(sk.getValue())).append("</td></tr>");
            }
            body.append("</table>");
        }

        // ── Experience ──
        if (resume.getExperience() != null && !resume.getExperience().isEmpty()) {
            body.append(sectionHeader("Experience"));
            for (NExperienceEntry exp : resume.getExperience()) {
                body.append("<div class='entry'>");
                body.append("<div class='entry-header'><span class='entry-title'>").append(esc(exp.getRole())).append("</span>");
                body.append("<span class='entry-date'>").append(esc(exp.getDuration())).append("</span></div>");
                body.append("<span class='entry-sub'>").append(esc(exp.getCompany()));
                if (notBlank(exp.getLocation())) body.append(" · ").append(esc(exp.getLocation()));
                body.append("</span>");
                if (exp.getBullets() != null && !exp.getBullets().isEmpty()) {
                    body.append("<ul class='bullets'>");
                    for (String b : exp.getBullets())
                        body.append("<li>").append(esc(b)).append("</li>");
                    body.append("</ul>");
                }
                body.append("</div>");
            }
        }

        // ── Projects ──
        if (resume.getProjects() != null && !resume.getProjects().isEmpty()) {
            body.append(sectionHeader("Projects"));
            for (NProjectEntry proj : resume.getProjects()) {
                body.append("<div class='entry'>");
                body.append("<div class='entry-header'><span class='entry-title'>").append(esc(proj.getTitle())).append("</span>");
                body.append("<span class='entry-date'>").append(esc(proj.getDuration())).append("</span></div>");
                if (notBlank(proj.getTechStack()))
                    body.append("<span class='entry-sub'>").append(esc(proj.getTechStack())).append("</span>");
                if (notBlank(proj.getGithubLink()))
                    body.append(" &nbsp;<a class='entry-link' href='").append(esc(proj.getGithubLink())).append("' target='_blank'>View ↗</a>");
                if (notBlank(proj.getLiveUrl()))
                    body.append(" &nbsp;<a class='entry-link' href='").append(esc(proj.getLiveUrl())).append("' target='_blank'>Live ↗</a>");
                if (proj.getBullets() != null && !proj.getBullets().isEmpty()) {
                    body.append("<ul class='bullets'>");
                    for (String b : proj.getBullets())
                        body.append("<li>").append(esc(b)).append("</li>");
                    body.append("</ul>");
                }
                body.append("</div>");
            }
        }

        // ── Achievements ──
        if (resume.getAchievements() != null && !resume.getAchievements().isEmpty()) {
            body.append(sectionHeader("Achievements"));
            body.append("<ul class='bullets'>");
            for (String a : resume.getAchievements()) body.append("<li>").append(esc(a)).append("</li>");
            body.append("</ul>");
        }

        // ── Certifications ──
        if (resume.getCertifications() != null && !resume.getCertifications().isEmpty()) {
            body.append(sectionHeader("Certifications"));
            body.append("<ul class='bullets'>");
            for (String c : resume.getCertifications()) body.append("<li>").append(esc(c)).append("</li>");
            body.append("</ul>");
        }

        // ── Leadership ──
        if (resume.getLeadership() != null && !resume.getLeadership().isEmpty()) {
            body.append(sectionHeader("Leadership & Extracurriculars"));
            body.append("<ul class='bullets'>");
            for (String l : resume.getLeadership()) body.append("<li>").append(esc(l)).append("</li>");
            body.append("</ul>");
        }

        body.append("</div>"); // .resume

        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8"/>
              <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
              <title>Resume – %s</title>
              <style>%s</style>
            </head>
            <body>%s</body>
            </html>
            """.formatted(esc(resume.getName()), css, body);
    }

    @Override
    public String getOutputFormat() {
        return "html";
    }

    // ── CSS Generation ──────────────────────────────────────────────────────

    private String buildCss(TemplateConfig cfg, String templateId) {
        String tid = templateId != null ? templateId.toLowerCase() : "classic";

        // ── Shared reset ─────────────────────────────────────────────────────
        String reset =
            "* { box-sizing: border-box; margin: 0; padding: 0; }\n" +
            "@page { size: A4; margin: 0; }\n" +
            "a { color: inherit; text-decoration: none; }\n" +
            "body { background: #f0f0f0; padding: 28px 16px; }\n" +
            ".resume { max-width: 780px; margin: 0 auto; background: #fff; }\n" +
            "@media print { body { background: white; padding: 0; }\n" +
            "  .resume { box-shadow: none; }\n" +
            "  .section-header { letter-spacing: 0 !important; } }\n";

        return switch (tid) {

            // ── MODERN ── Segoe UI, emerald left-bar section headers ─────────
            case "modern" -> reset +
                "body { font-family: 'Segoe UI', Arial, sans-serif; }\n" +
                ".resume { padding: 44px 52px; font-size: 10.5pt; line-height: 1.35; }\n" +
                ".resume-header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #059669; padding-bottom: 12px; }\n" +
                ".resume-name   { font-size: 26pt; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #0F172A; }\n" +
                ".resume-title  { font-size: 11pt; color: #059669; font-weight: 700; margin-top: 3px; }\n" +
                ".resume-contact { font-size: 9pt; color: #64748B; margin-top: 5px; }\n" +
                ".resume-summary { font-size: 10pt; line-height: 1.4; margin: 6px 0 10px; color: #1E293B; }\n" +
                ".section-header { font-size: 9.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; margin: 14px 0 6px; color: #0F172A; border-left: 5px solid #059669; padding-left: 8px; page-break-after: avoid; }\n" +
                ".entry { margin-bottom: 10px; page-break-inside: avoid; }\n" +
                ".entry-header { display: flex; justify-content: space-between; align-items: baseline; }\n" +
                ".entry-title  { font-weight: 700; font-size: 10.5pt; color: #0F172A; }\n" +
                ".entry-date   { font-size: 9pt; color: #64748B; }\n" +
                ".entry-sub    { font-size: 9.5pt; font-style: italic; color: #475569; }\n" +
                ".entry-meta   { font-size: 9pt; color: #64748B; margin-top: 2px; }\n" +
                ".entry-link   { font-size: 9pt; font-weight: 700; color: #059669; }\n" +
                ".bullets      { list-style: none; margin: 4px 0 0 4px; }\n" +
                ".bullets li   { position: relative; padding-left: 14px; margin-bottom: 3px; font-size: 10pt; line-height: 1.35; color: #1E293B; }\n" +
                ".bullets li::before { content: '\u25b8'; position: absolute; left: 0; color: #059669; font-size: 9pt; }\n" +
                ".skills-table { width: 100%; border-collapse: collapse; margin: 4px 0; }\n" +
                ".skills-table td { padding: 2px 6px; font-size: 10pt; vertical-align: top; }\n" +
                ".skill-label  { font-weight: 800; width: 160px; white-space: nowrap; color: #059669; }\n";

            // ── MINIMAL ── Georgia serif, black & white, double-rule centered headers
            case "minimal" -> reset +
                "body { font-family: Georgia, 'Times New Roman', serif; }\n" +
                ".resume { padding: 52px 60px; font-size: 10.5pt; line-height: 1.45; }\n" +
                ".resume-header { text-align: center; margin-bottom: 20px; }\n" +
                ".resume-name   { font-size: 22pt; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #000; }\n" +
                ".resume-title  { font-size: 11pt; color: #333; font-style: italic; margin-top: 3px; }\n" +
                ".resume-contact { font-size: 9pt; color: #555; margin-top: 6px; }\n" +
                ".resume-summary { font-size: 10pt; line-height: 1.5; margin: 6px 0 10px; color: #222; }\n" +
                ".section-header { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 16px 0 6px; color: #000; text-align: center; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; page-break-after: avoid; }\n" +
                ".entry { margin-bottom: 12px; page-break-inside: avoid; }\n" +
                ".entry-header { display: flex; justify-content: space-between; align-items: baseline; }\n" +
                ".entry-title  { font-weight: 700; font-size: 10.5pt; color: #000; }\n" +
                ".entry-date   { font-size: 9pt; color: #555; font-style: italic; }\n" +
                ".entry-sub    { font-size: 9.5pt; font-style: italic; color: #444; }\n" +
                ".entry-meta   { font-size: 9pt; color: #555; margin-top: 2px; }\n" +
                ".entry-link   { font-size: 9pt; font-weight: 600; color: #000; }\n" +
                ".bullets      { list-style: none; margin: 4px 0 0 4px; }\n" +
                ".bullets li   { position: relative; padding-left: 16px; margin-bottom: 3px; font-size: 10pt; line-height: 1.4; color: #222; }\n" +
                ".bullets li::before { content: '\u2013'; position: absolute; left: 0; color: #000; }\n" +
                ".skills-table { width: 100%; border-collapse: collapse; margin: 4px 0; }\n" +
                ".skills-table td { padding: 2px 6px; font-size: 10pt; vertical-align: top; }\n" +
                ".skill-label  { font-weight: 700; width: 160px; white-space: nowrap; color: #000; }\n";

            // ── PROFESSIONAL ── Deep navy banner header, Times New Roman serif
            case "professional" -> reset +
                "body { font-family: 'Times New Roman', Georgia, serif; }\n" +
                ".resume { padding: 0 0 48px 0; font-size: 10.5pt; line-height: 1.35; }\n" +
                ".resume-header { text-align: center; background: #1E3A8A; color: #fff; padding: 28px 52px 20px; margin-bottom: 20px; }\n" +
                ".resume-name   { font-size: 26pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #fff; }\n" +
                ".resume-title  { font-size: 11pt; color: #BFDBFE; font-style: italic; margin-top: 4px; }\n" +
                ".resume-contact { font-size: 9pt; color: #CBD5E1; margin-top: 6px; }\n" +
                ".resume-summary { font-size: 10pt; line-height: 1.4; margin: 0 0 10px; padding: 6px 52px; color: #1E293B; }\n" +
                ".section-header { font-size: 9.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin: 14px 52px 6px; color: #1E3A8A; border-bottom: 2px solid #2563EB; padding-bottom: 3px; page-break-after: avoid; }\n" +
                ".entry { margin-bottom: 10px; padding: 0 52px; page-break-inside: avoid; }\n" +
                ".entry-header { display: flex; justify-content: space-between; align-items: baseline; }\n" +
                ".entry-title  { font-weight: 700; font-size: 10.5pt; color: #1E3A8A; }\n" +
                ".entry-date   { font-size: 9pt; color: #475569; }\n" +
                ".entry-sub    { font-size: 9.5pt; font-style: italic; color: #475569; }\n" +
                ".entry-meta   { font-size: 9pt; color: #475569; margin-top: 2px; }\n" +
                ".entry-link   { font-size: 9pt; font-weight: 700; color: #2563EB; }\n" +
                ".bullets      { list-style: none; margin: 4px 0 0 4px; }\n" +
                ".bullets li   { position: relative; padding-left: 14px; margin-bottom: 3px; font-size: 10pt; line-height: 1.35; color: #1E293B; }\n" +
                ".bullets li::before { content: '\u2022'; position: absolute; left: 0; color: #2563EB; }\n" +
                ".skills-table { width: 100%; border-collapse: collapse; margin: 4px 0; }\n" +
                ".skills-table td { padding: 2px 6px; font-size: 10pt; vertical-align: top; }\n" +
                ".skill-label  { font-weight: 700; width: 160px; white-space: nowrap; color: #1E3A8A; }\n";

            // ── COMPACT ── Arial, dense teal, mini text, tinted section labels
            case "compact" -> reset +
                "body { font-family: Arial, Helvetica, sans-serif; }\n" +
                ".resume { padding: 24px 32px; font-size: 9.5pt; line-height: 1.2; }\n" +
                ".resume-header { text-align: center; margin-bottom: 8px; border-bottom: 1px solid #0D9488; padding-bottom: 6px; }\n" +
                ".resume-name   { font-size: 18pt; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: #0F172A; }\n" +
                ".resume-title  { font-size: 10pt; color: #0D9488; font-weight: 700; margin-top: 2px; }\n" +
                ".resume-contact { font-size: 8.5pt; color: #64748B; margin-top: 3px; }\n" +
                ".resume-summary { font-size: 9.5pt; line-height: 1.3; margin: 4px 0 6px; color: #334155; }\n" +
                ".section-header { font-size: 8.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; margin: 7px 0 3px; color: #0F172A; background: #F0FDFA; border-left: 3px solid #0D9488; padding: 2px 6px; page-break-after: avoid; }\n" +
                ".entry { margin-bottom: 5px; page-break-inside: avoid; }\n" +
                ".entry-header { display: flex; justify-content: space-between; align-items: baseline; }\n" +
                ".entry-title  { font-weight: 700; font-size: 9.5pt; color: #0F172A; }\n" +
                ".entry-date   { font-size: 8.5pt; color: #64748B; }\n" +
                ".entry-sub    { font-size: 9pt; font-style: italic; color: #475569; }\n" +
                ".entry-meta   { font-size: 8.5pt; color: #64748B; margin-top: 1px; }\n" +
                ".entry-link   { font-size: 8.5pt; font-weight: 700; color: #0D9488; }\n" +
                ".bullets      { list-style: none; margin: 2px 0 0 2px; }\n" +
                ".bullets li   { position: relative; padding-left: 12px; margin-bottom: 1px; font-size: 9.5pt; line-height: 1.25; color: #334155; }\n" +
                ".bullets li::before { content: '\u2022'; position: absolute; left: 0; color: #0D9488; }\n" +
                ".skills-table { width: 100%; border-collapse: collapse; margin: 2px 0; }\n" +
                ".skills-table td { padding: 1px 4px; font-size: 9.5pt; vertical-align: top; }\n" +
                ".skill-label  { font-weight: 700; width: 130px; white-space: nowrap; color: #0D9488; }\n";

            // ── CLASSIC (default) ── Calibri, navy, bottom-border section headers
            default -> reset +
                "body { font-family: Calibri, Georgia, serif; }\n" +
                ".resume { padding: 48px 52px; font-size: 10.5pt; line-height: 1.3; }\n" +
                ".resume-header { text-align: center; margin-bottom: 16px; }\n" +
                ".resume-name   { font-size: 28pt; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #1A1A2E; }\n" +
                ".resume-title  { font-size: 11pt; color: #2C5F8A; font-weight: 600; margin-top: 4px; }\n" +
                ".resume-contact { font-size: 9pt; color: #555; margin-top: 6px; }\n" +
                ".resume-summary { font-size: 10pt; line-height: 1.3; margin: 6px 0 10px; color: #222; }\n" +
                ".section-header { font-size: 9.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; margin: 12px 0 6px; color: #1A1A2E; border-bottom: 2px solid #2C5F8A; padding-bottom: 3px; page-break-after: avoid; }\n" +
                ".entry { margin-bottom: 10px; page-break-inside: avoid; }\n" +
                ".entry-header { display: flex; justify-content: space-between; align-items: baseline; }\n" +
                ".entry-title  { font-weight: 700; font-size: 10.5pt; color: #1A1A2E; }\n" +
                ".entry-date   { font-size: 9pt; color: #666; }\n" +
                ".entry-sub    { font-size: 9.5pt; font-style: italic; color: #555; }\n" +
                ".entry-meta   { font-size: 9pt; color: #666; margin-top: 2px; }\n" +
                ".entry-link   { font-size: 9pt; font-weight: 600; color: #2C5F8A; }\n" +
                ".bullets      { list-style: none; margin: 4px 0 0 4px; }\n" +
                ".bullets li   { position: relative; padding-left: 14px; margin-bottom: 3px; font-size: 10pt; line-height: 1.3; color: #222; }\n" +
                ".bullets li::before { content: '\u2022'; position: absolute; left: 0; color: #2C5F8A; }\n" +
                ".skills-table { width: 100%; border-collapse: collapse; margin: 4px 0; }\n" +
                ".skills-table td { padding: 2px 6px; font-size: 10pt; vertical-align: top; }\n" +
                ".skill-label  { font-weight: 700; width: 160px; white-space: nowrap; color: #2C5F8A; }\n";

            // ── HARVARD ── Left-aligned, B&W, Times New Roman, full-rule section headers
            case "harvard" -> reset +
                "body { font-family: 'Times New Roman', Georgia, serif; }\n" +
                ".resume { padding: 48px 56px; font-size: 10.5pt; line-height: 1.4; }\n" +
                ".resume-header { text-align: left; margin-bottom: 10px; }\n" +
                ".resume-name   { font-size: 20pt; font-weight: 700; color: #000; letter-spacing: 0; text-transform: none; }\n" +
                ".resume-title  { display: none; }\n" +
                ".resume-contact { font-size: 10pt; color: #000; margin-top: 2px; }\n" +
                ".resume-summary { font-size: 10.5pt; line-height: 1.45; margin: 6px 0 10px; color: #000; }\n" +
                ".section-header { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 14px 0 4px; color: #000; border-bottom: 1.5px solid #000; padding-bottom: 2px; page-break-after: avoid; }\n" +
                ".entry { margin-bottom: 10px; page-break-inside: avoid; }\n" +
                ".entry-header { display: flex; justify-content: space-between; align-items: baseline; }\n" +
                ".entry-title  { font-weight: 700; font-size: 10.5pt; color: #000; }\n" +
                ".entry-date   { font-size: 10.5pt; font-weight: 700; color: #000; }\n" +
                ".entry-sub    { font-size: 10.5pt; font-style: italic; color: #000; }\n" +
                ".entry-meta   { font-size: 10pt; color: #555; margin-top: 1px; }\n" +
                ".entry-link   { font-size: 10pt; color: #000; }\n" +
                ".bullets      { list-style: disc; margin: 4px 0 0 18px; }\n" +
                ".bullets li   { padding-left: 2px; margin-bottom: 3px; font-size: 10.5pt; line-height: 1.4; color: #000; }\n" +
                ".bullets li::before { content: none; }\n" +
                ".skills-table { width: 100%; border-collapse: collapse; margin: 4px 0; }\n" +
                ".skills-table td { padding: 1px 4px; font-size: 10.5pt; vertical-align: top; }\n" +
                ".skill-label  { font-weight: 700; width: 200px; white-space: nowrap; color: #000; }\n";
        };
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String sectionHeader(String text) {
        return "<div class='section-header'>" + esc(text) + "</div>";
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }

    /** Strips the protocol so the visible link text is a clean, readable URL
     *  (e.g. "linkedin.com/in/keshav-banger") rather than the raw href. */
    private String displayUrl(String url) {
        if (url == null) return "";
        return url.replaceFirst("(?i)^https?://", "").replaceFirst("(?i)^www\\.", "");
    }
}
