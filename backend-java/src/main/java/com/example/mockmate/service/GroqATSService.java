package com.example.mockmate.service;

import com.example.mockmate.model.HonestResumeAssessment;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * JD-calibrated resume assessment. The candidate is judged against what THIS
 * job description actually asks for — never against a generic external bar
 * (a previous version of this prompt scored against fixed "Tier-1/2/3
 * company" CGPA/DSA thresholds regardless of what the JD required; this one
 * replaces that entirely).
 */
@Slf4j
@Service
public class GroqATSService {

    private final WebClient    webClient;
    private final ObjectMapper objectMapper;      // app-wide mapper, for the outer {choices:[...]} envelope
    private final ObjectMapper snakeCaseMapper;    // dedicated mapper for the LLM's snake_case JSON body

    @Value("${groq.api-key:}")
    private String groqApiKey;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

    private static final String SYSTEM_PROMPT = """
            You are a senior technical recruiter with 12 years of experience screening
            candidates in the Indian job market. You evaluate ONE resume against ONE job
            description and return a structured assessment as JSON.

            You are the judgment layer of a larger system. Parsing, keyword extraction, and
            arithmetic have already been done by code and are given to you as structured
            input. Do not recompute them. Your job is interpretation, calibration, and
            advice.

            ═══════════════════════════════════════════════════════════════════
            CARDINAL RULES — violating any of these makes the output unusable
            ═══════════════════════════════════════════════════════════════════

            RULE 1 — THE JD IS THE ONLY STANDARD.
            Judge the candidate against the requirements written in the job description,
            never against an external or industry-wide bar. If the JD sets no CGPA
            requirement, CGPA is not a weakness. If the JD asks for "basic understanding"
            of a technology, basic understanding fully satisfies it — do not silently
            upgrade it to "strong" or "production." If the JD asks for a fresher, absence
            of work experience is EXPECTED, not a defect.

            RULE 2 — NEVER INVENT FACTS OR NUMBERS.
            Every claim you make must trace to text present in the provided resume. When you
            rewrite a bullet and it would benefit from a metric the candidate never stated,
            insert a literal placeholder — "[X]%", "[N] users", "[N] concurrent sessions" —
            and add that bullet's id to `needs_user_input`. Writing a plausible-sounding
            invented statistic instructs a real person to lie on a real job application.
            This is the most serious error you can make.

            RULE 3 — ONLY CRITIQUE WHAT IS THERE.
            Never advise a fix the resume already implements. Before writing any
            recommendation, check it against `resume.bullets`. If the bullets already start
            with strong past-tense verbs, do not recommend strong past-tense verbs.

            RULE 4 — ONE VERDICT, NOT SIX.
            Every label you emit (band, fit, confidence, tier access) must be consistent
            with `overall_score`. A resume cannot be "strong" and "average" simultaneously.
            Derive all labels from the score using the band table below — do not form an
            independent impression and then attach a number to it.

            RULE 5 — DISTINGUISH ABSENT FROM UNPARSED.
            If a field arrives as null or empty, say the information "was not detected" and
            treat it as a formatting risk. Do not assert the candidate lacks it. A missing
            Location field usually means a two-column header defeated the parser, not that
            the candidate has no address.

            ═══════════════════════════════════════════════════════════════════
            SCORING RUBRIC
            ═══════════════════════════════════════════════════════════════════

            Score each dimension 0-100 independently, then let the calling code compute the
            weighted total. Weights depend on the seniority the JD asks for:

            DIMENSION                      | FRESHER | MID/SENIOR
            -------------------------------|---------|------------
            Eligibility & availability     |   20    |    10
            JD skill coverage              |   25    |    25
            Project / delivery evidence    |   20    |    15
            Relevant experience            |   10    |    30
            Resume craft & parseability    |   15    |    12
            Soft-skill & collaboration     |   10    |     8

            ELIGIBILITY & AVAILABILITY — Does the degree qualify? Critically: does the
            graduation year permit the employment type? A candidate graduating after the
            role's start date cannot fill a Full-Time position. Compare `education.end_year`
            against `context.today` and `jd.employment_type`. Cap this dimension at 60 when
            there is a conflict and raise a blocking flag. This check is frequently decisive
            and frequently missed.

            JD SKILL COVERAGE — Importance-weighted, not a raw count. Requirements the JD
            marks as "strong grasp," "required," or "must have" carry roughly 3x the weight
            of ones marked "familiarity with," "basic understanding of," or "exposure to."
            Credit a skill when it appears anywhere in the resume, including certifications
            and project descriptions — not only in the Skills section.

            PROJECT / DELIVERY EVIDENCE — Reward architectural specificity, concurrency,
            persistence design, API design, and scale. Penalise vague descriptions and
            tutorial-tier CRUD. A well-described personal project with real engineering
            substance outranks a vaguely described internship.

            RELEVANT EXPERIENCE — Internships, freelance work, open-source contributions.
            For fresher roles, competition wins and technical leadership partially
            substitute; score no lower than 40 on this dimension when such evidence exists.

            RESUME CRAFT & PARSEABILITY — Single-column layout, no photo, no tables in the
            header, consistent dates, standard section names, correct grammar. Score this
            LOW when `parse_quality.fields_recovered` is incomplete, since that is direct
            evidence a real ATS will struggle. Do not score formatting highly on a resume
            your own parser could not read.

            SOFT-SKILL & COLLABORATION — Leadership roles, team coordination, mentoring,
            communication signals. Only where the JD asks for them.

            ═══════════════════════════════════════════════════════════════════
            BAND TABLE — all labels derive from overall_score
            ═══════════════════════════════════════════════════════════════════

            85-100  band="Excellent"   fit="Strong Fit"       confidence="High"
            70-84   band="Good"        fit="Good Fit"         confidence="Moderate"
            55-69   band="Borderline"  fit="Borderline Fit"   confidence="Moderate"
            40-54   band="Weak"        fit="Weak Fit"         confidence="Low"
            0-39    band="Poor"        fit="Not a Fit"        confidence="Low"

            Any blocking flag (availability conflict, degree mismatch) caps the band at
            "Borderline" regardless of score, and must appear as the first blocker.

            ═══════════════════════════════════════════════════════════════════
            CALIBRATION ANCHORS
            ═══════════════════════════════════════════════════════════════════

            Use these to keep scoring stable across runs.

            ~90 — Meets every stated requirement with evidence; production internship;
                  deployed work; clean single-column formatting.
            ~75 — Meets all primary requirements, missing several "familiarity" items;
                  solid projects; minor formatting issues.
            ~65 — Primary stack covered, secondary requirements absent, no internship,
                  OR a genuine availability/eligibility question. Would land mid-pile.
            ~50 — Partial coverage of the primary stack; thin evidence; formatting
                  actively hurts machine readability.
            ~30 — Wrong domain, or missing the majority of required skills.

            ═══════════════════════════════════════════════════════════════════
            WEAKNESS & RECOMMENDATION QUALITY
            ═══════════════════════════════════════════════════════════════════

            A weakness is only valid if it names something the JD asks for and the resume
            does not evidence. Before emitting each weakness, verify:
              (a) the JD requires it,
              (b) the resume does not show it anywhere including certs and projects,
              (c) it is not merely a parsing failure.
            If any check fails, drop the weakness.

            Rank recommendations by (impact x speed). A skill the candidate plainly already
            uses but forgot to list is the highest-value fix in any report — near-zero
            effort, direct keyword gain. Look specifically for skills implied by project
            descriptions but absent from the Skills section, and for internal contradictions
            (e.g. a project claiming a front-end role while no front-end technology is
            listed anywhere).

            The `tailored_summary` must be written for the candidate to paste at the top of
            their own resume. Therefore: third-person or implied-first-person, present
            tense, strengths and JD-relevant keywords only. It must contain NO weaknesses,
            NO hedging, and no mention of CGPA. A summary that argues against the candidate
            is a defect.

            ═══════════════════════════════════════════════════════════════════
            OUTPUT — return ONLY this JSON. No prose, no markdown fences.
            ═══════════════════════════════════════════════════════════════════

            {
              "dimension_scores": {
                "eligibility": {"score": 0, "reasoning": ""},
                "skill_coverage": {"score": 0, "reasoning": ""},
                "project_evidence": {"score": 0, "reasoning": ""},
                "relevant_experience": {"score": 0, "reasoning": ""},
                "resume_craft": {"score": 0, "reasoning": ""},
                "soft_skills": {"score": 0, "reasoning": ""}
              },
              "blockers": [
                {"issue": "", "severity": "blocking|high|medium", "evidence": "", "fix": ""}
              ],
              "strengths": [
                {"point": "", "evidence_from_resume": "", "jd_requirement_met": ""}
              ],
              "weaknesses": [
                {"point": "", "jd_requirement": "", "severity": "high|medium|low", "fix": ""}
              ],
              "coverage": {
                "satisfied": [{"jd_requirement": "", "resume_evidence": ""}],
                "unsatisfied": [{"jd_requirement": "", "importance": "required|preferred"}],
                "quick_wins": [{"skill": "", "why_likely_present": "", "gain": "high|medium"}]
              },
              "bullet_rewrites": [
                {"id": "", "before": "", "after": "", "needs_user_input": true,
                 "placeholders": []}
              ],
              "tailored_summary": "",
              "action_plan": [
                {"step": "", "impact": "high|medium|low", "effort": "minutes|hours|weeks",
                 "expected_gain_points": 0}
              ],
              "parse_warnings": [
                {"field": "", "observed": "", "likely_cause": "", "user_action": ""}
              ],
              "recruiter_assessment": ""
            }

            Every string must be specific to this resume and this JD. Generic filler that
            would apply to any candidate is a failure. If a list has no valid entries,
            return an empty array rather than padding it.
            """;

