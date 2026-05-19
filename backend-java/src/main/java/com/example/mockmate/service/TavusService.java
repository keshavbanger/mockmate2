package com.example.mockmate.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

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
        payload.put("pipeline_mode", "full");
        payload.put("context", "This is a " + difficulty + "-level " + interviewType + " interview. The candidate is " + name + ".");
        // tavus-gpt-4.1 was deprecated; tavus-gpt-oss is the current recommended default
        payload.put("layers", Map.of("llm", Map.of("model", "tavus-gpt-oss")));

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
                    .bodyToMono(String.class)
                    .block();
            log.info("[TavusService] Persona API raw response: {}", response);
            JsonNode root = objectMapper.readTree(response);
            if (root.has("persona_id")) return root.get("persona_id").asText();
            if (root.has("id")) return root.get("id").asText();
            log.error("[TavusService] Persona response had no ID field. Full response: {}", response);
            throw new RuntimeException("Tavus returned no persona_id. Response: " + response);
        } catch (WebClientResponseException e) {
            log.error("[TavusService] Persona creation HTTP {} error. Body: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return "test-persona-123";
        } catch (Exception e) {
            log.error("[TavusService] Persona creation unexpected error:", e);
            return "test-persona-123";
        }
    }

    public Map<String, String> createConversation(String personaId, String candidateName, String sessionId) {
        String callbackUrl = backendUrl + "/api/tavus-webhook";

        Map<String, Object> payload = new HashMap<>();
        payload.put("persona_id", personaId);
        payload.put("conversation_name", "Interview: " + candidateName);
        payload.put("callback_url", callbackUrl);
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
                    .bodyToMono(String.class)
                    .block();
            log.info("[TavusService] Conversation API raw response: {}", response);
            JsonNode root = objectMapper.readTree(response);
            String conversationId = root.has("conversation_id") ? root.get("conversation_id").asText() : root.get("id").asText();
            String conversationUrl = root.get("conversation_url").asText();
            log.info("[TavusService] Live conversation created → ID: {}, URL: {}", conversationId, conversationUrl);
            return Map.of("conversation_id", conversationId, "conversation_url", conversationUrl);
        } catch (WebClientResponseException e) {
            log.error("[TavusService] Conversation creation HTTP {} error. Body: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return Map.of(
                    "conversation_id", "test-conv-" + candidateName.toLowerCase().replace(" ", "-") + "-123",
                    "conversation_url", "https://tavus.daily.co/test-room"
            );
        } catch (Exception e) {
            log.error("[TavusService] Conversation creation unexpected error:", e);
            return Map.of(
                    "conversation_id", "test-conv-" + candidateName.toLowerCase().replace(" ", "-") + "-123",
                    "conversation_url", "https://tavus.daily.co/test-room"
            );
        }
    }

    public void endConversation(String conversationId) {
        if (isTestMode()) return;
        try {
            webClient.delete()
                    .uri("/conversations/" + conversationId)
                    .header("x-api-key", tavusApiKey)
                    .retrieve()
                    .bodyToMono(Void.class)
                    .block();
        } catch (Exception e) {
            log.error("Failed to end Tavus conversation", e);
        }
    }

    public List<Map<String, Object>> getTranscript(String conversationId) {
        if (isTestMode()) {
            log.warn("TEST MODE: returning empty mock transcript");
            return List.of();
        }

        try {
            String response = webClient.get()
                    .uri("/conversations/" + conversationId)
                    .header("x-api-key", tavusApiKey)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = objectMapper.readTree(response);
            log.info("Fetched Tavus conversation data for {}", conversationId);

            List<Map<String, Object>> turns = new ArrayList<>();
            if (root.has("transcript")) {
                JsonNode transcriptNode = root.get("transcript");
                if (transcriptNode.isArray()) {
                    for (JsonNode turnNode : transcriptNode) {
                        Map<String, Object> turn = new HashMap<>();
                        // Tavus V2 transcript format usually has 'text', 'role', and 'start_time'
                        turn.put("text", turnNode.path("text").asText());
                        String role = turnNode.path("role").asText("candidate");
                        turn.put("role", "assistant".equalsIgnoreCase(role) || "ai".equalsIgnoreCase(role) ? "interviewer" : "candidate");
                        
                        // Convert relative start_time to absolute timestamp_ms if possible
                        double startTime = turnNode.path("start_time").asDouble(0.0);
                        turn.put("timestamp_ms", System.currentTimeMillis()); // Fallback for now
                        turn.put("relative_seconds", startTime);
                        
                        turns.add(turn);
                    }
                }
            }
            return turns;
        } catch (Exception e) {
            log.error("Failed to fetch Tavus transcript", e);
            return List.of();
        }
    }
}
