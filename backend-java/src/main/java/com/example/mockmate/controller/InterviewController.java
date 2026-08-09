package com.example.mockmate.controller;

import com.example.mockmate.dto.response.ResumeParsedResponse;
import com.example.mockmate.service.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.example.mockmate.repository.InterviewRepository;
import com.example.mockmate.model.Interview;
import org.springframework.web.reactive.function.client.WebClient;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.example.mockmate.service.ReportGeneratorService.castMap;
import static com.example.mockmate.service.ReportGeneratorService.castMapList;
import static com.example.mockmate.service.ReportGeneratorService.castStringList;

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
    private final InterviewRepository interviewRepository;
    private final GroqWhisperService groqWhisperService;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    @PostMapping("/start-interview")
    public ResponseEntity<?> startInterview(
            @RequestBody Map<String, Object> request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.example.mockmate.model.User user) {
        try {
            String sessionId = (String) request.get("session_id");
            Map<String, Object> sessionData = sessionStoreService.getSession(sessionId);
            if (sessionData == null) {
                return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
            }
            if (user != null) {
                sessionData.put("user_id", user.getId());
                sessionStoreService.saveSession(sessionId, sessionData);
            }

            Map<String, Object> resumeDataMap = castMap(sessionData.get("resume_data"));
            String interviewType = (String) sessionData.getOrDefault("interview_type", "Technical");
            String difficulty = (String) sessionData.getOrDefault("difficulty", "Mid");
            String language = (String) sessionData.getOrDefault("language", "English");
            List<String> questions = castStringList(sessionData.get("questions"));

            ResumeParsedResponse resumeData = ResumeParsedResponse.builder()
                    .name((String) resumeDataMap.get("name"))
                    .skills(castStringList(resumeDataMap.get("skills")))
                    .jobTitles(castStringList(resumeDataMap.get("jobTitles")))
                    .companies(castStringList(resumeDataMap.get("companies")))
                    .education(castStringList(resumeDataMap.get("education")))
                    .totalExperienceYears(((Number) resumeDataMap.getOrDefault("totalExperienceYears", 0)).doubleValue())
                    .build();

            Boolean noAvatar = (Boolean) request.get("no_avatar");
            if (noAvatar == null) {
                noAvatar = (Boolean) sessionData.getOrDefault("no_avatar", false);
            } else {
                sessionData.put("no_avatar", noAvatar);
                sessionStoreService.saveSession(sessionId, sessionData);
            }

            String personaId;
            Map<String, String> conversation;

            if (Boolean.TRUE.equals(noAvatar)) {
                log.info("Focus Mode (noAvatar) -> bypassing Tavus API calls");
                personaId = "test-persona-focus";
                conversation = Map.of(
                        "conversation_id", "test-conv-focus",
                        "conversation_url", "https://tavus.daily.co/test-room"
                );
            } else {
                // 1. Create Persona
                personaId = tavusService.createPersona(resumeDataMap, questions, interviewType, difficulty, language);

                // 2. Create Conversation
                conversation = tavusService.createConversation(personaId, resumeData.getName(), sessionId);
            }

            // 3. Save Session
            sessionStoreService.updateSession(sessionId, "persona_id", personaId);
            sessionStoreService.updateSession(sessionId, "conversation_id", conversation.get("conversation_id"));
            sessionStoreService.updateSession(sessionId, "start_time", System.currentTimeMillis() / 1000.0);
            sessionStoreService.updateSession(sessionId, "turns", new ArrayList<>());
            sessionStoreService.updateSession(sessionId, "emotion_snapshots", new ArrayList<>());
            sessionStoreService.updateSession(sessionId, "status", "active");
            
            // Clear any cached data from previous iterations on the same session
            sessionData.remove("report");
            sessionData.remove("transcript");
            sessionData.remove("end_time");
            sessionData.remove("shutdown_reason");
            sessionStoreService.saveSession(sessionId, sessionData);

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
        Map<String, Object> turnData = castMap(request.get("turn_data"));

        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }

        List<Map<String, Object>> turns = castMapList(session.getOrDefault("turns", new ArrayList<>()));
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
        List<Map<String, Object>> snapshots = castMapList(request.get("snapshots"));

        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }

        List<Map<String, Object>> existingSnapshots = castMapList(session.getOrDefault("emotion_snapshots", new ArrayList<>()));
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

        List<Map<String, Object>> turns = castMapList(session.getOrDefault("turns", new ArrayList<>()));
        List<String> questions = new ArrayList<>(castStringList(session.getOrDefault("questions", new ArrayList<>())));

        // If turns is empty, this is the very beginning. Initialize with the introduction question.
        if (turns.isEmpty()) {
            questions = new ArrayList<>();
            questions.add("Please introduce yourself and share a brief overview of your background.");
            sessionStoreService.updateSession(sessionId, "questions", questions);

            Map<String, Object> initialTurn = new HashMap<>();
            initialTurn.put("role", "interviewer");
            initialTurn.put("text", questions.get(0));
            initialTurn.put("timestamp_ms", System.currentTimeMillis());
            turns.add(initialTurn);
            sessionStoreService.updateSession(sessionId, "turns", turns);
        }

        // Count candidate turns
        long candidateAnswersCount = turns.stream()
                .filter(t -> "candidate".equals(t.get("role")))
                .count();

        // Check if candidate turn was already saved (e.g., via saveAudioTurn)
        boolean lastIsCandidate = !turns.isEmpty() && "candidate".equals(turns.get(turns.size() - 1).get("role"));

        if (userText != null && !userText.trim().isEmpty()) {
            if (!lastIsCandidate) {
                Map<String, Object> userTurn = new HashMap<>();
                userTurn.put("role", "candidate");
                userTurn.put("text", userText);
                userTurn.put("question_index", (int) candidateAnswersCount);
                String currentQText = "";
                if ((int) candidateAnswersCount < questions.size()) {
                    currentQText = questions.get((int) candidateAnswersCount);
                } else if (!questions.isEmpty()) {
                    currentQText = questions.get(questions.size() - 1);
                }
                userTurn.put("question_text", currentQText);
                userTurn.put("timestamp_ms", System.currentTimeMillis());
                turns.add(userTurn);
                sessionStoreService.updateSession(sessionId, "turns", turns);
                candidateAnswersCount++;
            }
        }

        // If candidate has answered 7 questions, conclude the interview
        if (candidateAnswersCount >= 7) {
            String closing = "That concludes the interview. Excellent work! Please click End Interview to generate your performance report.";
            
            // Add the interviewer closing turn if not already present
            boolean lastIsClosing = !turns.isEmpty() && "interviewer".equals(turns.get(turns.size() - 1).get("role")) && closing.equals(turns.get(turns.size() - 1).get("text"));
            if (!lastIsClosing) {
                Map<String, Object> aiTurn = new HashMap<>();
                aiTurn.put("role", "interviewer");
                aiTurn.put("text", closing);
                aiTurn.put("timestamp_ms", System.currentTimeMillis());
                turns.add(aiTurn);
                sessionStoreService.updateSession(sessionId, "turns", turns);
            }
            return ResponseEntity.ok(Map.of("reply", closing));
        }

        // Build context for LLM prompt
        Map<String, Object> resumeDataMap = castMap(session.get("resume_data"));
        String name = "Candidate";
        String skills = "";
        String titles = "";
        String companies = "";
        String education = "";
        double exp = 0.0;
        
        if (resumeDataMap != null) {
            name = (String) resumeDataMap.getOrDefault("name", "Candidate");
            skills = String.join(", ", castStringList(resumeDataMap.get("skills")));
            titles = String.join(", ", castStringList(resumeDataMap.get("jobTitles")));
            companies = String.join(", ", castStringList(resumeDataMap.get("companies")));
            education = String.join(", ", castStringList(resumeDataMap.get("education")));
            if (resumeDataMap.get("totalExperienceYears") != null) {
                exp = ((Number) resumeDataMap.get("totalExperienceYears")).doubleValue();
            }
        }

        String interviewType = (String) session.getOrDefault("interview_type", "Technical");
        String difficulty = (String) session.getOrDefault("difficulty", "Mid");
        String language = (String) session.getOrDefault("language", "English");
        String jobDescription = (String) session.get("job_description");
        String companyId = (String) session.getOrDefault("company_id", "general");
        String styleGuide = com.example.mockmate.config.CompanyPromptConfig.getStyleGuide(companyId);

        StringBuilder history = new StringBuilder();
        for (Map<String, Object> t : turns) {
            String role = (String) t.get("role");
            String text = (String) t.get("text");
            history.append(role.toUpperCase()).append(": ").append(text).append("\n");
        }

        String systemPrompt = String.format("""
            You are InterviewBot, an expert AI interviewer conducting a professional mock interview.
            
            CANDIDATE PROFILE:
            - Name: %s
            - Skills: %s
            - Job titles held: %s
            - Companies worked at: %s
            - Education: %s
            - Total experience: %.1f years
            
            INTERVIEW CONFIGURATION:
            - Track/Type: %s
            - Difficulty Level: %s
            - Target Language: %s
            %s
            %s
            
            INSTRUCTIONS:
            - The interview begins with the candidate's introduction (Question 1, index 0).
            - For subsequent turns (Question 2 to Question 7), evaluate the candidate's last answer and dynamically generate the NEXT question.
            - Follow-up on their previous answer naturally if needed, but do not give away any scores or evaluation details.
            - Tailor the questions progressively to probe their skills, matching the difficulty and track configured.
            - Keep the questions concise, spoken-style, and professional.
            - Output ONLY the exact text of the question you want to ask next. Do not include markdown, HTML, backticks, or labels like "Interviewer:".
            
            Language Specifics:
            - If target language is 'Hindi', write the question using Devanagari script but keep technical/professional terms (e.g. "array", "database", "thread", "loop") in English.
            - If target language is 'Hinglish', write in natural Hinglish using Latin script (e.g. "Aapke last project me database optimization kaise kiya tha? Can you explain?").
            - If target language is 'English', use professional English.
            """,
            name, skills, titles, companies, education, exp,
            interviewType, difficulty, language,
            (jobDescription != null && !jobDescription.isBlank()) ? "\nJOB DESCRIPTION:\n" + jobDescription : "",
            (!styleGuide.isBlank()) ? "\nCOMPANY STYLE GUIDE:\n" + styleGuide : ""
        );

        String userPrompt = String.format("""
            Here is the conversation history so far:
            %s
            
            Generate the next question (Question %d of 7):
            """, history.toString(), candidateAnswersCount + 1);

        try {
            String apiKey = groqApiKey != null ? groqApiKey.trim().replace("\"", "").replace("'", "") : "";
            WebClient webClient = webClientBuilder.baseUrl("https://api.groq.com/openai/v1/").build();
            Map<String, Object> requestBody = Map.of(
                "model", "llama-3.1-8b-instant",
                "temperature", 0.7,
                "max_tokens", 256,
                "messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user",   "content", userPrompt)
                )
            );
            
            String rawResponse = webClient.post()
                    .uri("chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
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

            // Strip any labels if LLM included them
            if (aiReply.toUpperCase().startsWith("INTERVIEWER:")) {
                aiReply = aiReply.substring("INTERVIEWER:".length()).trim();
            }

            Map<String, Object> aiTurn = new HashMap<>();
            aiTurn.put("role", "interviewer");
            aiTurn.put("text", aiReply);
            aiTurn.put("timestamp_ms", System.currentTimeMillis());
            turns.add(aiTurn);
            sessionStoreService.updateSession(sessionId, "turns", turns);

            // Append the dynamically generated question to the planned questions list
            questions.add(aiReply);
            sessionStoreService.updateSession(sessionId, "questions", questions);

            return ResponseEntity.ok(Map.of("reply", aiReply));
        } catch (Exception e) {
            log.error("Failed mock chat", e);
            String fallbackQuestion = "Could you please elaborate on your previous response or explain a recent challenge you faced?";
            return ResponseEntity.ok(Map.of("reply", fallbackQuestion));
        }
    }

    @PostMapping("/tavus-webhook")
    public ResponseEntity<?> tavusWebhook(@RequestBody Map<String, Object> payload) {
        log.info("[Tavus Webhook] Received payload: {}", payload);
        try {
            String eventType = (String) payload.get("event_type");
            String conversationId = (String) payload.get("conversation_id");
            if (eventType == null || conversationId == null) {
                return ResponseEntity.badRequest().body(Map.of("detail", "Missing event_type or conversation_id"));
            }

            log.info("[Tavus Webhook] Event: {}, Conversation ID: {}", eventType, conversationId);

            String sessionId = sessionStoreService.findSessionIdByConversationId(conversationId);
            if (sessionId != null) {
                if ("system.replica_joined".equals(eventType)) {
                    log.info("[Tavus Webhook] Replica has successfully joined conversation: {}", conversationId);
                    sessionStoreService.updateSession(sessionId, "status", "replica_joined");
                } else if ("system.shutdown".equals(eventType)) {
                    Map<String, Object> properties = castMap(payload.get("properties"));
                    String reason = properties != null ? (String) properties.get("shutdown_reason") : "unknown";
                    log.info("[Tavus Webhook] Conversation {} shut down. Reason: {}", conversationId, reason);
                    sessionStoreService.updateSession(sessionId, "status", "completed");
                    sessionStoreService.updateSession(sessionId, "shutdown_reason", reason);
                }
            } else {
                log.warn("[Tavus Webhook] No matching sessionId found for conversationId: {}", conversationId);
            }

            return ResponseEntity.ok(Map.of("status", "processed"));
        } catch (Exception e) {
            log.error("[Tavus Webhook] Failed to process webhook", e);
            return ResponseEntity.internalServerError().body(Map.of("detail", "Error processing webhook: " + e.getMessage()));
        }
    }

    @PostMapping("/generate-report")
    public ResponseEntity<?> generateReport(@RequestBody Map<String, Object> request) {
        try {
            String sessionId = (String) request.get("session_id");
            if (sessionId == null) {
                return ResponseEntity.badRequest().body(Map.of("detail", "Missing session_id"));
            }

            synchronized (sessionId.intern()) {
                Map<String, Object> sessionData = sessionStoreService.getSession(sessionId);
                if (sessionData == null) {
                    return ResponseEntity.badRequest().body(Map.of("detail", "Session not found or expired"));
                }

                // Defensive type logging
                log.info("[Report Debug] Orchestrator: sessionData keys and types for sessionId: {}", sessionId);
                sessionData.forEach((k, v) -> {
                    if (v != null) {
                        log.info("[Report Debug] - key: {}, type: {}, preview: {}", k, v.getClass().getName(), 
                            v.toString().substring(0, Math.min(100, v.toString().length())));
                    } else {
                        log.info("[Report Debug] - key: {}, type: null", k);
                    }
                });

                if (sessionData.get("report") != null) {
                    log.info("Report already generated for session {}, returning cached version", sessionId);
                    return ResponseEntity.ok(sessionData.get("report"));
                }

                sessionData.put("end_time", System.currentTimeMillis() / 1000.0);

                String conversationId = (String) sessionData.get("conversation_id");
                if (conversationId != null && !conversationId.startsWith("test-")) {
                    try {
                        // Only use Tavus transcript as FALLBACK when no local candidate turns exist.
                        // Local turns (saved via saveTurn / saveAudioTurn) have question_index set
                        // correctly, which buildAnswerMap relies on. Overwriting them with raw
                        // Tavus turns (which lack question_index) destroys the answer mapping.
                        List<Map<String, Object>> existingTurns = castMapList(
                            sessionData.getOrDefault("turns", new ArrayList<>()));
                        long localCandidateTurnsWithIndex = existingTurns.stream()
                            .filter(t -> "candidate".equals(t.get("role"))
                                      && t.get("question_index") != null)
                            .count();

                        if (localCandidateTurnsWithIndex == 0) {
                            List<Map<String, Object>> tavusTurns = tavusService.getTranscript(conversationId);
                            if (tavusTurns != null && !tavusTurns.isEmpty()) {
                                sessionStoreService.updateSession(sessionId, "turns", tavusTurns);
                                log.info("[Report] No local candidate turns found — using {} Tavus turns",
                                    tavusTurns.size());
                            }
                        } else {
                            log.info("[Report] {} local candidate turn(s) with question_index found — "
                                + "skipping Tavus transcript override to preserve answer mapping",
                                localCandidateTurnsWithIndex);
                        }
                    } catch (Exception e) {
                        log.warn("Could not fetch Tavus transcript, falling back to local turns", e);
                    }
                }

                Map<String, Object> transcriptData = transcriptProcessorService.generateTranscriptFromVideo(sessionId);
                transcriptProcessorService.updateSessionWithTranscript(sessionId, transcriptData);

                // Re-fetch to ensure the mutated transcript and filler analysis are fully synchronized
                sessionData = sessionStoreService.getSession(sessionId);

                Map<String, Object> report = reportGeneratorService.generateEnhancedReport(sessionId, sessionData);
                sessionStoreService.updateSession(sessionId, "report", report);

                // Save to PostgreSQL if user_id is present
                String userId = (String) sessionData.get("user_id");
                if (userId != null) {
                    try {
                        // Read directly from the assembled report (no nested "metrics" sub-map).
                        Integer overallScore = report.get("overallScore") != null
                                ? ((Number) report.get("overallScore")).intValue()
                                : null;
                        // fillerWords is a Map<String,Integer> of filler word counts
                        Map<String, Object> fillerWordsMap = castMap(report.get("fillerWords"));
                        Integer fillerCount = fillerWordsMap != null
                                ? fillerWordsMap.values().stream()
                                    .mapToInt(v -> v instanceof Number ? ((Number) v).intValue() : 0)
                                    .sum()
                                : null;
                        Integer wpm = report.get("wpm") != null
                                ? ((Number) report.get("wpm")).intValue()
                                : null;

                        Map<String, Object> resumeData = castMap(sessionData.get("resume_data"));
                        String role = (String) sessionData.get("interview_type");
                        String company = null;
                        if (resumeData != null && resumeData.get("jobTitles") != null) {
                            List<String> titles = castStringList(resumeData.get("jobTitles"));
                            if (!titles.isEmpty()) role = titles.get(0);
                        }

                        // Determine target company name
                        String targetCompany = (String) sessionData.get("company_display");
                        if (targetCompany == null || targetCompany.equalsIgnoreCase("General")) {
                            if (resumeData != null && resumeData.get("companies") != null) {
                                List<String> companies = castStringList(resumeData.get("companies"));
                                if (!companies.isEmpty()) company = companies.get(0);
                            }
                        } else {
                            company = targetCompany;
                        }

                        String companyIdStr = (String) sessionData.getOrDefault("company_id", "general");

                        Interview interview = interviewRepository.findById(sessionId).orElse(null);
                        if (interview == null) {
                            interview = Interview.builder()
                                    .id(sessionId)
                                    .userId(userId)
                                    .overallScore(overallScore)
                                    .role(role)
                                    .company(company)
                                    .interviewType((String) sessionData.getOrDefault("interview_type", "general"))
                                    .companyId(companyIdStr)
                                    .fillerWordCount(fillerCount)
                                    .averageWpm(wpm)
                                    .build();
                        } else {
                            interview.setOverallScore(overallScore);
                            interview.setRole(role);
                            interview.setCompany(company);
                            interview.setInterviewType((String) sessionData.getOrDefault("interview_type", "general"));
                            interview.setCompanyId(companyIdStr);
                            interview.setFillerWordCount(fillerCount);
                            interview.setAverageWpm(wpm);
                        }

                        interviewRepository.save(interview);
                        log.info("Saved interview history for session {} and user {}", sessionId, userId);
                    } catch (Exception e) {
                        log.error("Failed to save interview history to database", e);
                    }
                }

                return ResponseEntity.ok(report);
            }
        } catch (Exception e) {
            log.error("Failed to generate report", e);
            return ResponseEntity.internalServerError().body(Map.of("detail", "Failed to generate report: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/save-audio-turn", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> saveAudioTurn(
            @RequestParam("session_id") String sessionId,
            @RequestParam("question_index") int questionIndex,
            @RequestParam("file") MultipartFile file) {
        try {
            Map<String, Object> session = sessionStoreService.getSession(sessionId);
            if (session == null) {
                return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
            }

            // Create recordings directory if not exists
            Path recordingsDir = Paths.get("data", "recordings");
            if (!Files.exists(recordingsDir)) {
                Files.createDirectories(recordingsDir);
            }

            // Save the uploaded audio file
            String originalFilename = file.getOriginalFilename();
            String extension = "webm";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf(".") + 1);
            }
            // originalFilename is caller-controlled; strip anything but alphanumerics
            // so it can't smuggle "/" or ".." into the resolved path below.
            extension = extension.replaceAll("[^a-zA-Z0-9]", "");
            if (extension.isEmpty()) {
                extension = "webm";
            }
            String filename = sessionId + "_" + questionIndex + "." + extension;
            Path filePath = recordingsDir.resolve(filename).normalize();
            if (!filePath.startsWith(recordingsDir.toAbsolutePath().normalize())) {
                return ResponseEntity.badRequest().body(Map.of("detail", "Invalid file"));
            }
            Files.write(filePath, file.getBytes());
            log.info("Saved candidate answer audio to: {}", filePath.toAbsolutePath());

            // Transcribe using GroqWhisperService
            String transcript = groqWhisperService.transcribe(file.getBytes(), filename);
            if (transcript == null || transcript.isEmpty()) {
                transcript = "No answer recorded.";
            }

            // Formulate audio URL for playback
            String audioUrl = "/api/recordings/" + filename;

            // Save turn to the session list (prevent duplicate turns for the same question index)
            List<Map<String, Object>> turns = castMapList(session.getOrDefault("turns", new ArrayList<>()));
            List<String> questions = castStringList(session.get("questions"));
            String questionText = "";
            if (questions != null && questionIndex >= 0 && questionIndex < questions.size()) {
                questionText = questions.get(questionIndex);
            }

            // Look for existing candidate turn for this question index to update
            Map<String, Object> existingCandidateTurn = null;
            for (Map<String, Object> t : turns) {
                if ("candidate".equals(t.get("role"))) {
                    Number qIdxNum = (Number) t.get("question_index");
                    if (qIdxNum != null && qIdxNum.intValue() == questionIndex) {
                        existingCandidateTurn = t;
                        break;
                    }
                }
            }

            if (existingCandidateTurn != null) {
                existingCandidateTurn.put("text", transcript);
                existingCandidateTurn.put("audio_url", audioUrl);
                existingCandidateTurn.put("timestamp_ms", System.currentTimeMillis());
                log.info("Updated existing candidate turn for question index {} with audio transcript", questionIndex);
            } else {
                Map<String, Object> turnData = new HashMap<>();
                turnData.put("role", "candidate");
                turnData.put("question_index", questionIndex);
                turnData.put("question_text", questionText);
                turnData.put("text", transcript);
                turnData.put("audio_url", audioUrl);
                turnData.put("timestamp_ms", System.currentTimeMillis());
                turnData.put("duration_ms", 30000); // estimate or calculate if possible, let's keep a default
                turns.add(turnData);
                log.info("Created new candidate turn for question index {} with audio transcript", questionIndex);
            }
            sessionStoreService.updateSession(sessionId, "turns", turns);

            // Trigger real-time transcript sync (so frontend sees it under CandidatePanel or InterviewRoom)
            String fullTranscript = (String) session.getOrDefault("transcript", "");
            fullTranscript = (fullTranscript + " " + transcript).trim();
            sessionStoreService.updateSession(sessionId, "transcript", fullTranscript);

            return ResponseEntity.ok(Map.of(
                "ok", true,
                "transcript", transcript,
                "audio_url", audioUrl,
                "turn_count", turns.size()
            ));
        } catch (Exception e) {
            log.error("Failed to save audio turn and transcribe", e);
            return ResponseEntity.internalServerError().body(Map.of("detail", "Error processing audio: " + e.getMessage()));
        }
    }

    @GetMapping("/recordings/{filename:.+}")
    public ResponseEntity<org.springframework.core.io.Resource> getRecording(@PathVariable String filename) {
        try {
            // This endpoint is unauthenticated (permitAll), so filename must never be
            // allowed to escape the recordings directory via "../" path traversal.
            Path recordingsDir = Paths.get("data", "recordings").toAbsolutePath().normalize();
            Path filePath = recordingsDir.resolve(filename).normalize();
            if (!filePath.startsWith(recordingsDir)) {
                return ResponseEntity.notFound().build();
            }
            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }

            org.springframework.core.io.Resource resource = new org.springframework.core.io.UrlResource(filePath.toUri());
            if (resource.exists() || resource.isReadable()) {
                String contentType = "audio/webm";
                if (filename.endsWith(".mp3")) {
                    contentType = "audio/mpeg";
                } else if (filename.endsWith(".wav")) {
                    contentType = "audio/wav";
                }

                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            log.error("Failed to read audio file: {}", filename, e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
