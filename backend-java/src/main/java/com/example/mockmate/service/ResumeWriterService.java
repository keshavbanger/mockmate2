package com.example.mockmate.service;

import com.example.mockmate.model.GeneratedResume;
import com.example.mockmate.model.VerifiedResumeInput;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Part 2 of the Resume Generator Prompt Pack — the writer.
 * <p>
 * Deliberately does NOT share a code path with {@link GroqATSService}
 * (the analysis engine) or {@link ResumeReconstructionService} (the older,
 * "score parity at all costs" reconstruction path): the analysis engine is
 * allowed to say negative things about a resume; this one is never allowed
 * to. Mixing the two prompts/parsers would risk a negative clause from the
 * analysis side leaking onto a document a real person sends to a real
 * employer.
 * <p>
 * Failure here does NOT fall back to generic placeholder content — a resume
 * writer silently degrading to invented-sounding filler is exactly the
 * failure mode Rule 2 exists to prevent. Callers should surface the error,
 * not paper over it.
 */
@Slf4j
@Service
public class ResumeWriterService {

    private final WebClient    webClient;
    private final ObjectMapper objectMapper;
    private final ObjectMapper snakeCaseMapper;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    // llama-3.3-70b-versatile / llama-3.1-8b-instant were retired from
    // Groq's catalog (confirmed via GET /v1/models) — every attempt in
    // this list was failing, which is what forced the
    // "refusing to fall back to generic content" exception below every time.
    private static final List<String> MODELS_TO_TRY = List.of("openai/gpt-oss-120b", "openai/gpt-oss-20b");

    private static final String SYSTEM_PROMPT = """
            You are a resume writer producing a final, ATS-optimised document that a real
            candidate will send to real employers. Your output goes directly onto a person's
            job application. Accuracy is more important than impressiveness.

            You receive a verified structured record and return structured resume JSON. You
            do not parse, you do not score, you do not critique.

            ═══════════════════════════════════════════════════════════
            ABSOLUTE PROHIBITIONS
            ═══════════════════════════════════════════════════════════

            NEVER invent a number, percentage, user count, team size, or timeframe. If the
            input contains a placeholder token ([X]%, [N] users), reproduce it verbatim.
            Never resolve a placeholder to a plausible value. A visible "[X]%" is a correct
            output; an invented "25%" is a fabrication on a real job application.

            NEVER add a skill, tool, or technology absent from `verified.skills`. Suggested
            keywords the candidate did not confirm do not exist.

            NEVER include a weakness, hedge, caveat, or negative clause anywhere in the
            document. Banned in all output fields: "however", "although", "lack", "limited",
            "may hinder", "weaker", "below average", "despite", "unfortunately", and any
            mention of CGPA in prose. The resume argues FOR the candidate. Diagnostic
            language belongs in the analysis report, never in the artifact.

            NEVER include: date of birth, gender, marital status, nationality, religion,
            father's or mother's name, mother tongue, passport status, photo, physical
            address beyond city, hobbies unrelated to the role, "Areas of Improvement",
            "Declaration", or a references block. Drop these silently.

            NEVER emit a field whose input value is null, empty, or a section header string
            (e.g. "Academic Record:", "Technical Skills:"). Omit the field instead.

            ═══════════════════════════════════════════════════════════
            WRITING RULES
            ═══════════════════════════════════════════════════════════

            SUMMARY — 2 to 3 sentences, present tense, no first-person pronouns ("Final-year
            B.Tech student..." not "I am..."). Lead with the strongest verified credential.
            Name the primary stack and the target role. Strengths only.

            BULLETS — one line each where possible, starting with a past-tense verb. Preserve
            the candidate's own technical specifics exactly: architecture patterns,
            concurrency models, persistence layers, API styles. These are the highest-value
            content in a fresher resume and must not be generalised away. Never split a
            sentence across two bullets. Never emit a bullet that is a sentence fragment.

            DEDUPLICATION — normalise case, whitespace, and trailing punctuation before
            comparing. Two bullets differing only by a trailing period are duplicates.

            SKILLS — grouped by category, each skill appearing exactly once. Categories:
            Languages, Frameworks, Databases, Tools, Core CS. Omit an empty category.

            PROJECTS — title, tech stack line, 2 to 4 bullets. Include a live URL only when
            one is in the verified input.

            ORDERING for a fresher: Contact, Summary, Education, Skills, Projects,
            Certifications, Achievements, Leadership. Work Experience slots after Education
            only when it exists.

            CONTACT — plain text, no emoji, no icon glyphs. Write LinkedIn and GitHub as
            full visible URLs, not as link-text.

            ═══════════════════════════════════════════════════════════
            OUTPUT — JSON only, no fences, no prose
            ═══════════════════════════════════════════════════════════

            {
              "contact": {"name": "", "target_title": "", "email": "", "phone": "",
                          "location": "", "linkedin_url": "", "github_url": ""},
              "summary": "",
              "education": [{"degree": "", "specialization": "", "institution": "",
                             "affiliation": "", "start_year": "", "end_year": "",
                             "score": "", "coursework": []}],
              "skills": [{"category": "", "items": []}],
              "projects": [{"title": "", "tech": [], "duration": "", "url": "",
                            "bullets": [{"text": "", "has_placeholder": false}]}],
              "experience": [{"org": "", "title": "", "start": "", "end": "", "bullets": []}],
              "certifications": [{"name": "", "issuer": "", "year": "", "detail": ""}],
              "achievements": [""],
              "leadership": [""],
              "omitted_fields": [""],
              "unresolved_placeholders": [{"bullet": "", "token": ""}]
            }

            `omitted_fields` lists what you dropped and why, so the UI can tell the user.
            `unresolved_placeholders` drives a warning banner above the download button.
            """;

