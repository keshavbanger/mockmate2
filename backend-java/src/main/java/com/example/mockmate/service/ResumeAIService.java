package com.example.mockmate.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * AI assistance for the Resume Builder.
 * All calls route through this backend service — the Groq API key never
 * reaches the frontend.
 *
 * Abstraction note: calls are dispatched through named methods so that
 * swapping the AI provider (Groq → OpenAI → Gemini) only requires changing
 * this class, not the controller or frontend.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeAIService {

    @Value("${groq.api.key:}")
    private String groqApiKey;

    private final ObjectMapper objectMapper;
    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL    = "llama-3.3-70b-versatile";

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Generate a professional summary.
     *
     * @param jobTitle     candidate's target title
     * @param yearsExp     years of experience (may be null / "")
     * @param skills       comma-separated skills
     * @param style        "professional" | "concise" | "achievement-focused"
     */
    public String generateSummary(String jobTitle, String yearsExp, String skills, String style) {
        String styleGuide = switch (style != null ? style : "professional") {
            case "concise"             -> "Keep it to 2 sentences maximum.";
            case "achievement-focused" -> "Lead with quantified achievements wherever possible.";
            case "technical"           -> "Emphasise technical depth and specific technologies.";
            case "leadership"          -> "Emphasise leadership, ownership, and people impact.";
            default                    -> "3-4 sentences, professional tone.";
        };

        String prompt = String.format("""
            Write a professional resume summary for a %s with %s of experience.
            Skills: %s
            Style: %s
            Rules:
            - Write in first person implied (no "I")
            - Be specific, not generic
            - Do NOT fabricate companies, metrics, or achievements not mentioned
            - Return ONLY the summary text, no labels or quotes
            """, jobTitle, yearsExp != null ? yearsExp : "relevant", skills, styleGuide);

        return callGroq(prompt, 200);
    }

    /**
     * Improve a single bullet point.
     *
     * @param original original bullet text
     * @param style    "professional" | "achievement-focused" | "concise" | "technical"
     */
    public String improveBullet(String original, String style) {
        String styleGuide = switch (style != null ? style : "professional") {
            case "achievement-focused" -> "Start with a strong action verb, add impact/outcome if inferable. Mark any invented metric as [VERIFY: X].";
            case "concise"             -> "Keep under 15 words, start with strong action verb.";
            case "technical"           -> "Emphasise specific technologies, tools, and technical outcomes.";
            default                    -> "Start with a strong action verb, be specific and professional.";
        };

        String prompt = String.format("""
            Improve this resume bullet point:
            "%s"

            Style: %s

            Rules:
            - Start with a strong action verb
            - Be specific and professional
            - Do NOT invent metrics, companies, or facts not in the original
            - If you want to suggest a metric, write [VERIFY: your suggestion] instead
            - Return ONLY the improved bullet text, nothing else
            """, original, styleGuide);

        return callGroq(prompt, 150);
    }

    /**
     * Generate bullet points for a job experience entry.
     *
     * @param jobTitle        title of the role
     * @param company         company name
     * @param responsibilities user-supplied responsibilities (free text)
     * @param count           number of bullets to generate
     */
    public List<String> generateBullets(String jobTitle, String company,
                                         String responsibilities, int count) {
        String prompt = String.format("""
            Generate %d professional resume bullet points for a %s role at %s.
            User-provided context: %s

            Rules:
            - Each bullet starts with a strong action verb
            - Be specific; do NOT invent facts not implied by the context
            - If suggesting metrics, write [VERIFY: suggestion] as placeholder
            - Return ONLY a JSON array of strings, e.g. ["Bullet one", "Bullet two"]
            - No explanations, no markdown wrapping
            """, count, jobTitle, company, responsibilities);

        String raw = callGroq(prompt, 400);
        try {
            JsonNode node = objectMapper.readTree(raw.trim());
            if (node.isArray()) {
                List<String> bullets = new ArrayList<>();
                for (JsonNode n : node) bullets.add(n.asText());
                return bullets;
            }
        } catch (Exception e) {
            log.warn("[ResumeAI] generateBullets parse failed, returning raw: {}", e.getMessage());
        }
        // Fallback: split by newline
        return Arrays.stream(raw.split("\n"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    private String callGroq(String userPrompt, int maxTokens) {
        if (groqApiKey == null || groqApiKey.isBlank()) {
            throw new IllegalStateException("Groq API key not configured");
        }

        RestTemplate rt = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(groqApiKey);

        Map<String, Object> message = Map.of("role", "user", "content", userPrompt);
        Map<String, Object> body = Map.of(
            "model",       MODEL,
            "messages",    List.of(message),
            "max_tokens",  maxTokens,
            "temperature", 0.7
        );

        try {
            ResponseEntity<JsonNode> resp = rt.exchange(
                GROQ_URL, HttpMethod.POST,
                new HttpEntity<>(body, headers),
                JsonNode.class
            );
            if (resp.getBody() != null) {
                return resp.getBody()
                    .path("choices").get(0)
                    .path("message").path("content")
                    .asText("").trim();
            }
        } catch (Exception e) {
            log.error("[ResumeAI] Groq call failed: {}", e.getMessage());
            throw new RuntimeException("AI service unavailable: " + e.getMessage());
        }
        throw new RuntimeException("AI service returned empty response");
    }
}
