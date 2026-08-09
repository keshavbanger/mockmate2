package com.example.mockmate.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class TavusService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${tavus.api-key}")
    private String tavusApiKey;

    @Value("${tavus.replica-id}")
    private String tavusReplicaId;

    @PostConstruct
    public void logConfig() {
        boolean live = !isTestMode();
        log.info("[TavusService] Mode: {} | Replica: {} | Key prefix: {}",
                live ? "LIVE" : "TEST",
                tavusReplicaId,
                tavusApiKey.length() > 8 ? tavusApiKey.substring(0, 8) + "..." : "(short/empty)");
    }

    @Value("${backend.url:http://localhost:8080}")
    private String backendUrl;

    private static final String SYSTEM_PROMPT_TEMPLATE = """
            You are InterviewBot, a professional and empathetic AI interview coach.
            You are conducting a %s interview at %s level in %s.
            
            Candidate Resume:
            - Name: %s
            - Skills: %s
            - Experience: %s
            - Companies: %s
            - Education: %s
            
            Your Questions (ask in this order, adapt follow-ups based on answers):
            %s
            
            Behavior Rules:
            - Start with: "Hello %s! Welcome to your mock interview. I'm InterviewBot. Let's begin with a quick introduction — please tell me about yourself."
            - Ask ONE question at a time. Never ask two questions together.
            - After each answer, give a 1-sentence acknowledgment, then ask the next question.
            - If the candidate's answer is under 15 words, prompt once: "Could you elaborate a bit more on that?"
            - After all 7 questions, say: "That brings us to the end of the interview. You did great, %s. Your detailed performance report will be ready shortly. Thank you!"
            - Never reveal scores, never give feedback during the interview.
            - Be warm, professional, and encouraging throughout.
            - Do not go off-topic. Bring the conversation back to the interview if needed.
            """;

    public TavusService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.baseUrl("https://tavusapi.com/v2").build();
        this.objectMapper = objectMapper;
    }

    private boolean isTestMode() {
        return tavusApiKey == null
                || tavusApiKey.isBlank()
                || "test".equalsIgnoreCase(tavusApiKey.trim());
    }

    public String createPersona(Map<String, Object> resumeData, List<String> questions, String interviewType, String difficulty, String language) {
        StringBuilder numberedQuestions = new StringBuilder();
        for (int i = 0; i < questions.size(); i++) {
            numberedQuestions.append(i + 1).append(". ").append(questions.get(i)).append("\n");
        }

        String name = (String) resumeData.getOrDefault("name", "Candidate");
        String skills = String.join(", ", (List<String>) resumeData.getOrDefault("skills", List.of()));
        if (skills.isEmpty()) skills = "Not specified";
        String experience = resumeData.getOrDefault("totalExperienceYears", 0) + " years";
        String companies = String.join(", ", (List<String>) resumeData.getOrDefault("companies", List.of()));
        if (companies.isEmpty()) companies = "Not specified";
        String education = String.join(", ", (List<String>) resumeData.getOrDefault("education", List.of()));
        if (education.isEmpty()) education = "Not specified";

        String systemPrompt = String.format(SYSTEM_PROMPT_TEMPLATE,
                interviewType, difficulty, language,
                name, skills, experience, companies, education,
                numberedQuestions.toString(),
                name, name
        );

        Map<String, Object> payload = new HashMap<>();
        payload.put("persona_name", "InterviewBot-" + interviewType + "-" + difficulty);
        payload.put("system_prompt", systemPrompt);
        payload.put("default_replica_id", tavusReplicaId);
        payload.put("context", "This is a " + difficulty + "-level " + interviewType + " interview. The candidate is " + name + ".");
        // NOTE: Do NOT include 'layers.llm.model' or 'pipeline_mode' unless on an Enterprise plan
        //       They cause 422/400 errors that silently fall through to mock mode.

        if (isTestMode()) {
            log.warn("TEST MODE: returning mock persona_id");
            return "test-persona-123";
        }

        try {
            String response = webClient.post()
                    .uri("/personas")
                    .header("x-api-key", tavusApiKey.trim())
                    .header("Content-Type", "application/json")
                    .bodyValue(payload)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                        clientResponse -> clientResponse.bodyToMono(String.class)
                            .flatMap(errorBody -> {
                                log.error("[TavusService] Persona HTTP {} — body: {}", clientResponse.statusCode(), errorBody);
                                return Mono.error(new RuntimeException("Tavus persona API error: " + errorBody));
                            })
                    )
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(30))
                    .block();
            log.info("[TavusService] Persona API raw response: {}", response);
            JsonNode root = objectMapper.readTree(response);
            if (root.has("persona_id")) return root.get("persona_id").asText();
            if (root.has("id"))         return root.get("id").asText();
            log.error("[TavusService] Persona response had no ID. Full response: {}", response);
            throw new RuntimeException("Tavus returned no persona_id. Response: " + response);
        } catch (WebClientResponseException e) {
            log.error("[TavusService] Persona HTTP {} — body: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return "test-persona-123";
        } catch (Exception e) {
            log.error("[TavusService] Persona creation error: {}", e.getMessage());
            return "test-persona-123";
        }
    }

    public Map<String, String> createConversation(String personaId, String candidateName, String sessionId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("persona_id", personaId);
        payload.put("conversation_name", "Interview: " + candidateName);
        
        String callbackUrl = backendUrl + "/api/tavus-webhook";
        if (callbackUrl != null && !callbackUrl.contains("localhost") && !callbackUrl.contains("127.0.0.1") && callbackUrl.startsWith("https://")) {
            payload.put("callback_url", callbackUrl);
            log.info("[TavusService] Configured webhook callback_url: {}", callbackUrl);
        } else {
            log.warn("[TavusService] Skipping callback_url because backend URL is local or non-HTTPS: {}", callbackUrl);
        }

        payload.put("properties", Map.of(
                "max_call_duration", 1800,
                "participant_left_timeout", 60,
                "enable_recording", false,
                "apply_greenscreen", false
        ));
        payload.put("custom_greeting", "Hello " + candidateName + "! Welcome to your mock interview. I'm InterviewBot. Let's begin with a quick introduction — please tell me about yourself.");

        if (isTestMode()) {
            log.warn("TEST MODE: returning mock conversation URL");
            return Map.of(
                    "conversation_id", "test-conv-" + candidateName.toLowerCase().replace(" ", "-") + "-123",
                    "conversation_url", "https://tavus.daily.co/test-room"
            );
        }

        try {
            String response = webClient.post()
                    .uri("/conversations")
                    .header("x-api-key", tavusApiKey.trim())
                    .header("Content-Type", "application/json")
                    .bodyValue(payload)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                        clientResponse -> clientResponse.bodyToMono(String.class)
                            .flatMap(errorBody -> {
                                log.error("[TavusService] Conversation HTTP {} — body: {}", clientResponse.statusCode(), errorBody);
                                return Mono.error(new RuntimeException("Tavus conversation API error: " + errorBody));
                            })
                    )
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(30))
                    .block();
            log.info("[TavusService] Conversation API raw response: {}", response);
            JsonNode root = objectMapper.readTree(response);
            String conversationId  = root.has("conversation_id") ? root.get("conversation_id").asText() : root.get("id").asText();
            String conversationUrl = root.get("conversation_url").asText();
            log.info("[TavusService] Live conversation → ID: {}, URL: {}", conversationId, conversationUrl);
            return Map.of("conversation_id", conversationId, "conversation_url", conversationUrl);
        } catch (WebClientResponseException e) {
            log.error("[TavusService] Conversation HTTP {} — body: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return Map.of(
                    "conversation_id", "test-conv-fallback",
                    "conversation_url", "https://tavus.daily.co/test-room"
            );
        } catch (Exception e) {
            log.error("[TavusService] Conversation creation error: {}", e.getMessage());
            return Map.of(
                    "conversation_id", "test-conv-fallback",
                    "conversation_url", "https://tavus.daily.co/test-room"
            );
        }
    }

    public void endConversation(String conversationId) {
        if (isTestMode()) return;
        try {
            webClient.post()
                    .uri("/conversations/" + conversationId + "/end")
                    .header("x-api-key", tavusApiKey)
                    .retrieve()
                    .bodyToMono(Void.class)
                    .block();
            log.info("Successfully ended Tavus conversation: {}", conversationId);
        } catch (Exception e) {
            log.error("Failed to end Tavus conversation: {}", conversationId, e);
        }
    }

    public List<Map<String, Object>> getTranscript(String conversationId) {
        if (isTestMode()) {
            log.warn("TEST MODE: returning empty mock transcript");
            return List.of();
        }

        try {
            String response = webClient.get()
                    .uri("/conversations/" + conversationId + "?verbose=true")
                    .header("x-api-key", tavusApiKey)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = objectMapper.readTree(response);
            log.info("Fetched Tavus conversation data for {}", conversationId);

            List<Map<String, Object>> turns = new ArrayList<>();
            JsonNode transcriptNode = null;

            if (root.has("transcript")) {
                transcriptNode = root.get("transcript");
            } else if (root.has("events") && root.get("events").isArray()) {
                for (JsonNode eventNode : root.get("events")) {
                    if ("application.transcription_ready".equals(eventNode.path("event_type").asText())) {
                        JsonNode props = eventNode.get("properties");
                        if (props != null && props.has("transcript")) {
                            transcriptNode = props.get("transcript");
                            break;
                        }
                    }
                }
            }

            if (transcriptNode != null && transcriptNode.isArray()) {
                for (JsonNode turnNode : transcriptNode) {
                    Map<String, Object> turn = new HashMap<>();
                    String text = turnNode.has("content") ? turnNode.path("content").asText() : turnNode.path("text").asText();

                    // ── SYSTEM PROMPT LEAK GUARD ────────────────────────────────────────────
                    // Tavus sometimes returns the persona system prompt as the first "assistant"
                    // turn. Detect and drop it: system prompts are extremely long and contain
                    // signature strings that never appear in real interview speech.
                    boolean isSystemPromptLeak = text.contains("You are InterviewBot")
                            || text.contains("Behavior Rules:")
                            || text.contains("SYSTEM_PROMPT")
                            || (text.length() > 2000 && text.contains("interview"));
                    if (isSystemPromptLeak) {
                        log.warn("[TavusService] Dropping system-prompt leak turn ({} chars) for conversation {}",
                                text.length(), conversationId);
                        continue;
                    }
                    // ────────────────────────────────────────────────────────────────────────

                    turn.put("text", text);

                    String role = turnNode.path("role").asText("candidate");
                    turn.put("role", "assistant".equalsIgnoreCase(role) || "ai".equalsIgnoreCase(role) ? "interviewer" : "candidate");
                    
                    double startTime = turnNode.has("start_time") 
                            ? turnNode.path("start_time").asDouble(0.0) 
                            : turnNode.path("seconds_from_start").asDouble(0.0);
                    
                    turn.put("timestamp_ms", System.currentTimeMillis()); // Fallback for now
                    turn.put("relative_seconds", startTime);
                    
                    turns.add(turn);
                }
            }
            return turns;
        } catch (Exception e) {
            log.error("Failed to fetch Tavus transcript", e);
            return List.of();
        }
    }
}
