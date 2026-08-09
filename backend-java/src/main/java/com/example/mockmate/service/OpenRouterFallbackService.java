package com.example.mockmate.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Last-resort fallback for the tech-interview AI calls (live conversation,
 * plan generation, report generation) — tried only after every Groq
 * model/attempt has already failed. Groq's rate limit is shared across all
 * Groq models on one API key, so falling back from llama-3.3-70b to
 * llama-3.1-8b gives zero protection when Groq itself is rate-limited or
 * down (reproduced live: both models 429'd in the same request). OpenRouter
 * is a genuinely separate provider/infrastructure, so it's still reachable
 * when Groq as a whole is not.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OpenRouterFallbackService {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    @Value("${openrouter.api-key:}")
    private String apiKey;

    @Value("${openrouter.model:openai/gpt-oss-20b:free}")
    private String model;

    private static final String OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

    /**
     * Returns the raw JSON content string from the model, or null if the key
     * isn't configured or the call failed. Callers still need to
     * objectMapper.readValue() the result into their own response type.
     */
    public String complete(String systemPrompt, String userPrompt, int maxTokens) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("OpenRouter fallback skipped — no API key configured");
            return null;
        }
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "temperature", 0.4,
                    "max_tokens", maxTokens,
                    // gpt-oss-20b reasons before answering, and that reasoning
                    // consumes max_tokens same as the visible output — a low
                    // token budget can get entirely eaten by reasoning, leaving
                    // "content": null with finish_reason "length" and no
                    // answer at all (reproduced directly against the API).
                    // Capping reasoning effort to "low" leaves enough budget
                    // for the actual JSON response.
                    "reasoning", Map.of("effort", "low"),
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    )
            );
            String raw = webClientBuilder.build()
                    .post().uri(OPENROUTER_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    // This is already the last-resort path after Groq has
                    // failed entirely — a slower response here beats falling
                    // through to hardcoded generic content. Free-tier
                    // gpt-oss-20b throughput is roughly ~18 tokens/sec by
                    // observed measurement, so a large completion (e.g. plan
                    // generation's full multi-round schema, up to 4096
                    // tokens) can need up to ~90s; smaller calls (live
                    // conversation turns, report enrichment) finish in
                    // single-digit seconds. If it still times out here, the
                    // caller's own final fallback (e.g. the hardcoded default
                    // plan) takes over — this was already the behavior before
                    // OpenRouter existed, so nothing regresses.
                    .timeout(Duration.ofSeconds(90))
                    .block();

            if (raw == null || raw.isBlank()) return null;
            JsonNode root = objectMapper.readTree(raw);
            String content = root.path("choices").get(0).path("message").path("content").asText();
            if (content == null || content.isBlank()) return null;
            return stripCodeFences(content);
        } catch (Exception e) {
            log.warn("OpenRouter fallback call failed: {}", e.getMessage());
            return null;
        }
    }

    // Unlike Groq (called with response_format=json_object to force clean
    // JSON), OpenRouter's free open-weight models don't reliably support
    // forced JSON mode, so despite the "return ONLY valid JSON" instruction
    // they sometimes wrap the response in ```json ... ``` fences anyway.
    private String stripCodeFences(String content) {
        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            trimmed = trimmed.replaceFirst("^```[a-zA-Z]*\\n?", "");
            if (trimmed.endsWith("```")) {
                trimmed = trimmed.substring(0, trimmed.length() - 3);
            }
        }
        return trimmed.trim();
    }
}
