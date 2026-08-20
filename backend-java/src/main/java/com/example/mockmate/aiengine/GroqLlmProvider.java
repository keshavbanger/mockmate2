package com.example.mockmate.aiengine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
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
 * First LlmProvider implementation — a thin, self-contained Groq chat-
 * completion call. Deliberately its own WebClient call rather than an
 * extraction of the existing inline Groq integrations elsewhere in this
 * codebase (InterviewController.mockChat, InterviewPlanGeneratorService,
 * GroqATSService, ResumeWriterService, QuestionGeneratorService all already
 * do this independently, with no shared client class to wrap) — reworking
 * one of those into a shared client would touch working, unrelated
 * features. This follows the same established per-service pattern instead.
 */
@Slf4j
@Service
public class GroqLlmProvider implements LlmProvider {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    @Value("${groq.model:openai/gpt-oss-20b}")
    private String groqModel;

    public GroqLlmProvider(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.baseUrl("https://api.groq.com/openai/v1/").build();
        this.objectMapper = objectMapper;
    }

    // Some deployment environments (e.g. Render's env var UI) wrap values in
    // quotes — GroqWhisperService already guards against this; matching it
    // here so a quoted GROQ_API_KEY doesn't silently produce 401s.
    @PostConstruct
    public void init() {
        if (groqApiKey != null) {
            groqApiKey = groqApiKey.trim().replace("\"", "").replace("'", "");
        }
    }

    @Override
    public boolean isAvailable() {
        return groqApiKey != null && !groqApiKey.isBlank();
    }

    @Override
    public String generateResponse(String systemPrompt, String conversationContext, String userMessage) {
        if (!isAvailable()) {
            log.warn("[GroqLlmProvider] No GROQ_API_KEY configured — AI engine unavailable");
            return null;
        }
        String userPrompt = (conversationContext == null || conversationContext.isBlank())
                ? userMessage
                : conversationContext + "\n\n" + userMessage;
        try {
            Map<String, Object> requestBody = Map.of(
                    "model", groqModel,
                    "temperature", 0.6,
                    // GPT-OSS models reason before answering, consuming
                    // max_tokens same as the visible output — without this,
                    // reasoning alone can eat the whole budget and leave an
                    // empty/truncated reply (same quirk documented in
                    // OpenRouterFallbackService for this model family).
                    "reasoning_effort", "low",
                    "max_tokens", 400,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    )
            );

            String raw = webClient.post()
                    .uri("chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + groqApiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(20))
                    .block();

            JsonNode root = objectMapper.readTree(raw);
            if (!root.has("choices") || root.path("choices").isEmpty()) {
                log.error("[GroqLlmProvider] Response missing choices: {}", raw);
                return null;
            }
            String content = root.path("choices").get(0).path("message").path("content").asText().trim();
            return content.isEmpty() ? null : content;
        } catch (Exception e) {
            log.error("[GroqLlmProvider] Chat completion failed: {}", e.getMessage());
            return null;
        }
    }

    // Same pattern InterviewPlanGeneratorService.callGroq() already uses
    // elsewhere in this codebase — response_format=json_object, not a new
    // convention.
    @Override
    public String generateJson(String systemPrompt, String userPrompt, int maxTokens) {
        if (!isAvailable()) {
            log.warn("[GroqLlmProvider] No GROQ_API_KEY configured — AI engine unavailable");
            return null;
        }
        try {
            Map<String, Object> requestBody = Map.of(
                    "model", groqModel,
                    "temperature", 0.4,
                    "reasoning_effort", "low",
                    "max_tokens", maxTokens,
                    "response_format", Map.of("type", "json_object"),
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    )
            );

            String raw = webClient.post()
                    .uri("chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + groqApiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(20))
                    .block();

            JsonNode root = objectMapper.readTree(raw);
            if (!root.has("choices") || root.path("choices").isEmpty()) {
                log.error("[GroqLlmProvider] JSON response missing choices: {}", raw);
                return null;
            }
            String content = root.path("choices").get(0).path("message").path("content").asText().trim();
            return content.isEmpty() ? null : content;
        } catch (Exception e) {
            log.error("[GroqLlmProvider] JSON chat completion failed: {}", e.getMessage());
            return null;
        }
    }
}