    public GroqATSService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder
                .codecs(c -> c.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                .build();
        this.objectMapper = objectMapper;
        // The LLM is instructed (and only capable, via response_format=json_object)
        // to return the exact snake_case keys from the OUTPUT schema above. Rather
        // than annotate every field of HonestResumeAssessment with @JsonProperty,
        // one mapper configured for snake_case handles the whole tree.
        this.snakeCaseMapper = objectMapper.copy()
                .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .enable(com.fasterxml.jackson.core.JsonParser.Feature.ALLOW_TRAILING_COMMA)
                .enable(com.fasterxml.jackson.core.JsonParser.Feature.ALLOW_COMMENTS)
                .enable(com.fasterxml.jackson.core.JsonParser.Feature.ALLOW_UNQUOTED_FIELD_NAMES)
                .enable(com.fasterxml.jackson.core.JsonParser.Feature.ALLOW_SINGLE_QUOTES);
    }

    // ── Seniority → dimension weights (must each sum to 100) ──────────────
    private static final Map<String, Integer> WEIGHTS_FRESHER = Map.of(
            "eligibility", 20, "skillCoverage", 25, "projectEvidence", 20,
            "relevantExperience", 10, "resumeCraft", 15, "softSkills", 10
    );
    private static final Map<String, Integer> WEIGHTS_MID_SENIOR = Map.of(
            "eligibility", 10, "skillCoverage", 25, "projectEvidence", 15,
            "relevantExperience", 30, "resumeCraft", 12, "softSkills", 8
    );

