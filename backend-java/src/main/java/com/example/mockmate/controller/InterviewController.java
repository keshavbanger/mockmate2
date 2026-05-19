package com.example.mockmate.controller;

import com.example.mockmate.dto.response.ResumeParsedResponse;
import com.example.mockmate.service.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class InterviewController {

    private final SessionStoreService sessionStoreService;
    private final TavusService tavusService;
    private final TranscriptProcessorService transcriptProcessorService;
    private final ReportGeneratorService reportGeneratorService;
    private final ObjectMapper objectMapper;
    private final WebClient.Builder webClientBuilder;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    @PostMapping("/start-interview")
    public ResponseEntity<?> startInterview(@RequestBody Map<String, Object> request) {
        try {
            String sessionId = (String) request.get("session_id");
            Map<String, Object> sessionData = sessionStoreService.getSession(sessionId);
            if (sessionData == null) {
                return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
            }

            Map<String, Object> resumeDataMap = (Map<String, Object>) sessionData.get("resume_data");
            String interviewType = (String) sessionData.getOrDefault("interview_type", "Technical");
            String difficulty = (String) sessionData.getOrDefault("difficulty", "Mid");
            String language = (String) sessionData.getOrDefault("language", "English");
            List<String> questions = (List<String>) sessionData.get("questions");

            ResumeParsedResponse resumeData = ResumeParsedResponse.builder()
                    .name((String) resumeDataMap.get("name"))
                    .skills((List<String>) resumeDataMap.get("skills"))
                    .jobTitles((List<String>) resumeDataMap.get("jobTitles"))
                    .companies((List<String>) resumeDataMap.get("companies"))
                    .education((List<String>) resumeDataMap.get("education"))
                    .totalExperienceYears(((Number) resumeDataMap.getOrDefault("totalExperienceYears", 0)).doubleValue())
                    .build();

            // 1. Create Persona
            String personaId = tavusService.createPersona(resumeDataMap, questions, interviewType, difficulty, language);

            // 2. Create Conversation
            Map<String, String> conversation = tavusService.createConversation(personaId, resumeData.getName(), sessionId);

            // 3. Save Session
            sessionStoreService.updateSession(sessionId, "persona_id", personaId);
            sessionStoreService.updateSession(sessionId, "conversation_id", conversation.get("conversation_id"));
            sessionStoreService.updateSession(sessionId, "start_time", System.currentTimeMillis() / 1000.0);
            sessionStoreService.updateSession(sessionId, "turns", new ArrayList<>());
            sessionStoreService.updateSession(sessionId, "emotion_snapshots", new ArrayList<>());
            sessionStoreService.updateSession(sessionId, "status", "active");

            return ResponseEntity.ok(Map.of(
                    "session_id", sessionId,
                    "conversation_id", conversation.get("conversation_id"),
                    "conversation_url", conversation.get("conversation_url"),
                    "persona_id", personaId,
                    "status", "active"
            ));
        } catch (Exception e) {
            log.error("Failed to start interview", e);
            return ResponseEntity.internalServerError().body(Map.of("detail", "Failed to start interview: " + e.getMessage()));
        }
    }

    @PostMapping("/save-turn")
    public ResponseEntity<?> saveTurn(@RequestBody Map<String, Object> request) {
        String sessionId = (String) request.get("session_id");
        Map<String, Object> turnData = (Map<String, Object>) request.get("turn_data");

        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }

        List<Map<String, Object>> turns = (List<Map<String, Object>>) session.getOrDefault("turns", new ArrayList<>());
        turns.add(turnData);
        sessionStoreService.updateSession(sessionId, "turns", turns);

        return ResponseEntity.ok(Map.of("ok", true, "turn_count", turns.size()));
    }

    @PostMapping("/end-interview")
    public ResponseEntity<?> endInterview(@RequestBody Map<String, Object> request) {
        String sessionId = (String) request.get("session_id");
        String conversationId = (String) request.get("conversation_id");

        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }

        try {
            tavusService.endConversation(conversationId);
        } catch (Exception e) {
            log.warn("Could not end Tavus conversation", e);
        }

        sessionStoreService.updateSession(sessionId, "status", "completed");
        sessionStoreService.updateSession(sessionId, "end_time", System.currentTimeMillis() / 1000.0);

        return ResponseEntity.ok(Map.of("session_id", sessionId, "status", "completed"));
    }

    @PostMapping("/save-emotion-snapshots")
    public ResponseEntity<?> saveEmotionSnapshots(@RequestBody Map<String, Object> request) {
        String sessionId = (String) request.get("session_id");
        List<Map<String, Object>> snapshots = (List<Map<String, Object>>) request.get("snapshots");

        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }

        List<Map<String, Object>> existingSnapshots = (List<Map<String, Object>>) session.getOrDefault("emotion_snapshots", new ArrayList<>());
        existingSnapshots.addAll(snapshots);
        sessionStoreService.updateSession(sessionId, "emotion_snapshots", existingSnapshots);

        return ResponseEntity.ok(Map.of("ok", true, "count", existingSnapshots.size()));
    }

    @PostMapping("/mock-chat")
    public ResponseEntity<?> mockChat(@RequestBody Map<String, Object> request) {
        String sessionId = (String) request.get("session_id");
        String userText = (String) request.get("user_text");

        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }

        List<Map<String, Object>> turns = (List<Map<String, Object>>) session.getOrDefault("turns", new ArrayList<>());
        
        if (userText != null && !userText.trim().isEmpty()) {
            Map<String, Object> userTurn = new HashMap<>();
            userTurn.put("role", "candidate");
            userTurn.put("text", userText);
            userTurn.put("timestamp_ms", System.currentTimeMillis());
            turns.add(userTurn);
            sessionStoreService.updateSession(sessionId, "turns", turns);
        }

        StringBuilder history = new StringBuilder();
        for (Map<String, Object> t : turns) {
            history.append(((String) t.get("role")).toUpperCase()).append(": ").append(t.get("text")).append("\n");
        }

        List<String> questions = (List<String>) session.getOrDefault("questions", new ArrayList<>());
        StringBuilder numberedQuestions = new StringBuilder();
        for (int i = 0; i < questions.size(); i++) {
            numberedQuestions.append(i + 1).append(". ").append(questions.get(i)).append("\n");
        }

        String prompt = String.format("""
            You are InterviewBot, an AI interviewer.
            Here are the planned questions for the interview:
            %s
            
            Here is the conversation so far:
            %s
            
            Instructions:
            Evaluate the candidate's last answer. 
            If the candidate asked to repeat the question, repeat it.
            If the answer is too short or lacks detail, ask a follow-up question.
            If the answer is satisfactory, acknowledge it briefly and ask the NEXT question from the planned list.
            If all questions are asked and answered, say "That concludes our interview. Thank you!".
            Do not give away the score. Keep your response concise, spoken-style, and professional.
            
            Respond only with the exact text you want to speak next. Do not include any other formatting.
            """, numberedQuestions.toString().replace("%", "%%"), history.toString().replace("%", "%%"));

        try {
            WebClient webClient = webClientBuilder.baseUrl("https://api.groq.com/openai/v1/").build();
            Map<String, Object> requestBody = Map.of(
                "model", "llama-3.1-8b-instant",
                "temperature", 0.5,
                "max_tokens", 512,
                "messages", List.of(
                    Map.of("role", "system", "content", "You are InterviewBot, an AI interviewer. Respond only with the exact text you want to speak next."),
                    Map.of("role", "user",   "content", prompt)
                )
            );
            
            String rawResponse = webClient.post()
                    .uri("chat/completions")
                    .header("Authorization", "Bearer " + groqApiKey.trim())
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
                    
            var rootNode = objectMapper.readTree(rawResponse);
            if (!rootNode.has("choices") || rootNode.path("choices").isEmpty()) {
                log.error("Groq response missing choices: {}", rawResponse);
                throw new RuntimeException("Groq response missing choices");
            }
            
            var choice = rootNode.path("choices").get(0);
            String aiReply = choice.path("message").path("content").asText().trim();

            Map<String, Object> aiTurn = new HashMap<>();
            aiTurn.put("role", "interviewer");
            aiTurn.put("text", aiReply);
            aiTurn.put("timestamp_ms", System.currentTimeMillis());
            turns.add(aiTurn);
            sessionStoreService.updateSession(sessionId, "turns", turns);

            return ResponseEntity.ok(Map.of("reply", aiReply));
        } catch (Exception e) {
            log.error("Failed mock chat", e);
            return ResponseEntity.ok(Map.of("reply", "I'm having trouble connecting. Could you please repeat that?"));
        }
    }

    @PostMapping("/generate-report")
    public ResponseEntity<?> generateReport(@RequestBody Map<String, Object> request) {
        try {
            String sessionId = (String) request.get("session_id");
            Map<String, Object> sessionData = sessionStoreService.getSession(sessionId);
            if (sessionData == null) {
                return ResponseEntity.badRequest().body(Map.of("detail", "Session not found or expired"));
            }

            sessionData.put("end_time", System.currentTimeMillis() / 1000.0);

            // Fetch real transcript from Tavus bypassed:
            // User requested to completely bypass Tavus API dependency for transcripts to use our own local Speech-to-Text pipeline.
            /*
            String conversationId = (String) sessionData.get("conversation_id");
            if (conversationId != null && !conversationId.startsWith("test-")) {
                try {
                    List<Map<String, Object>> tavusTurns = tavusService.getTranscript(conversationId);
                    if (tavusTurns != null && !tavusTurns.isEmpty()) {
                        sessionStoreService.updateSession(sessionId, "turns", tavusTurns);
                    }
                } catch (Exception e) {
                    log.warn("Could not fetch Tavus transcript, falling back to local turns", e);
                }
            }
            */

            Map<String, Object> transcriptData = transcriptProcessorService.generateTranscriptFromVideo(sessionId);
            transcriptProcessorService.updateSessionWithTranscript(sessionId, transcriptData);

            // Re-fetch to ensure the mutated transcript and filler analysis are fully synchronized
            sessionData = sessionStoreService.getSession(sessionId);

            Map<String, Object> report = reportGeneratorService.generateEnhancedReport(sessionId, sessionData);
            sessionStoreService.updateSession(sessionId, "report", report);
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            log.error("Failed to generate report", e);
            return ResponseEntity.internalServerError().body(Map.of("detail", "Failed to generate report: " + e.getMessage()));
        }
    }
}
