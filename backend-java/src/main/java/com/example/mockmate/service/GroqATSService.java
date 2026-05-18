package com.example.mockmate.service;

import com.example.mockmate.model.ATSReport;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class GroqATSService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    private static final String GROQ_URL =
            "https://api.groq.com/openai/v1/chat/completions";

    private static final String MODEL = "llama-3.3-70b-versatile";

    private static final String SYSTEM_PROMPT = """
            You are an ATS analysis engine. Respond ONLY with valid JSON.
            No markdown, no explanation, no preamble outside the JSON.
            Return this exact schema:
            {
              "semanticScore": 0-100,
              "keywordMatchScore": 0-100,
              "roleAlignmentScore": 0-100,
              "missingKeywords": ["string"],
              "matchedKeywords": ["string"],
              "sectionFeedback": {
                "summary": "present|missing|weak",
                "skills": "present|missing|weak",
                "experience": "present|missing|weak",
                "projects": "present|missing|weak",
                "education": "present|missing|weak"
              },
              "bulletRewrites": [
                { "original": "string", "rewritten": "string", "reason": "string" }
              ],
              "strengthLines": ["string"],
              "verdict": "Strong fit|Good fit|Moderate fit|Weak fit",
              "verdictReason": "string"
            }
            """;

    @Data
    @Builder
    public static class GroqATSResult {
        private int                          semanticScore;
        private int                          keywordMatchScore;
        private int                          roleAlignmentScore;
        private List<String>                 missingKeywords;
        private List<String>                 matchedKeywords;
        private Map<String, String>          sectionFeedback;
        private List<ATSReport.BulletRewrite> bulletRewrites;
        private List<String>                 strengthLines;
        private String                       verdict;
        private String                       verdictReason;
    }

    public GroqATSService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient    = webClientBuilder.build();
        this.objectMapper = objectMapper;
    }

    public GroqATSResult analyze(String resumeText, String jdText) {
        if (groqApiKey == null || groqApiKey.isBlank()) {
            log.warn("GROQ_API_KEY not set — returning empty Groq result");
            return emptyResult();
        }

        String userPrompt = buildUserPrompt(resumeText, jdText);

        Map<String, Object> requestBody = Map.of(
            "model", MODEL,
            "temperature", 0.2,
            "max_tokens", 2048,
            "messages", List.of(
                Map.of("role", "system", "content", SYSTEM_PROMPT),
                Map.of("role", "user",   "content", userPrompt)
            )
        );

        try {
            String raw = webClient.post()
                    .uri(GROQ_URL)
                    .header("Authorization", "Bearer " + groqApiKey.trim())
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            var root    = objectMapper.readTree(raw);
            String text = root.path("choices").get(0)
                    .path("message").path("content").asText();

            String cleanJson = stripMarkdownFences(text);
            Map<String, Object> parsed = objectMapper.readValue(
                    cleanJson, new TypeReference<Map<String, Object>>() {});

            return mapToResult(parsed);

        } catch (Exception e) {
            log.error("Groq API call failed — falling back to empty result", e);
            return emptyResult();
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String buildUserPrompt(String resumeText, String jdText) {
        String resumeSnip = resumeText.length() > 3000
                ? resumeText.substring(0, 3000) + "\n[truncated]"
                : resumeText;
        String jdSnip = jdText.length() > 1500
                ? jdText.substring(0, 1500) + "\n[truncated]"
                : jdText;

        return "RESUME:\n" + resumeSnip + "\n\nJOB DESCRIPTION:\n" + jdSnip;
    }

    @SuppressWarnings("unchecked")
    private GroqATSResult mapToResult(Map<String, Object> m) {
        List<ATSReport.BulletRewrite> rewrites = List.of();
        if (m.get("bulletRewrites") instanceof List<?> rawList) {
            rewrites = ((List<Map<String, Object>>) rawList).stream()
                    .map(r -> ATSReport.BulletRewrite.builder()
                            .original((String) r.getOrDefault("original", ""))
                            .rewritten((String) r.getOrDefault("rewritten", ""))
                            .reason((String) r.getOrDefault("reason", ""))
                            .build())
                    .toList();
        }

        return GroqATSResult.builder()
                .semanticScore(toInt(m.get("semanticScore")))
                .keywordMatchScore(toInt(m.get("keywordMatchScore")))
                .roleAlignmentScore(toInt(m.get("roleAlignmentScore")))
                .missingKeywords(toStringList(m.get("missingKeywords")))
                .matchedKeywords(toStringList(m.get("matchedKeywords")))
                .sectionFeedback(m.get("sectionFeedback") instanceof Map<?, ?>
                        ? (Map<String, String>) m.get("sectionFeedback") : Map.of())
                .bulletRewrites(rewrites)
                .strengthLines(toStringList(m.get("strengthLines")))
                .verdict((String) m.getOrDefault("verdict", "Moderate fit"))
                .verdictReason((String) m.getOrDefault("verdictReason", ""))
                .build();
    }

    private GroqATSResult emptyResult() {
        return GroqATSResult.builder()
                .semanticScore(0).keywordMatchScore(0).roleAlignmentScore(0)
                .missingKeywords(List.of()).matchedKeywords(List.of())
                .sectionFeedback(Map.of()).bulletRewrites(List.of())
                .strengthLines(List.of()).verdict("Moderate fit").verdictReason("")
                .build();
    }

    private String stripMarkdownFences(String text) {
        String clean = text.trim();
        if (clean.startsWith("```json")) clean = clean.substring(7);
        else if (clean.startsWith("```"))  clean = clean.substring(3);
        if (clean.endsWith("```"))         clean = clean.substring(0, clean.length() - 3);
        return clean.trim();
    }

    private int toInt(Object v) {
        return v instanceof Number n ? n.intValue() : 0;
    }

    @SuppressWarnings("unchecked")
    private List<String> toStringList(Object v) {
        if (v instanceof List<?> l) return (List<String>) l;
        return List.of();
    }
}