    // llama-3.3-70b-versatile / llama-3.1-8b-instant were retired from
    // Groq's catalog (confirmed via GET /v1/models) — every attempt in this
    // list was failing, which is what left ATS reports stuck on the
    // "Deterministic only — AI unavailable" fallback.
    private static final List<String> MODELS_TO_TRY =
            List.of("openai/gpt-oss-120b", "openai/gpt-oss-20b");
    private static final int RETRY_BACKOFF_MS = 700;

    public HonestResumeAssessment analyze(String resumeText, String jdText, ATSScoringService.ScoringResult scoring) {
        if (groqApiKey == null || groqApiKey.isBlank()) {
            log.warn("[GroqATS] GROQ_API_KEY not set — returning empty assessment");
            return emptyAssessment();
        }

        String seniority = classifySeniority(jdText);
        String userPrompt = buildUserPrompt(resumeText, jdText, scoring, seniority);

        HonestResumeAssessment assessment = callGroq(userPrompt);
        if (assessment == null) {
            log.error("[GroqATS] Assessment call failed — all models exhausted.");
            return emptyAssessment();
        }

        applyComputedFields(assessment, seniority);
        return assessment;
    }

    // ── Structured input the prompt expects (resume.bullets, education.end_year,
    // context.today, jd.employment_type, parse_quality.fields_recovered) ───────
    private String buildUserPrompt(String resumeText, String jdText,
                                    ATSScoringService.ScoringResult scoring, String seniority) {
        String resumeSnip = resumeText.length() > 6000 ? resumeText.substring(0, 6000) + "\n[truncated]" : resumeText;
        String jdSnip      = jdText.length()     > 3000 ? jdText.substring(0, 3000)     + "\n[truncated]" : jdText;

        List<String> bullets = extractBullets(resumeText);
        Integer gradYear      = extractGraduationYear(resumeText);
        String employmentType = extractEmploymentType(jdText);

        Map<String, String> fieldsRecovered = scoring.getSectionFeedback() != null
                ? scoring.getSectionFeedback() : Map.of();

        String structuredInput = """
                {
                  "resume": {
                    "raw_text": %s,
                    "bullets": %s
                  },
                  "education": {
                    "end_year": %s
                  },
                  "jd": {
                    "raw_text": %s,
                    "employment_type": %s,
                    "detected_seniority": %s
                  },
                  "context": {
                    "today": %s
                  },
                  "parse_quality": {
                    "fields_recovered": %s
                  }
                }
                """.formatted(
                        jsonString(resumeSnip),
                        jsonStringArray(bullets),
                        gradYear != null ? gradYear : "null",
                        jsonString(jdSnip),
                        jsonString(employmentType),
                        jsonString(seniority),
                        jsonString(LocalDate.now().toString()),
                        jsonStringMap(fieldsRecovered)
                );

        return """
                Evaluate this resume against this job description. Structured pre-computed
                data is provided below — use it exactly, do not recompute it.

                %s

                Return ONLY the JSON object specified in your instructions. No markdown fences.
                """.formatted(structuredInput);
    }

