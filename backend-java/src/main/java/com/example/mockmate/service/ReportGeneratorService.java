package com.example.mockmate.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ReportGeneratorService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final FillerDetectorService fillerDetectorService;

    @Value("${gemini.api-key}")
    private String geminiApiKey;

    @jakarta.annotation.PostConstruct
    public void init() {
        if (geminiApiKey != null) {
            geminiApiKey = geminiApiKey.trim().replace("\"", "").replace("'", "");
        }
    }

    // ── System Prompt ──────────────────────────────────────────────────────────
    private static final String SYSTEM_PROMPT = """
            You are an expert interview assessment and report-generation assistant for a professional mock interview platform.

            Your task is to analyze the candidate's interview session and return a polished, enterprise-style assessment report.

            Core Rules:
            - Return ONLY valid JSON. No markdown, no code fences, no explanations outside the JSON.
            - Follow the exact output schema provided. Do not add or remove top-level keys.
            - Do not invent information not supported by the transcript or metrics.
            - Be constructive, credible, and recruiter-friendly in tone.
            - Keep wording concise, specific, and actionable.
            - Preserve factual accuracy. Base scores on evidence from the transcript.
            - Do not repeat the same feedback across multiple sections.
            - If an answer is missing or very short, clearly reflect that — distinguish between no response, weak structure, and low technical depth.
            - Keep scores consistent with the written evaluation.
            - Scores are 0–100 unless specified otherwise.

            Report Sections to Generate:
            1. Overall Assessment — candidate name, role, track, overall score, executive summary.
            2. Score Breakdown — communication, technical, grammar, confidence, structure, roleFit, vocabulary, eyeContact (0-10 each).
            3. Answer Completeness — per-answer completeness percentage and an overall completeness score.
            4. Question-by-Question Analysis — for each answer: clarity, relevance, structure, confidence, specificity rubric (0-100 each), STAR coverage, what was missing, how to improve, ideal answer.
            5. Time and Pace Analysis — wpm, pacing label, time distribution insights.
            6. Pause and Hesitation Insights — filler word map, pause frequency, hesitation patterns.
            7. Role Fit Assessment — how well the candidate matches the target role, evidence from transcript.
            8. Strengths — what the candidate did well and why it helps in interviews.
            9. Growth Areas — specific, practical areas to improve.
            10. Recruiter Readiness Summary — would a recruiter shortlist this candidate? What must improve before the real interview?
            11. Coaching Roadmap — day-by-day 7-day plan with specific tasks.
            12. Grammar and Vocabulary Analysis — score, error count, corrections, vocabulary richness, domain terms used and missing.
            """;

    // ── User Prompt Template ───────────────────────────────────────────────────
    private static final String USER_PROMPT_TEMPLATE = """
            Analyze this mock interview session and return a complete enterprise-grade assessment report.

            INPUT:
            %s

            OUTPUT SCHEMA (return this exact JSON structure, all fields required):
            {
              "candidateName": "string",
              "role": "string",
              "track": "string",
              "overallScore": number,
              "executiveSummary": "string",
              "finalVerdict": "string",

              "scores": {
                "communication": number,
                "technical": number,
                "grammar": number,
                "confidence": number,
                "roleFit": number,
                "structure": number,
                "vocabulary": number,
                "eyeContact": number
              },

              "strengths": ["string"],
              "areasToImprove": ["string"],
              "topSuggestions": ["string"],

              "answerCompleteness": {
                "overallCompletenessScore": number,
                "perAnswer": [
                  { "questionIndex": number, "completenessPercent": number, "note": "string" }
                ]
              },

              "answerAnalysis": [
                {
                  "question": "string",
                  "transcript": "string",
                  "answerSummary": "string",
                  "rubric": {
                    "clarity": number,
                    "relevance": number,
                    "structure": number,
                    "confidence": number,
                    "specificity": number
                  },
                  "starScore": number,
                  "star": { "situation": boolean, "task": boolean, "action": boolean, "result": boolean },
                  "whatWasMissing": "string",
                  "howToImprove": "string",
                  "idealAnswer": "string",
                  "grammarIssues": ["string"],
                  "improvements": ["string"],
                  "score": number,
                  "status": "string"
                }
              ],

              "paceAnalysis": {
                "wpm": number,
                "pacingLabel": "string",
                "insight": "string",
                "timeDistribution": [
                  { "questionIndex": number, "label": "string", "durationNote": "string" }
                ]
              },

              "hesitationInsights": {
                "totalFillerWords": number,
                "fillerRate": number,
                "pauseCount": number,
                "topFillers": ["string"],
                "hesitationPattern": "string",
                "impactOnDelivery": "string"
              },

              "roleFitAssessment": {
                "roleFitScore": number,
                "summary": "string",
                "evidence": ["string"],
                "gaps": ["string"]
              },

              "recruiterReadiness": {
                "readinessScore": number,
                "verdict": "string",
                "mustImproveBefore": ["string"],
                "readyStrengths": ["string"]
              },

              "coachingPlan": {
                "day1": ["string"],
                "day2": ["string"],
                "day3": ["string"],
                "day4": ["string"],
                "day5": ["string"],
                "day6": ["string"],
                "day7": ["string"]
              },

              "grammarAnalysis": {
                "score": number,
                "errors": number,
                "tenseConsistency": number,
                "complexity": number,
                "corrections": ["string"]
              },

              "vocabulary": {
                "richnessScore": number,
                "domainTermsUsed": ["string"],
                "missingDomainTerms": ["string"]
              },

              "facialAnalysis": {
                "dominantEmotion": "string",
                "eyeContactPercent": number,
                "emotionDistribution": {}
              }
            }

            Return a JSON object only. No markdown. No extra text.
            """;

    public ReportGeneratorService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper,
                                   FillerDetectorService fillerDetectorService) {
        this.webClient = webClientBuilder.baseUrl("https://generativelanguage.googleapis.com").build();
        this.objectMapper = objectMapper;
        this.fillerDetectorService = fillerDetectorService;
    }

    // ── Public Entry Point ─────────────────────────────────────────────────────
    public Map<String, Object> generateEnhancedReport(String sessionId, Map<String, Object> sessionData) {
        Map<String, Object> resumeData     = castMap(sessionData.getOrDefault("resume_data", new HashMap<>()));
        String interviewType               = (String) sessionData.getOrDefault("interview_type", "Mixed");
        String difficulty                  = (String) sessionData.getOrDefault("difficulty", "Mid");
        List<String> questions             = castStringList(sessionData.getOrDefault("questions", new ArrayList<>()));
        List<Map<String, Object>> turns    = castMapList(sessionData.getOrDefault("turns", new ArrayList<>()));
        List<Map<String, Object>> emotions = castMapList(sessionData.getOrDefault("emotion_snapshots", new ArrayList<>()));

        double startTime   = toDouble(sessionData.get("start_time"), 0.0);
        double endTime     = toDouble(sessionData.get("end_time"),   startTime);
        double durationSec = Math.max(0.0, endTime - startTime);

        String candidateName = (String) resumeData.getOrDefault("name", "Candidate");
        String role          = (String) resumeData.getOrDefault("role", "Professional");

        // ── Local Metrics ──
        String fullTranscript     = buildFullTranscript(turns);
        int totalWords            = fullTranscript.isBlank() ? 0 : fullTranscript.split("\\s+").length;
        int uniqueWords           = fullTranscript.isBlank() ? 0 :
                (int) Arrays.stream(fullTranscript.toLowerCase().split("\\s+")).distinct().count();
        Map<String, Integer> fillerCounts = fillerDetectorService.countFillerWords(fullTranscript);
        Map<String, Object>  fillerStats  = fillerDetectorService.summarizeFillerStats(fillerCounts, fullTranscript);
        double wpm            = fillerDetectorService.getWordsPerMinute(fullTranscript, durationSec);
        int pauseCount        = fillerDetectorService.getPauseCount(fullTranscript);
        int fillerWordCount   = fillerCounts.values().stream().mapToInt(Integer::intValue).sum();
        double fillerRate     = toDouble(fillerStats.get("filler_rate_percent"), 0.0);

        List<String> keywordMatches = extractDomainTerms(fullTranscript, interviewType);
        List<String> allKeywords    = getAllKeywordsForTrack(interviewType);
        List<String> keywordMisses  = allKeywords.stream()
                .filter(k -> !keywordMatches.contains(k)).collect(Collectors.toList());

        Map<Integer, String> answerMap  = buildAnswerMap(turns, questions);
        List<Map<String, Object>> qaPairs = buildQAPairs(questions, answerMap);
        Map<String, Object> emotionSignals = buildEmotionSignals(emotions);

        // ── Build Input Payload ──
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("candidateName",          candidateName);
        input.put("role",                   role);
        input.put("track",                  interviewType);
        input.put("experienceLevel",        difficulty);
        input.put("sessionDurationSeconds", durationSec);
        input.put("overallWpm",             wpm);
        input.put("fillerWordCount",        fillerWordCount);
        input.put("fillerWordRate",         fillerRate);
        input.put("pauseCount",             pauseCount);
        input.put("uniqueWordCount",        uniqueWords);
        input.put("totalWordCount",         totalWords);
        input.put("keywordMatches",         keywordMatches);
        input.put("keywordMisses",          keywordMisses);
        input.put("emotionSignals",         emotionSignals);
        input.put("fullTranscript",         fullTranscript);
        input.put("questionAnswerPairs",    qaPairs);

        String inputJson;
        try {
            inputJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(input);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize input payload", e);
        }

        String userPrompt = String.format(USER_PROMPT_TEMPLATE, inputJson);

        log.info("[Report] Session={} | wpm={:.1f} fillers={} totalWords={}", sessionId, wpm, fillerWordCount, totalWords);

        Map<String, Object> geminiReport = callGeminiApi(SYSTEM_PROMPT, userPrompt);
        log.info("[Report] Gemini responded. Keys: {}", geminiReport.keySet());

        return assembleReport(sessionId, sessionData, geminiReport,
                fillerStats, fillerCounts, wpm, pauseCount, durationSec,
                questions, turns, answerMap);
    }

    // ── Gemini API Call ────────────────────────────────────────────────────────
    private Map<String, Object> callGeminiApi(String systemPrompt, String userPrompt) {
        Map<String, Object> systemInstruction = Map.of(
                "parts", List.of(Map.of("text", systemPrompt)));
        Map<String, Object> userContent = Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", userPrompt)));
        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("system_instruction", systemInstruction);
        requestBody.put("contents", List.of(userContent));

        try {
            String url = "/v1beta/models/gemini-2.0-flash:generateContent?key=" + geminiApiKey;
            String rawResponse = webClient.post()
                    .uri(url)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            var rootNode = objectMapper.readTree(rawResponse);
            if (!rootNode.has("candidates") || rootNode.path("candidates").isEmpty()) {
                log.error("Gemini response missing candidates: {}", rawResponse);
                throw new RuntimeException("Gemini response missing candidates");
            }
            String rawText = rootNode.path("candidates").get(0)
                    .path("content").path("parts").get(0).path("text").asText();

            return objectMapper.readValue(stripMarkdownFences(rawText),
                    new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("Gemini API error during report generation", e);
            throw new RuntimeException("Gemini report generation failed: " + e.getMessage(), e);
        }
    }

    // ── Report Assembly ────────────────────────────────────────────────────────
    private Map<String, Object> assembleReport(
            String sessionId,
            Map<String, Object> sessionData,
            Map<String, Object> gemini,
            Map<String, Object> fillerStats,
            Map<String, Integer> fillerCounts,
            double wpm, int pauseCount, double durationSec,
            List<String> questions,
            List<Map<String, Object>> turns,
            Map<Integer, String> answerMap) {

        Map<String, Object> resumeData = castMap(sessionData.getOrDefault("resume_data", new HashMap<>()));
        String interviewType = (String) sessionData.getOrDefault("interview_type", "Mixed");

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("sessionId", sessionId);

        // ── 1. Candidate Info ──
        Map<String, Object> candidate = new LinkedHashMap<>();
        candidate.put("name",          resumeData.getOrDefault("name", "Candidate"));
        candidate.put("role",          resumeData.getOrDefault("role", "Professional"));
        candidate.put("date",          LocalDate.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy")));
        candidate.put("duration",      String.format("%.0f min", durationSec / 60.0));
        candidate.put("interviewType", interviewType);
        report.put("candidate", candidate);

        // ── 2. Scores & Summary ──
        report.put("overallScore",    gemini.getOrDefault("overallScore", 50));
        report.put("scores",          gemini.getOrDefault("scores", defaultScores()));
        report.put("executiveSummary",gemini.getOrDefault("executiveSummary", ""));
        report.put("finalVerdict",    gemini.getOrDefault("finalVerdict", ""));
        report.put("strengths",       gemini.getOrDefault("strengths", List.of()));
        report.put("areasToImprove",  gemini.getOrDefault("areasToImprove", List.of()));
        report.put("topSuggestions",  gemini.getOrDefault("topSuggestions", List.of()));

        // ── 3. Answer Cards (with real transcripts injected) ──
        List<Map<String, Object>> answerAnalysis = castMapList(gemini.getOrDefault("answerAnalysis", new ArrayList<>()));
        for (int i = 0; i < answerAnalysis.size(); i++) {
            Map<String, Object> item = answerAnalysis.get(i);
            String realText = answerMap.get(i);
            // Always inject the real captured transcript
            item.put("transcript", (realText != null && !realText.isBlank()) ? realText.trim() : "No speech detected.");
            item.putIfAbsent("id",     i + 1);
            item.putIfAbsent("status", "normal");
            item.putIfAbsent("score",  item.getOrDefault("rubric", Map.of()));
            // Ensure score is a flat int for ScoreRingsRow compatibility
            Map<String, Object> rubric = castMap(item.getOrDefault("rubric", new HashMap<>()));
            if (!rubric.isEmpty()) {
                double avg = rubric.values().stream()
                        .mapToDouble(v -> toDouble(v, 50.0)).average().orElse(50.0);
                item.put("score", (int) Math.round(avg));
            }
        }
        report.put("answers", answerAnalysis);

        // ── 4. Answer Completeness ──
        report.put("answerCompleteness", gemini.getOrDefault("answerCompleteness", Map.of(
                "overallCompletenessScore", 0, "perAnswer", List.of())));

        // ── 5. Pace Analysis ──
        report.put("paceAnalysis", gemini.getOrDefault("paceAnalysis", Map.of(
                "wpm", wpm, "pacingLabel", "Unknown", "insight", "", "timeDistribution", List.of())));

        // ── 6. Hesitation Insights ──
        report.put("hesitationInsights", gemini.getOrDefault("hesitationInsights", Map.of(
                "totalFillerWords", 0, "fillerRate", 0.0, "pauseCount", pauseCount,
                "topFillers", List.of(), "hesitationPattern", "", "impactOnDelivery", "")));

        // ── 7. Role Fit ──
        report.put("roleFitAssessment", gemini.getOrDefault("roleFitAssessment", Map.of(
                "roleFitScore", 50, "summary", "", "evidence", List.of(), "gaps", List.of())));

        // ── 8. Recruiter Readiness ──
        report.put("recruiterReadiness", gemini.getOrDefault("recruiterReadiness", Map.of(
                "readinessScore", 50, "verdict", "", "mustImproveBefore", List.of(), "readyStrengths", List.of())));

        // ── 9. Coaching Plan → weekPlan format for CoachingPlan component ──
        Map<String, Object> rawCoaching = castMap(gemini.getOrDefault("coachingPlan", new HashMap<>()));
        List<Map<String, Object>> weekPlan = new ArrayList<>();
        for (int d = 1; d <= 7; d++) {
            Object tasks = rawCoaching.get("day" + d);
            String taskStr = tasks instanceof List
                    ? String.join("; ", (List<String>) tasks)
                    : (tasks != null ? tasks.toString() : "");
            weekPlan.add(Map.of("day", "Day " + d, "task", taskStr));
        }
        report.put("coaching", Map.of(
                "cefrLevel",  "B2",
                "strengths",  gemini.getOrDefault("strengths", List.of()),
                "weaknesses", gemini.getOrDefault("areasToImprove", List.of()),
                "weekPlan",   weekPlan
        ));

        // ── 10. Grammar & Vocabulary ──
        report.put("grammarAnalysis", gemini.getOrDefault("grammarAnalysis", Map.of(
                "score", 50, "errors", 0, "tenseConsistency", 80, "complexity", 50, "corrections", List.of())));
        report.put("vocabulary", gemini.getOrDefault("vocabulary", Map.of(
                "richnessScore", 50, "domainTermsUsed", List.of(), "missingDomainTerms", List.of())));

        // ── 11. Facial Analysis ──
        if (gemini.containsKey("facialAnalysis")) {
            report.put("facialAnalysis", gemini.get("facialAnalysis"));
        }

        // ── 12. Raw Metrics ──
        report.put("fillerWords", fillerCounts);
        report.put("wpm",        wpm);
        report.put("pauseCount", pauseCount);

        // ── 13. Video Timeline Moments ──
        report.put("videoMoments", buildVideoMoments(
                castMapList(sessionData.getOrDefault("turns", new ArrayList<>())),
                toDouble(sessionData.get("start_time"), 0.0)));

        return report;
    }

    // ── Private Helpers ────────────────────────────────────────────────────────

    private String buildFullTranscript(List<Map<String, Object>> turns) {
        return turns.stream()
                .filter(t -> "candidate".equals(t.get("role")))
                .map(t -> (String) t.getOrDefault("text", ""))
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining(" "));
    }

    private Map<Integer, String> buildAnswerMap(List<Map<String, Object>> turns, List<String> questions) {
        Map<Integer, String> map = new HashMap<>();
        int qIdx = 0;
        for (Map<String, Object> turn : turns) {
            String role = ((String) turn.getOrDefault("role", "")).toLowerCase();
            String text = ((String) turn.getOrDefault("text", "")).trim();
            if ("interviewer".equals(role) && qIdx < questions.size()) {
                qIdx++;
            } else if ("candidate".equals(role) && !text.isBlank()) {
                Number qIdxNum = (Number) turn.get("question_index");
                int idx = qIdxNum != null ? qIdxNum.intValue() : Math.max(0, qIdx - 1);
                map.merge(idx, text, (a, b) -> a + " " + b);
            }
        }
        return map;
    }

    private List<Map<String, Object>> buildQAPairs(List<String> questions, Map<Integer, String> answerMap) {
        List<Map<String, Object>> pairs = new ArrayList<>();
        for (int i = 0; i < questions.size(); i++) {
            String ans = answerMap.getOrDefault(i, "No answer recorded.");
            pairs.add(Map.of(
                    "questionIndex", i,
                    "question",      questions.get(i),
                    "answer",        ans.length() > 600 ? ans.substring(0, 600) + "..." : ans
            ));
        }
        return pairs;
    }

    private Map<String, Object> buildEmotionSignals(List<Map<String, Object>> snapshots) {
        if (snapshots.isEmpty()) return Map.of("available", false);
        Map<String, Double> totals = new HashMap<>();
        for (Map<String, Object> snap : snapshots) {
            castMap(snap.getOrDefault("emotions", new HashMap<>()))
                    .forEach((k, v) -> totals.merge(k, toDouble(v, 0.0), Double::sum));
        }
        Map<String, Object> avg = new LinkedHashMap<>();
        avg.put("available",      true);
        avg.put("snapshotCount",  snapshots.size());
        totals.forEach((k, v) -> avg.put(k, Math.round((v / snapshots.size()) * 100.0) / 100.0));
        return avg;
    }

    private List<Map<String, Object>> buildVideoMoments(List<Map<String, Object>> turns, double sessionStart) {
        List<Map<String, Object>> moments = new ArrayList<>();
        for (Map<String, Object> turn : turns) {
            String role = (String) turn.get("role");
            String text = (String) turn.getOrDefault("text", "");
            double rel  = Math.max(0, (toDouble(turn.get("timestamp_ms"), 0.0) / 1000.0) - sessionStart);
            if ("interviewer".equals(role)) {
                moments.add(Map.of("type", "question", "time", rel,
                        "label", "Asked: " + (text.length() > 45 ? text.substring(0, 45) + "..." : text)));
            } else if ("candidate".equals(role)) {
                fillerDetectorService.countFillerWords(text).keySet().forEach(filler ->
                        moments.add(Map.of("type", "filler", "time", rel, "label", "Filler: \"" + filler + "\"")));
            }
        }
        moments.sort(Comparator.comparingDouble(m -> (Double) m.get("time")));
        return moments;
    }

    private List<String> extractDomainTerms(String transcript, String track) {
        return getAllKeywordsForTrack(track).stream()
                .filter(transcript.toLowerCase()::contains)
                .collect(Collectors.toList());
    }

    private List<String> getAllKeywordsForTrack(String track) {
        return switch (track) {
            case "Behavioral" -> List.of("stakeholder", "deadline", "conflict", "feedback",
                    "collaboration", "leadership", "ownership", "initiative", "communication", "teamwork");
            case "HR"         -> List.of("culture", "values", "growth", "learning", "development",
                    "opportunity", "team", "collaboration", "career path", "motivation");
            default           -> List.of("algorithm", "database", "api", "rest", "async", "cache",
                    "optimization", "scalability", "architecture", "microservice", "deployment",
                    "testing", "git", "docker", "kubernetes", "sql", "framework", "library");
        };
    }

    private Map<String, Object> defaultScores() {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("communication", 5); s.put("technical", 5); s.put("grammar", 5);
        s.put("confidence",    5); s.put("roleFit",   5); s.put("structure", 5);
        s.put("vocabulary",    5); s.put("eyeContact", 5);
        return s;
    }

    private String stripMarkdownFences(String text) {
        String clean = text.trim();
        if (clean.startsWith("```json")) clean = clean.substring(7);
        else if (clean.startsWith("```"))  clean = clean.substring(3);
        if (clean.endsWith("```"))         clean = clean.substring(0, clean.length() - 3);
        return clean.trim();
    }

    private Double toDouble(Object val, double fallback) {
        return val instanceof Number n ? n.doubleValue() : fallback;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : new HashMap<>();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castMapList(Object o) {
        return o instanceof List ? (List<Map<String, Object>>) o : new ArrayList<>();
    }

    @SuppressWarnings("unchecked")
    private List<String> castStringList(Object o) {
        return o instanceof List ? (List<String>) o : new ArrayList<>();
    }
}
