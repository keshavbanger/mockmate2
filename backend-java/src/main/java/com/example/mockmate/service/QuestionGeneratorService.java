package com.example.mockmate.service;

import com.example.mockmate.config.CompanyPromptConfig;
import com.example.mockmate.dto.response.ResumeParsedResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class QuestionGeneratorService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    // ── Legacy plain-array prompt (no JD, no company style) ─────────────────
    private static final String STANDARD_PROMPT = """
            Generate exactly 7 interview questions for a %s level %s interview.

            Candidate profile:
            - Skills: %s
            - Job titles held: %s
            - Companies worked at: %s
            - Education: %s
            - Total experience: %.1f years

            Requirements:
            - Questions must be progressively harder (Q1 easiest -> Q7 hardest).
            - Interview type is "%s": tailor questions accordingly.
            - Technical: focus on coding, system design, architecture, problem-solving
            - Behavioral: focus on STAR-method situational questions
            - HR: focus on culture fit, motivation, salary, goals
            - Mixed: blend of all three types
            - Difficulty level is "%s":
            - Junior: foundational concepts, basic scenarios
            - Mid: intermediate depth, real-world trade-offs
            - Senior: complex, leadership, architectural decisions
            - Language instruction: questions should be asked in %s.
            - English: standard professional English
            - Hindi: modern Hindi with technical terms kept in English
            - Hinglish: natural mix of Hindi and English as spoken in Indian tech interviews
            - Do NOT number the questions inside the strings.
            - Return ONLY a JSON array of exactly 7 strings. No markdown, no explanation, no extra text.

            Example format:
            ["Question one?", "Question two?", "Question three?", "Question four?", "Question five?", "Question six?", "Question seven?"]
            """;

    // ── Unified prompt: company style + optional JD + resume ─────────────────
    // Used whenever companyId != "general" OR jobDescription is provided.
    private static final String UNIFIED_PROMPT = """
            You are a senior interviewer conducting a mock interview.

            %s

            CANDIDATE RESUME:
            - Name: %s
            - Skills: %s
            - Job titles held: %s
            - Companies worked at: %s
            - Education: %s
            - Total experience: %.1f years

            %s

            Generate exactly 8 interview questions following the style guide above.
            If no style guide is given, generate a balanced general interview.
            %s

            Respond ONLY with valid JSON (no markdown, no extra text):
            {
              "questions": [
                {
                  "id": 1,
                  "question": "...",
                  "type": "technical|behavioral|system-design|motivation",
                  "targetSkill": "...",
                  "difficulty": "easy|medium|hard",
                  "leadershipPrinciple": null
                }
              ],
              "interviewStyle": "%s",
              "skillGaps": [],
              "matchedSkills": []
            }
            """;

    // ── Thread-local: stores JD extras between service and controller ─────────
    private final ThreadLocal<Map<String, Object>> jdExtras = new ThreadLocal<>();

    public QuestionGeneratorService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.baseUrl("https://api.groq.com/openai/v1/").build();
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        if (groqApiKey != null) {
            groqApiKey = groqApiKey.trim().replace("\"", "").replace("'", "");
            log.info("QuestionGeneratorService: Groq API Key sanitized.");
        }
    }

    // ── Public API: backward-compat overload ──────────────────────────────────
    public List<String> generateQuestions(
            ResumeParsedResponse resumeData,
            String interviewType,
            String difficulty,
            String language
    ) {
        return generateQuestions(resumeData, interviewType, difficulty, language, null, null);
    }

    // ── Public API: JD-aware (old 5-arg) ─────────────────────────────────────
    public List<String> generateQuestions(
            ResumeParsedResponse resumeData,
            String interviewType,
            String difficulty,
            String language,
            String jobDescription
    ) {
        return generateQuestions(resumeData, interviewType, difficulty, language, jobDescription, null);
    }

    // ── Public API: full (company + JD) — main entry point ───────────────────
    public List<String> generateQuestions(
            ResumeParsedResponse resumeData,
            String interviewType,
            String difficulty,
            String language,
            String jobDescription,
            String companyId
    ) {
        String styleGuide = CompanyPromptConfig.getStyleGuide(companyId);
        boolean hasJD      = jobDescription != null && !jobDescription.isBlank();
        boolean hasCompany = !styleGuide.isBlank();

        // Use standard plain-array prompt only when there is no JD and no company style
        if (!hasJD && !hasCompany) {
            return generateStandard(resumeData, interviewType, difficulty, language);
        }

        return generateUnified(resumeData, jobDescription, styleGuide, companyId);
    }

    // ── Retrieve and clear the thread-local JD extras ────────────────────────
    public Map<String, Object> getLastJdExtras() {
        Map<String, Object> extras = jdExtras.get();
        jdExtras.remove();
        return extras;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // INTERNAL: standard path (no company, no JD) → plain string-array
    // ────────────────────────────────────────────────────────────────────────────
    private List<String> generateStandard(ResumeParsedResponse r,
                                           String interviewType,
                                           String difficulty,
                                           String language) {
        String prompt = String.format(STANDARD_PROMPT,
                difficulty, interviewType,
                join(r.getSkills()).replace("%", "%%"),
                join(r.getJobTitles()).replace("%", "%%"),
                join(r.getCompanies()).replace("%", "%%"),
                join(r.getEducation()).replace("%", "%%"),
                r.getTotalExperienceYears(),
                interviewType, difficulty, language
        );
        return callGroqForStringArray(prompt);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // INTERNAL: unified path → structured JSON schema
    // ────────────────────────────────────────────────────────────────────────────
    private List<String> generateUnified(ResumeParsedResponse r,
                                          String jobDescription,
                                          String styleGuide,
                                          String companyId) {
        boolean hasJD = jobDescription != null && !jobDescription.isBlank();

        // Build the optional JD block
        String jdSection = hasJD
                ? "TARGET JOB DESCRIPTION:\n" + jobDescription + "\n\nCompare the resume against this JD carefully.\n" +
                  "Identify: skillGaps (in JD but absent/weak in resume) and matchedSkills (strong overlap).\n" +
                  "Include 2 gap-probing questions and 1 motivation question in the 8 questions."
                : "No specific job description provided. Generate a balanced interview based on the resume and style guide.";

        // Build the extra instruction block for JD breakdown
        String breakdownNote = hasJD
                ? "For JD mode: 3 technical on candidate's existing skills, 2 gap-probing, 2 behavioral STAR, 1 motivation."
                : "";

        String effectiveStyle = (companyId != null && !companyId.isBlank()) ? companyId : "general";

        String prompt = String.format(UNIFIED_PROMPT,
                styleGuide.isBlank() ? "(No specific company style — standard interview)" : styleGuide,
                r.getName() != null ? r.getName() : "Candidate",
                join(r.getSkills()),
                join(r.getJobTitles()),
                join(r.getCompanies()),
                join(r.getEducation()),
                r.getTotalExperienceYears(),
                jdSection,
                breakdownNote,
                effectiveStyle
        );

        return callGroqForUnifiedSchema(prompt);
    }

    // ── Groq call: plain JSON string array (standard path) ───────────────────
    private List<String> callGroqForStringArray(String prompt) {
        String raw = callGroq(prompt, 2048,
                "You are an interview question generator. Return ONLY a valid JSON array of strings, no markdown formatting.");
        try {
            var root    = objectMapper.readTree(raw);
            String content = root.path("choices").get(0).path("message").path("content").asText();
            String clean   = stripFences(content);
            List<String> questions = objectMapper.readValue(clean, new TypeReference<List<String>>() {});
            while (questions.size() < 7) questions.add("Tell me more about your experience.");
            if (questions.size() > 7)   questions = new ArrayList<>(questions.subList(0, 7));
            return questions.stream().map(String::trim).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to parse standard Groq response: {}", raw, e);
            throw new RuntimeException("Failed to parse Groq response", e);
        }
    }

    // ── Groq call: unified schema (company/JD path) ───────────────────────────
    private List<String> callGroqForUnifiedSchema(String prompt) {
        String raw = callGroq(prompt, 3500,
                "You are a senior technical interviewer. Return ONLY valid JSON matching the requested schema, no markdown.");
        try {
            var root    = objectMapper.readTree(raw);
            String content = root.path("choices").get(0).path("message").path("content").asText();
            String clean   = stripFences(content);
            var parsed  = objectMapper.readTree(clean);

            // Extract questions
            List<String> questions = new ArrayList<>();
            List<Map<String, Object>> richQuestions = new ArrayList<>();
            for (var q : parsed.path("questions")) {
                questions.add(q.path("question").asText());
                Map<String, Object> rq = new HashMap<>();
                rq.put("id",                  q.path("id").asInt());
                rq.put("question",             q.path("question").asText());
                rq.put("type",                 q.path("type").asText("general"));
                rq.put("targetSkill",          q.path("targetSkill").asText(""));
                rq.put("difficulty",           q.path("difficulty").asText("medium"));
                String lp = q.path("leadershipPrinciple").asText("");
                rq.put("leadershipPrinciple",  lp.isBlank() ? null : lp);
                richQuestions.add(rq);
            }
            if (questions.isEmpty()) throw new RuntimeException("Unified response contained no questions");
            while (questions.size() < 7) questions.add("Tell me more about your relevant experience.");

            // Extract skill gaps / matched skills
            List<String> skillGaps    = new ArrayList<>();
            List<String> matchedSkills = new ArrayList<>();
            for (var g : parsed.path("skillGaps"))    skillGaps.add(g.asText());
            for (var m : parsed.path("matchedSkills")) matchedSkills.add(m.asText());

            String interviewStyle = parsed.path("interviewStyle").asText("general");

            // Stash everything for the controller
            Map<String, Object> extras = new HashMap<>();
            extras.put("skillGaps",      skillGaps);
            extras.put("matchedSkills",  matchedSkills);
            extras.put("interviewStyle", interviewStyle);
            extras.put("richQuestions",  richQuestions);
            jdExtras.set(extras);

            log.info("Unified mode ({}): {} questions, {} gaps, {} matches",
                    interviewStyle, questions.size(), skillGaps.size(), matchedSkills.size());

            return questions.stream().map(String::trim).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to parse unified Groq response: {}", raw, e);
            throw new RuntimeException("Failed to parse unified Groq response", e);
        }
    }

    // ── Shared Groq HTTP call ─────────────────────────────────────────────────
    private String callGroq(String userPrompt, int maxTokens, String systemPrompt) {
        Map<String, Object> body = Map.of(
                "model",       "llama-3.1-8b-instant",
                "temperature", 0.5,
                "max_tokens",  maxTokens,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user",   "content", userPrompt)
                )
        );
        try {
            return webClient.post()
                    .uri("chat/completions")
                    .header("Authorization", "Bearer " + groqApiKey.trim())
                    .header("Content-Type", "application/json")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
        } catch (Exception e) {
            log.error("Groq HTTP call failed", e);
            throw new RuntimeException("Groq API error: " + e.getMessage(), e);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private String join(List<String> items) {
        return items == null || items.isEmpty() ? "Not specified" : String.join(", ", items);
    }

    private String stripFences(String text) {
        String clean = text.trim();
        if (clean.startsWith("```json")) clean = clean.substring(7);
        else if (clean.startsWith("```")) clean = clean.substring(3);
        if (clean.endsWith("```")) clean = clean.substring(0, clean.length() - 3);
        return clean.trim();
    }
}