    // ── Java-computed weighted score + band/fit/confidence (Rule 4) ───────────
    private void applyComputedFields(HonestResumeAssessment a, String seniority) {
        a.setSeniority(seniority);

        Map<String, Integer> weights = "MID_SENIOR".equals(seniority) ? WEIGHTS_MID_SENIOR : WEIGHTS_FRESHER;
        HonestResumeAssessment.DimensionScores d = a.getDimensionScores();
        int weightedSum = 0;
        if (d != null) {
            weightedSum += scoreOf(d.getEligibility())        * weights.get("eligibility");
            weightedSum += scoreOf(d.getSkillCoverage())       * weights.get("skillCoverage");
            weightedSum += scoreOf(d.getProjectEvidence())     * weights.get("projectEvidence");
            weightedSum += scoreOf(d.getRelevantExperience())  * weights.get("relevantExperience");
            weightedSum += scoreOf(d.getResumeCraft())          * weights.get("resumeCraft");
            weightedSum += scoreOf(d.getSoftSkills())           * weights.get("softSkills");
        }
        int overallScore = Math.max(0, Math.min(100, Math.round(weightedSum / 100f)));
        a.setOverallScore(overallScore);

        // Blocking severity sorts first and caps the band at Borderline, per the
        // band table's own rule — regardless of how high the weighted score is.
        boolean hasBlocker = false;
        if (a.getBlockers() != null) {
            a.getBlockers().sort((x, y) -> severityRank(x.getSeverity()) - severityRank(y.getSeverity()));
            hasBlocker = a.getBlockers().stream()
                    .anyMatch(b -> "blocking".equalsIgnoreCase(b.getSeverity()));
        }

        String[] bandFitConfidence = deriveBand(overallScore, hasBlocker);
        a.setBand(bandFitConfidence[0]);
        a.setFit(bandFitConfidence[1]);
        a.setConfidence(bandFitConfidence[2]);
    }

    private int scoreOf(HonestResumeAssessment.DimensionScore s) {
        return s != null ? Math.max(0, Math.min(100, s.getScore())) : 0;
    }

    private int severityRank(String severity) {
        if (severity == null) return 3;
        return switch (severity.toLowerCase()) {
            case "blocking" -> 0;
            case "high"     -> 1;
            case "medium"   -> 2;
            default         -> 3;
        };
    }

    private static final List<String> BAND_ORDER = List.of("Poor", "Weak", "Borderline", "Good", "Excellent");

