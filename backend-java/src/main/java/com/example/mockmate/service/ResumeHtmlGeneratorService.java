package com.example.mockmate.service;

import com.example.mockmate.model.ReconstructedResume;
import com.example.mockmate.model.ReconstructedResume.*;
import com.example.mockmate.model.ResumeFieldConfidence;
import com.example.mockmate.model.ResumeFieldConfidence.MissingField;
import com.example.mockmate.model.NormalizedResume;
import com.example.mockmate.model.NormalizedResumeMapper;
import com.example.mockmate.model.TemplateConfig;
import com.example.mockmate.registry.TemplateRegistry;
import com.example.mockmate.renderer.HtmlRenderer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Generates a beautiful, ATS-safe HTML resume from a ReconstructedResume,
 * and performs confidence checks to surface missing/uncertain fields.
 * Now delegates HTML generation to HtmlRenderer for single-source styling.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeHtmlGeneratorService {

    private final HtmlRenderer htmlRenderer;
    private final TemplateRegistry templateRegistry;

    // ── Confidence Analysis ───────────────────────────────────────────────────

    public ResumeFieldConfidence analyzeConfidence(ReconstructedResume r) {
        Map<String, Double> scores = new LinkedHashMap<>();
        List<MissingField>  missing     = new ArrayList<>();
        List<String>        uncertain   = new ArrayList<>();

        // Required fields — flag missing if score < LOW_THRESHOLD (0.55)
        scoreFieldRequired(scores, missing, uncertain, "name",  r.getName(),  "Full Name",  "e.g. Jane Doe",    "contact", r.getName()  != null ? 0.95 : 0.0);
        scoreFieldRequired(scores, missing, uncertain, "email", r.getEmail(), "Email",      "jane@example.com", "contact", detectEmail(r.getEmail()));
        scoreFieldRequired(scores, missing, uncertain, "phone", r.getPhone(), "Phone",      "+91 9000000000",   "contact", detectPhone(r.getPhone()));

        // Optional fields — only flag missing if completely absent (score == 0)
        scoreFieldOptional(scores, missing, uncertain, "location", r.getLocation(), "Location",       "City, State",              "contact", nonEmpty(r.getLocation()));
        scoreFieldOptional(scores, missing, uncertain, "linkedin", r.getLinkedin(), "LinkedIn URL",   "linkedin.com/in/username",  "contact", nonEmpty(r.getLinkedin()));
        scoreFieldOptional(scores, missing, uncertain, "github",   r.getGithub(),   "GitHub URL",     "github.com/username",       "contact", nonEmpty(r.getGithub()));
        scoreFieldOptional(scores, missing, uncertain, "jobTitle", r.getJobTitle(), "Target Job Title","e.g. Software Engineer",   "contact", nonEmpty(r.getJobTitle()));

        // Education
        EducationEntry edu = r.getEducation();
        double eduScore = (edu != null) ? scorePojo(edu.getDegree(), edu.getInstitution(), edu.getYear()) : 0.0;
        scores.put("education", eduScore);
        if (eduScore < ResumeFieldConfidence.LOW_THRESHOLD) {
            missing.add(MissingField.builder()
                .fieldKey("education.degree").label("Degree").placeholder("B.Tech Computer Science")
                .section("education").required(false).build());
        } else if (eduScore < ResumeFieldConfidence.MEDIUM_THRESHOLD) {
            uncertain.add("education");
        }

        // Summary
        double sumScore = nonEmpty(r.getProfessionalSummary());
        scores.put("professionalSummary", sumScore);
        if (sumScore < ResumeFieldConfidence.LOW_THRESHOLD) {
            missing.add(MissingField.builder()
                .fieldKey("professionalSummary")
                .label("Professional Summary")
                .placeholder("3 sentences: who you are, what you bring, career goal")
                .section("summary").required(false).build());
        }

        // Skills — trust if at least 1 category exists
        double skillScore = (r.getSkills() != null && !r.getSkills().isEmpty()) ? 0.9 : 0.0;
        scores.put("skills", skillScore);

        // Experience
        double expScore = (r.getExperience() != null && !r.getExperience().isEmpty()) ? 0.85 : 0.2;
        scores.put("experience", expScore);

        double overall = scores.values().stream().mapToDouble(d -> d).average().orElse(0.5);
        log.info("[Confidence] overallConfidence={} missing={} uncertain={}", overall, missing.size(), uncertain.size());

        return ResumeFieldConfidence.builder()
            .overallConfidence(overall)
            .fieldScores(scores)
            .missingFields(missing)
            .uncertainFields(uncertain)
            .build();
    }

    // ── HTML Generation ───────────────────────────────────────────────────────

    /**
     * Returns a fully self-contained HTML string for the resume.
     * Delegates to the new HtmlRenderer for style-token consistency.
     */
    public String generateHtml(ReconstructedResume r, String template) {
        log.info("[HtmlGen] Delegating HTML generation for name={} template={}", r.getName(), template);
        NormalizedResume nr = NormalizedResumeMapper.fromReconstructed(r);
        TemplateConfig config = templateRegistry.get(template);
        return htmlRenderer.renderToString(nr, config);
    }

    // ── CSS Themes ────────────────────────────────────────────────────────────

    private String buildCss(String template) {
        // Shared base
        String base = """
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: #f5f5f5; padding: 32px 16px; }
            a    { color: inherit; text-decoration: none; }
            .resume { max-width: 780px; margin: 0 auto; background: #fff;
                      padding: 48px 52px; font-size: 10.5pt; line-height: 1.5; }
            .resume-header { text-align: center; margin-bottom: 22px; }
            .resume-name  { font-size: 24pt; font-weight: 800; letter-spacing: 1.5px;
                            text-transform: uppercase; }
            .resume-title { font-size: 11pt; margin-top: 4px; }
            .resume-contact { font-size: 9pt; margin-top: 6px; color: #555; }
            .resume-summary { font-size: 10pt; line-height: 1.6; margin: 6px 0 12px; }
            .section-header { font-size: 9.5pt; font-weight: 800; text-transform: uppercase;
                              letter-spacing: 1.2px; margin: 20px 0 6px; }
            .entry { margin-bottom: 12px; }
            .entry-header { display: flex; justify-content: space-between; align-items: baseline; }
            .entry-title  { font-weight: 700; font-size: 10.5pt; }
            .entry-date   { font-size: 9pt; color: #666; }
            .entry-sub    { font-size: 9.5pt; font-style: italic; color: #555; }
            .entry-meta   { font-size: 9pt; color: #666; margin-top: 2px; }
            .entry-link   { font-size: 9pt; font-weight: 600; }
            .bullets      { list-style: none; margin: 6px 0 0 4px; }
            .bullets li   { position: relative; padding-left: 14px; margin-bottom: 3px;
                            font-size: 10pt; line-height: 1.45; }
            .bullets li::before { content: '•'; position: absolute; left: 0; }
            .skills-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            .skills-table td { padding: 2px 6px; font-size: 10pt; vertical-align: top; }
            .skill-label  { font-weight: 700; width: 160px; white-space: nowrap; }
            @media print {
              body { background: white; padding: 0; }
              .resume { padding: 32px 36px; box-shadow: none; }
            }
            """;

        return switch (template) {
            case "modern" -> base + """
                body { font-family: 'Segoe UI', Calibri, sans-serif; }
                .resume-name  { color: #0F172A; }
                .resume-title { color: #059669; font-weight: 600; }
                .section-header { color: #0F172A; border-left: 4px solid #059669;
                                  padding-left: 8px; }
                .entry-title { color: #0F172A; }
                .entry-link  { color: #059669; }
                .bullets li::before { color: #059669; }
                .skill-label { color: #059669; }
                """;
            case "minimal" -> base + """
                body { font-family: 'Georgia', serif; }
                .resume-name  { color: #000; font-size: 20pt; }
                .resume-title { color: #333; font-size: 10pt; }
                .section-header { color: #000; border-bottom: 1px solid #000;
                                  padding-bottom: 2px; }
                .entry-title { color: #000; }
                .skill-label { color: #000; }
                """;
            default -> base + """
                body { font-family: Calibri, 'Times New Roman', serif; }
                .resume-name  { color: #1A1A2E; }
                .resume-title { color: #2C5F8A; font-weight: 600; }
                .section-header { color: #1A1A2E; border-bottom: 2px solid #2C5F8A;
                                  padding-bottom: 3px; }
                .entry-title { color: #1A1A2E; }
                .entry-link  { color: #2C5F8A; }
                .bullets li::before { color: #2C5F8A; }
                .skill-label { color: #2C5F8A; }
                """;
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String sectionHeader(String text) {
        return "<div class='section-header'>" + esc(text) + "</div>";
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private double nonEmpty(String s) { return notBlank(s) ? 0.9 : 0.0; }

    private double detectEmail(String s) {
        if (s == null) return 0.0;
        return s.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$") ? 0.95 : 0.3;
    }

    private double detectPhone(String s) {
        if (s == null) return 0.0;
        String clean = s.replaceAll("[^0-9]", "");
        return (clean.length() >= 10) ? 0.9 : 0.2;
    }

    private double scorePojo(String... vals) {
        long filled = Arrays.stream(vals).filter(v -> v != null && !v.isBlank()).count();
        return (double) filled / vals.length;
    }

    private void scoreField(Map<String, Double> scores,
                            List<MissingField> missing,
                            List<String> uncertain,
                            String key, String value, String label,
                            String placeholder, String section,
                            boolean required, double score) {
        scores.put(key, score);
        if (score < ResumeFieldConfidence.LOW_THRESHOLD) {
            missing.add(MissingField.builder()
                .fieldKey(key).label(label).placeholder(placeholder)
                .section(section).required(required).build());
        } else if (score < ResumeFieldConfidence.MEDIUM_THRESHOLD) {
            uncertain.add(key);
        }
    }

    /** Required fields: appear in modal if score < LOW_THRESHOLD */
    private void scoreFieldRequired(Map<String, Double> scores,
                                    List<MissingField> missing,
                                    List<String> uncertain,
                                    String key, String value, String label,
                                    String placeholder, String section, double score) {
        scores.put(key, score);
        if (score < ResumeFieldConfidence.LOW_THRESHOLD) {
            missing.add(MissingField.builder()
                .fieldKey(key).label(label).placeholder(placeholder)
                .section(section).required(true).build());
        } else if (score < ResumeFieldConfidence.MEDIUM_THRESHOLD) {
            uncertain.add(key);
        }
    }

    /** Optional fields: appear in modal ONLY if completely absent (score == 0.0) */
    private void scoreFieldOptional(Map<String, Double> scores,
                                    List<MissingField> missing,
                                    List<String> uncertain,
                                    String key, String value, String label,
                                    String placeholder, String section, double score) {
        scores.put(key, score);
        if (score == 0.0) {
            missing.add(MissingField.builder()
                .fieldKey(key).label(label).placeholder(placeholder)
                .section(section).required(false).build());
        }
        // No "uncertain" surfacing for optional fields — trust the parser
    }
}