    public ResumeWriterService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder
                .codecs(c -> c.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                .build();
        this.objectMapper = objectMapper;
        this.snakeCaseMapper = objectMapper.copy()
                .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .enable(com.fasterxml.jackson.core.JsonParser.Feature.ALLOW_TRAILING_COMMA)
                .enable(com.fasterxml.jackson.core.JsonParser.Feature.ALLOW_COMMENTS)
                .enable(com.fasterxml.jackson.core.JsonParser.Feature.ALLOW_UNQUOTED_FIELD_NAMES)
                .enable(com.fasterxml.jackson.core.JsonParser.Feature.ALLOW_SINGLE_QUOTES);
    }

    /**
     * @throws IllegalStateException if every model attempt failed — the
     *         caller must surface this as an error, never fall back to
     *         placeholder/generic content (see class Javadoc).
     */
    public GeneratedResume generate(VerifiedResumeInput input) {
        String userPrompt = buildUserPrompt(input);

        for (String modelName : MODELS_TO_TRY) {
            for (int attempt = 1; attempt <= 2; attempt++) {
                try {
                    GeneratedResume result = attemptCall(modelName, userPrompt);
                    if (result != null) return result;
                } catch (Exception e) {
                    log.warn("[ResumeWriter] {} attempt {}/2 failed: {}", modelName, attempt, e.getMessage());
                    if (attempt < 2) {
                        try { Thread.sleep(700); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                    }
                }
            }
        }
        throw new IllegalStateException("Resume writer failed on all models — refusing to fall back to generic content.");
    }

    private GeneratedResume attemptCall(String modelName, String userPrompt) throws Exception {
        Map<String, Object> body = Map.of(
                "model", modelName,
                "temperature", 0.3,
                "max_tokens", 4096,
                // GPT-OSS models spend max_tokens on hidden reasoning first —
                // capped so it doesn't eat the JSON response.
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
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(45))
                .block();

        var root = objectMapper.readTree(raw);
        String content = root.path("choices").get(0).path("message").path("content").asText();
        if (content == null || content.isBlank()) return null;

        String clean = stripMarkdownFences(content);
        GeneratedResume result = snakeCaseMapper.readValue(clean, GeneratedResume.class);
        log.info("[ResumeWriter] {} succeeded", modelName);
        return result;
    }

    // ── Structured input — field names deliberately match what the system
    // prompt references (verified.skills, resume.bullets-equivalent) ──────
    private String buildUserPrompt(VerifiedResumeInput input) {
        try {
            String verifiedJson = snakeCaseMapper.writeValueAsString(input);
            return """
                    Here is the verified structured record. Every fact in it has already been
                    confirmed by the candidate — do not second-guess it, do not add anything
                    beyond it.

                    verified = %s

                    Write the resume now. Return ONLY the JSON object specified in your
                    instructions — no markdown fences, no prose.
                    """.formatted(verifiedJson);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize verified resume input", e);
        }
    }

    private String stripMarkdownFences(String text) {
        String clean = text.trim();
        if (clean.startsWith("```json")) clean = clean.substring(7);
        else if (clean.startsWith("```")) clean = clean.substring(3);
        if (clean.endsWith("```")) clean = clean.substring(0, clean.length() - 3);
        return clean.trim();
    }
}