    private String[] deriveBand(int score, boolean hasBlocker) {
        String band, fit, confidence;
        if (score >= 85)      { band = "Excellent";  fit = "Strong Fit";     confidence = "High"; }
        else if (score >= 70) { band = "Good";        fit = "Good Fit";       confidence = "Moderate"; }
        else if (score >= 55) { band = "Borderline";  fit = "Borderline Fit"; confidence = "Moderate"; }
        else if (score >= 40) { band = "Weak";         fit = "Weak Fit";       confidence = "Low"; }
        else                   { band = "Poor";         fit = "Not a Fit";      confidence = "Low"; }

        if (hasBlocker && BAND_ORDER.indexOf(band) > BAND_ORDER.indexOf("Borderline")) {
            band = "Borderline"; fit = "Borderline Fit"; confidence = "Moderate";
        }
        return new String[]{band, fit, confidence};
    }

    // ── Seniority classifier (deterministic — the LLM output doesn't carry this,
    // the prompt expects the CALLING CODE to already know it) ──────────────────
    private static final Pattern SENIOR_SIGNAL = Pattern.compile(
            "(?i)\\b(senior|sr\\.?|lead|staff|principal|architect)\\b|\\b([3-9]|1[0-9])\\+?\\s*(?:to\\s*\\d+\\s*)?years?\\b");
    private static final Pattern FRESHER_SIGNAL = Pattern.compile(
            "(?i)\\b(fresher|entry.level|entry.level|new\\s*grad|campus|graduate\\s+trainee|0\\s*-?\\s*1\\s*years?|intern(ship)?)\\b");

    private String classifySeniority(String jdText) {
        if (jdText == null) return "FRESHER";
        boolean senior = SENIOR_SIGNAL.matcher(jdText).find();
        boolean fresher = FRESHER_SIGNAL.matcher(jdText).find();
        // Explicit fresher/internship language wins even if a stray "senior" word
        // appears elsewhere (e.g. "reporting to a senior engineer"); an explicit
        // multi-year requirement with no fresher language means MID_SENIOR.
        if (fresher) return "FRESHER";
        if (senior) return "MID_SENIOR";
        return "FRESHER";
    }

    // ── Lightweight structured extraction (no extra LLM call) ─────────────────
    private static final Pattern BULLET_LINE = Pattern.compile("(?m)^\\s*[•\\-\\*✓➤▸►◆▪]\\s+(.+)$");

    private List<String> extractBullets(String resumeText) {
        List<String> bullets = new ArrayList<>();
        if (resumeText == null) return bullets;
        Matcher m = BULLET_LINE.matcher(resumeText);
        while (m.find() && bullets.size() < 60) {
            bullets.add(m.group(1).trim());
        }
        return bullets;
    }

    private static final Pattern EDUCATION_HEADER = Pattern.compile(
            "(?i)(education|degree|university|college|academic\\s+background)");
    private static final Pattern YEAR_PATTERN = Pattern.compile("\\b(19|20)\\d{2}\\b");

    private Integer extractGraduationYear(String resumeText) {
        if (resumeText == null) return null;
        Matcher header = EDUCATION_HEADER.matcher(resumeText);
        if (!header.find()) return null;
        int start = Math.min(header.start(), resumeText.length());
        int end = Math.min(start + 400, resumeText.length());
        String snippet = resumeText.substring(start, end);
        Matcher years = YEAR_PATTERN.matcher(snippet);
        Integer last = null;
        while (years.find()) {
            last = Integer.parseInt(years.group());
        }
        return last;
    }

    private String extractEmploymentType(String jdText) {
        if (jdText == null) return "FULL_TIME";
        String lower = jdText.toLowerCase();
        if (lower.contains("intern")) return "INTERNSHIP";
        if (lower.contains("part-time") || lower.contains("part time")) return "PART_TIME";
        if (lower.contains("contract")) return "CONTRACT";
        return "FULL_TIME";
    }

    // ── Groq call ────────────────────────────────────────────────────────────
    private HonestResumeAssessment callGroq(String userPrompt) {
        for (String modelName : MODELS_TO_TRY) {
            for (int attempt = 1; attempt <= 2; attempt++) {
                HonestResumeAssessment result = attemptGroqCall(modelName, userPrompt);
                if (result != null) return result;
                if (attempt == 1) {
                    try { Thread.sleep(RETRY_BACKOFF_MS); }
                    catch (InterruptedException ie) { Thread.currentThread().interrupt(); return null; }
                }
            }
        }
        return null;
    }

    private HonestResumeAssessment attemptGroqCall(String modelName, String userPrompt) {
        try {
            log.info("[GroqATS] Calling {}", modelName);
            Map<String, Object> requestBody = Map.of(
                    "model", modelName,
                    "temperature", 0.3,
                    // Was 6000 — reserved against Groq's per-account TPM budget
                    // regardless of actual output length, on top of an already
                    // ~13KB system prompt. This is the heaviest Groq call in the
                    // app; every other structured-JSON call here uses <=2048.
                    // Live testing traced production 413s to this account's TPM
                    // ceiling, not genuine payload size — lowering the reservation
                    // reduces how easily a single call trips it.
                    "max_tokens", 4000,
                    // GPT-OSS models spend the whole max_tokens budget on
                    // hidden reasoning tokens unless capped — see
                    // OpenRouterFallbackService's original note on this.
                    "reasoning_effort", "low",
                    "response_format", Map.of("type", "json_object"),
                    "messages", List.of(
                            Map.of("role", "system", "content", SYSTEM_PROMPT),
                            Map.of("role", "user", "content", userPrompt)
                    )
            );
            String raw = webClient.post()
                    .uri(GROQ_URL)
                    .header("Authorization", "Bearer " + groqApiKey.trim())
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(50))
                    .block();

            var root = objectMapper.readTree(raw);
            String content = root.path("choices").get(0).path("message").path("content").asText();
            if (content == null || content.isBlank()) return null;

            String cleanJson = repairTruncatedJson(stripMarkdownFences(content));
            HonestResumeAssessment assessment = snakeCaseMapper.readValue(cleanJson, HonestResumeAssessment.class);
            log.info("[GroqATS] {} succeeded", modelName);
            return assessment;
        } catch (Exception e) {
            log.warn("[GroqATS] {} failed: {}", modelName, e.getMessage());
            return null;
        }
    }

    /** Best-effort repair for truncated JSON: closes unclosed arrays/objects. */
    private String repairTruncatedJson(String json) {
        int braces = 0, brackets = 0;
        boolean inString = false;
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) inString = !inString;
            if (!inString) {
                if (c == '{') braces++;
                else if (c == '}') braces--;
                else if (c == '[') brackets++;
                else if (c == ']') brackets--;
            }
        }
        String trimmed = json.stripTrailing();
        if (trimmed.endsWith(",")) trimmed = trimmed.substring(0, trimmed.length() - 1);
        StringBuilder sb = new StringBuilder(trimmed);
        for (int i = 0; i < brackets; i++) sb.append(']');
        for (int i = 0; i < braces; i++) sb.append('}');
        return sb.toString();
    }

    private String stripMarkdownFences(String text) {
        String clean = text.trim();
        if (clean.startsWith("```json")) clean = clean.substring(7);
        else if (clean.startsWith("```")) clean = clean.substring(3);
        if (clean.endsWith("```")) clean = clean.substring(0, clean.length() - 3);
        return clean.trim();
    }

    // ── JSON literal helpers for hand-built structured input ──────────────────
    private String jsonString(String s) {
        try { return objectMapper.writeValueAsString(s != null ? s : ""); }
        catch (Exception e) { return "\"\""; }
    }

    private String jsonStringArray(List<String> list) {
        try { return objectMapper.writeValueAsString(list != null ? list : List.of()); }
        catch (Exception e) { return "[]"; }
    }

    private String jsonStringMap(Map<String, String> map) {
        try { return objectMapper.writeValueAsString(map != null ? map : Map.of()); }
        catch (Exception e) { return "{}"; }
    }

    private HonestResumeAssessment emptyAssessment() {
        HonestResumeAssessment a = HonestResumeAssessment.builder()
                .blockers(List.of())
                .strengths(List.of())
                .weaknesses(List.of())
                .coverage(HonestResumeAssessment.Coverage.builder()
                        .satisfied(List.of()).unsatisfied(List.of()).quickWins(List.of()).build())
                .bulletRewrites(List.of())
                .actionPlan(List.of())
                .parseWarnings(List.of())
                .tailoredSummary("")
                .recruiterAssessment("AI analysis unavailable — Groq API key not configured or all model attempts failed.")
                .build();
        a.setOverallScore(0);
        a.setBand("Poor");
        a.setFit("Not a Fit");
        a.setConfidence("Low");
        a.setSeniority("FRESHER");
        return a;
    }
}
