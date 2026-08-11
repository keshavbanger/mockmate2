package com.example.mockmate.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import jakarta.annotation.PostConstruct;

import jakarta.annotation.PreDestroy;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ReportGeneratorService {

    private static final String MODEL            = "llama-3.3-70b-versatile";
    private static final int    MAX_TOKENS_QUAL  = 2000;
    private static final int    MAX_TOKENS_COACH = 1500;
    private static final double TEMP_QUAL        = 0.3;
    private static final double TEMP_COACH       = 0.4;
    private static final int    TIMEOUT_SEC      = 20;

    private static final Map<String, List<String>> DOMAIN_KEYWORDS = Map.of(
        "Behavioral", List.of("stakeholder","deadline","conflict","feedback","collaboration","leadership","ownership","initiative","communication","teamwork"),
        "HR",         List.of("culture","values","growth","learning","development","opportunity","team","collaboration","motivation"),
        "Technical",  List.of("algorithm","database","api","rest","async","cache","optimization","scalability","architecture","microservice","testing","docker","sql","framework","library")
    );

    private static final String SYS_QUAL =
        "You are an expert technical interview evaluator. Return ONLY valid JSON matching the exact schema. " +
        "Base ALL scores on evidence from the transcript. Never invent information. " +
        "ALL per-question scores must be integers from 0-10 (not 0-100). " +
        "If a response is completely missing or only punctuation (e.g. '.'), score it 0. " +
        "Even short partial answers deserve partial scores — score them on merit, not length. No markdown, no backticks.";

    private static final String SYS_COACH =
        "You are a career coach specialising in software engineering interview preparation. " +
        "Return ONLY valid JSON. Make coaching tasks specific and actionable based on the weaknesses shown.";

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final FillerDetectorService fillerDetectorService;

    // The qualitative + coaching calls below block the calling thread for up
    // to TIMEOUT_SEC*2 seconds each (retry-on-timeout via .block()). Running
    // them via the bare CompletableFuture.supplyAsync(...) default would put
    // them on ForkJoinPool.commonPool() — a pool shared by the entire JVM,
    // including any other parallel streams / unrelated CompletableFutures.
    // Two 20-40s blocking occupants per report request would starve that
    // shared pool under load and stall unrelated app code, not just report
    // generation. A dedicated pool isolates the blast radius to this service.
    private final ExecutorService reportExecutor = Executors.newCachedThreadPool(namedThreadFactory("report-groq"));

    @Value("${groq.api-key:}")
    private String groqApiKey;

    @PostConstruct
    public void init() {
        if (groqApiKey != null) groqApiKey = groqApiKey.trim().replace("\"","").replace("'","");
    }

    @PreDestroy
    public void shutdown() {
        reportExecutor.shutdown();
    }

    private static java.util.concurrent.ThreadFactory namedThreadFactory(String prefix) {
        AtomicInteger counter = new AtomicInteger(1);
        return runnable -> {
            Thread t = new Thread(runnable, prefix + "-" + counter.getAndIncrement());
            t.setDaemon(true);
            return t;
        };
    }

    public ReportGeneratorService(WebClient.Builder webClientBuilder,
                                   ObjectMapper objectMapper,
                                   FillerDetectorService fillerDetectorService) {
        this.webClient = webClientBuilder
            .baseUrl("https://api.groq.com/openai/v1/")
            .codecs(c -> c.defaultCodecs().maxInMemorySize(2 * 1024 * 1024))
            .build();
        this.objectMapper        = objectMapper;
        this.fillerDetectorService = fillerDetectorService;
    }

    // -- Main Entry Point --------------------------------------------------------
    public Map<String, Object> generateEnhancedReport(String sessionId, Map<String, Object> sessionData) {
        Map<String, Object> resumeData  = castMap(sessionData.getOrDefault("resume_data", new HashMap<>()));
        String interviewType            = (String) sessionData.getOrDefault("interview_type", "Technical");
        String difficulty               = (String) sessionData.getOrDefault("difficulty", "Mid");
        List<String> questions          = castStringList(sessionData.getOrDefault("questions", new ArrayList<>()));
        List<Map<String, Object>> turns = castMapList(sessionData.getOrDefault("turns", new ArrayList<>()));
        List<Map<String, Object>> snaps = castMapList(sessionData.getOrDefault("emotion_snapshots", new ArrayList<>()));

        double startTime   = toDouble(sessionData.get("start_time"), 0.0);
        double endTime     = toDouble(sessionData.get("end_time"),   startTime);
        double durationSec = Math.max(1.0, endTime - startTime);
        double durationMin = durationSec / 60.0;

        // Stage 1: Local Metrics (instant, no API)
        LocalMetrics metrics        = computeLocalMetrics(turns, snaps, durationMin, interviewType);
        Map<Integer, String> ansMap = buildAnswerMap(turns, questions);
        List<Map<String, Object>> qaPairs = buildQAPairs(questions, ansMap);

        String inputJson;
        try {
            inputJson = objectMapper.writeValueAsString(Map.of(
                "candidateName",   resumeData.getOrDefault("name",  "Candidate"),
                "role",            resumeData.getOrDefault("role",   "Professional"),
                "track",           interviewType,
                "level",           difficulty,
                "metrics",         metrics.toMap(),
                "questionAnswers", qaPairs
            ));
        } catch (Exception e) { throw new RuntimeException("Serialization failed", e); }

        log.info("[Report] Session={} wpm={} fillers={} words={} payloadBytes={}",
            sessionId, String.format("%.1f", metrics.wpm), metrics.fillerCount, metrics.totalWords, inputJson.length());

        // Stage 2: Parallel Groq calls
        final String input = inputJson;
        CompletableFuture<Map<String, Object>> qualFuture =
            CompletableFuture.supplyAsync(() -> callGroqQualitativeWithFallback(input, metrics), reportExecutor);
        CompletableFuture<Map<String, Object>> coachFuture =
            CompletableFuture.supplyAsync(() -> callGroqCoachingWithFallback(input, metrics), reportExecutor);
        CompletableFuture.allOf(qualFuture, coachFuture).join();

        Map<String, Object> qual  = qualFuture.join();
        Map<String, Object> coach = coachFuture.join();

        // Stage 3: Validate
        boolean qualValid  = isValidGroqResponse(qual);
        boolean coachValid = isValidGroqResponse(coach);
        log.info("[Report] Session={} qualValid={} coachValid={}", sessionId, qualValid, coachValid);

        // Stage 4: Assemble
        return assembleReport(sessionId, sessionData, qual, coach, metrics,
            questions, turns, ansMap, qualValid, coachValid, durationSec, startTime);
    }

    // -- Stage 1: Local Metrics --------------------------------------------------
    private LocalMetrics computeLocalMetrics(List<Map<String, Object>> turns,
                                              List<Map<String, Object>> snapshots,
                                              double durationMin, String track) {
        LocalMetrics m = new LocalMetrics();

        // Candidate-only text
        String candidateText = turns.stream()
            .filter(t -> "candidate".equals(t.get("role")))
            .map(t -> (String) t.getOrDefault("text", ""))
            .filter(s -> !s.isBlank())
            .collect(Collectors.joining(" "));

        m.totalWords  = candidateText.isBlank() ? 0 : candidateText.split("\\s+").length;
        m.uniqueWords = candidateText.isBlank() ? 0 :
            (int) Arrays.stream(candidateText.toLowerCase().split("\\s+")).distinct().count();

        // A. WPM � candidate words / duration in MINUTES, clamped 60-220
        double rawWpm = durationMin > 0 ? m.totalWords / durationMin : 0;
        m.wpm      = Math.max(60, Math.min(220, rawWpm));
        m.wpmScore = calculateWpmScore(m.wpm);

        // B. Filler score � per-minute rate (not raw count)
        Map<String, Integer> fillerCounts = fillerDetectorService.countFillerWords(candidateText);
        m.fillerCounts   = fillerCounts;
        m.fillerCount    = fillerCounts.values().stream().mapToInt(Integer::intValue).sum();
        double fpm       = durationMin > 0 ? m.fillerCount / durationMin : 0;
        m.fillerScore    = fpm <= 2 ? 100 : fpm <= 5 ? 80 : fpm <= 10 ? 60 : fpm <= 15 ? 40 : 20;
        m.pauseCount     = fillerDetectorService.getPauseCount(candidateText);

        // C. Emotion � weighted (recent 30% of session gets 1.5x weight)
        m.emotionData          = computeEmotionScore(snapshots);
        m.emotionConfScore     = toDouble(m.emotionData.get("confidenceScore"), 50.0).intValue();

        // D. Domain keyword score � normalised token matching (no partial matches)
        List<String> keywords  = DOMAIN_KEYWORDS.getOrDefault(track, DOMAIN_KEYWORDS.get("Technical"));
        Set<String> tokens     = Arrays.stream(
            candidateText.toLowerCase().replaceAll("[^a-z0-9\\s]","").split("\\s+"))
            .collect(Collectors.toSet());
        m.keywordMatches = keywords.stream().map(String::toLowerCase).filter(tokens::contains).collect(Collectors.toList());
        m.keywordMisses  = keywords.stream().map(String::toLowerCase).filter(k -> !tokens.contains(k)).collect(Collectors.toList());
        m.keywordScore   = keywords.isEmpty() ? 50 : clamp((int)((m.keywordMatches.size() * 100.0) / keywords.size()));

        return m;
    }

    private int calculateWpmScore(double wpm) {
        if (wpm >= 120 && wpm <= 160) return 100;
        if ((wpm >= 100 && wpm < 120) || (wpm > 160 && wpm <= 180)) return 80;
        if ((wpm >= 80  && wpm < 100) || (wpm > 180 && wpm <= 200)) return 60;
        return 40;
    }

    private Map<String, Object> computeEmotionScore(List<Map<String, Object>> snapshots) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (snapshots.isEmpty()) {
            result.put("available", false);
            result.put("confidenceScore", 50.0);
            return result;
        }
        Map<String, Double> weighted = new HashMap<>();
        int total = snapshots.size();
        for (int i = 0; i < total; i++) {
            double weight = i < total * 0.7 ? 1.0 : 1.5; // recent frames weighted higher
            castMap(snapshots.get(i).getOrDefault("emotions", new HashMap<>()))
                .forEach((k, v) -> weighted.merge(k, toDouble(v, 0.0) * weight, Double::sum));
        }
        double totalW = weighted.values().stream().mapToDouble(Double::doubleValue).sum();
        if (totalW > 0) weighted.replaceAll((k, v) -> (double) Math.round((v / totalW) * 100.0));

        // Positive: confident=1.0, neutral=0.5
        double positive = weighted.getOrDefault("confident", 0.0)
                        + weighted.getOrDefault("neutral",   0.0) * 0.5;
        int confScore   = clamp((int)(positive * 1.2));
        String dominant = weighted.entrySet().stream()
            .max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("neutral");

        result.put("available",          true);
        result.put("snapshotCount",      total);
        result.put("dominantEmotion",    dominant);
        result.put("emotionDistribution", weighted);
        result.put("confidenceScore",    (double) confScore);
        return result;
    }

    // -- Stage 2: Groq Calls -----------------------------------------------------
    private Map<String, Object> callGroqQualitativeWithFallback(String inputJson, LocalMetrics m) {
        try   { return callGroq(SYS_QUAL, buildQualUserPrompt(inputJson), MAX_TOKENS_QUAL, TEMP_QUAL); }
        catch (Exception e) { log.error("[Report] Qualitative call failed: {}", e.getMessage()); return buildFallbackQualitative(m); }
    }

    private Map<String, Object> callGroqCoachingWithFallback(String inputJson, LocalMetrics m) {
        try   { return callGroq(SYS_COACH, buildCoachUserPrompt(inputJson, m), MAX_TOKENS_COACH, TEMP_COACH); }
        catch (Exception e) { log.error("[Report] Coaching call failed: {}", e.getMessage()); return buildFallbackCoaching(m); }
    }

    private Map<String, Object> callGroq(String sysPrompt, String userPrompt, int maxTokens, double temp) {
        Map<String, Object> body = Map.of(
            "model", MODEL, "temperature", temp, "max_tokens", maxTokens,
            "messages", List.of(
                Map.of("role","system","content", sysPrompt),
                Map.of("role","user",  "content", userPrompt)
            )
        );
        String raw = null;
        int attempts = 0;
        long start = System.currentTimeMillis();
        while (true) {
            try {
                raw = webClient.post().uri("chat/completions")
                    .header("Authorization", "Bearer " + groqApiKey)
                    .header("Content-Type", "application/json")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(java.time.Duration.ofSeconds(TIMEOUT_SEC))
                    .block();
                log.info("[Report] Groq responded in {}ms (tokens={})", System.currentTimeMillis() - start, maxTokens);
                break;
            } catch (Exception e) {
                attempts++;
                if (attempts >= 2) throw new RuntimeException("Groq failed after " + attempts + " tries: " + e.getMessage(), e);
                log.warn("[Report] Groq timeout, retry {}/2", attempts);
            }
        }
        try {
            var root    = objectMapper.readTree(raw);
            String text = root.path("choices").get(0).path("message").path("content").asText();
            return objectMapper.readValue(stripFences(text), new TypeReference<Map<String,Object>>(){});
        } catch (Exception e) { throw new RuntimeException("Groq parse failed: " + e.getMessage(), e); }
    }

    private String buildQualUserPrompt(String inputJson) {
        return "Analyze this interview session and return exactly this JSON (all fields required, no extras):\n" +
            "IMPORTANT: All per-question scores (clarityScore, relevanceScore, structureScore, specificityScore, " +
            "technicalDepthScore) MUST be integers from 0-10. Grammar and vocabulary scores are 0-100.\n" +
            "SCORING RULES:\n" +
            "- Only set ALL scores to 0 if the answer field is literally empty, 'No answer recorded.', or only contains punctuation (like '.' alone).\n" +
            "- ANY other answer, even if short, partial, or off-topic, MUST be scored on merit (1-10 range).\n" +
            "- A partial or unclear answer should still receive a non-zero score if any relevant content exists.\n" +
            "- Do NOT use answer length as a criterion for zeroing scores.\n" +
            "INPUT: " + inputJson + "\n" +
            "RETURN:\n" +
            "{\"executiveSummary\":\"string\",\"overallVerdict\":\"Strong Hire|Hire|Maybe|No Hire\"," +
            "\"answerAnalysis\":[{\"questionIndex\":0,\"questionText\":\"string\"," +
            "\"clarityScore\":0,\"relevanceScore\":0,\"structureScore\":0," +
            "\"specificityScore\":0,\"technicalDepthScore\":0,\"usedSTAR\":false," +
            "\"feedback\":\"2-3 sentence specific feedback referencing the actual answer content\"," +
            "\"keyStrengths\":[\"max 2\"],\"improvements\":[\"max 2\"]," +
            "\"idealAnswer\":\"Write a FULL exemplary model answer (3-5 sentences) that would score 10/10 for this specific question. " +
            "Use concrete examples, metrics, and structured reasoning. Make it specific to the question topic, not generic STAR advice.\"}]," +
            "\"grammarAnalysis\":{\"score\":0,\"commonErrors\":[],\"tenseConsistency\":\"consistent\",\"corrections\":[{\"original\":\"incorrect phrase\",\"corrected\":\"corrected phrase\",\"rule\":\"Grammar Rule\",\"timestamp\":\"0:00\"}]}," +
            "\"vocabularyAnalysis\":{\"score\":0,\"domainKeywordsUsed\":[],\"missingKeywords\":[],\"sophisticationLevel\":\"basic\"}," +
            "\"roleFitAssessment\":{\"score\":0,\"fitLevel\":\"Moderate\",\"evidencePoints\":[],\"gapAreas\":[]}}\n" +
            "JSON only, no markdown.";
    }

    private String buildCoachUserPrompt(String inputJson, LocalMetrics m) {
        return "Based on this interview session, return coaching JSON (all fields required):\n" +
            "INPUT: " + inputJson + "\n" +
            "RETURN:\n" +
            "{\"recruiterReadiness\":{\"score\":0,\"tier\":\"Needs Work\",\"fixBeforeNextInterview\":[],\"strongPoints\":[]}," +
            "\"coachingPlan\":{\"weekPlan\":[{\"day\":1,\"focus\":\"topic\",\"task\":\"specific task\",\"resource\":\"resource\"}]}," +
            "\"paceAnalysis\":{\"wpmCategory\":\"ideal\",\"recommendation\":\"string\"}," +
            "\"hesitationInsights\":{\"pattern\":\"string\",\"triggerTopics\":[],\"recommendation\":\"string\"}}\n" +
            "JSON only, no markdown.";
    }

    // -- Fallbacks ---------------------------------------------------------------
    private Map<String, Object> buildFallbackQualitative(LocalMetrics m) {
        Map<String, Object> fb = new LinkedHashMap<>();
        fb.put("aiAnalysisAvailable", false);
        fb.put("executiveSummary",    "AI analysis unavailable. Scores based on measurable metrics only.");
        fb.put("overallVerdict",      "Maybe");
        fb.put("answerAnalysis",      new ArrayList<>());
        fb.put("grammarAnalysis",     Map.of("score",50,"commonErrors",List.of(),"tenseConsistency","consistent","corrections",List.of()));
        fb.put("vocabularyAnalysis",  Map.of("score",m.keywordScore,"domainKeywordsUsed",m.keywordMatches,"missingKeywords",m.keywordMisses,"sophisticationLevel","intermediate"));
        fb.put("roleFitAssessment",   Map.of("score",m.keywordScore,"fitLevel","Moderate","evidencePoints",List.of(),"gapAreas",List.of()));
        return fb;
    }

    private Map<String, Object> buildFallbackCoaching(LocalMetrics m) {
        String wpmCat = (m.wpm >= 120 && m.wpm <= 160) ? "ideal" : m.wpm < 120 ? "too slow" : "too fast";
        Map<String, Object> fb = new LinkedHashMap<>();
        fb.put("aiAnalysisAvailable", false);
        fb.put("recruiterReadiness",  Map.of("score",50,"tier","Needs Work","fixBeforeNextInterview",List.of("Practise STAR method for behavioral answers","Reduce filler words"),"strongPoints",List.of()));
        fb.put("coachingPlan",        Map.of("weekPlan",List.of(Map.of("day",1,"focus","Structure","task","Practise 2 behavioral answers using STAR","resource","STAR method guide on InterviewPrep.org"))));
        fb.put("paceAnalysis",        Map.of("wpmCategory",wpmCat,"recommendation","Target 120-160 WPM for optimal clarity."));
        fb.put("hesitationInsights",  Map.of("pattern","Filler words detected","triggerTopics",List.of(),"recommendation","Pause silently instead of saying 'um' or 'uh'."));
        return fb;
    }

    // -- Stage 3: Validation -----------------------------------------------------
    private boolean isValidGroqResponse(Map<String, Object> r) {
        if (r == null || r.isEmpty()) return false;
        if (Boolean.FALSE.equals(r.get("aiAnalysisAvailable"))) return false;
        return true;
    }

    // -- Stage 4: Assembly -------------------------------------------------------
    private Map<String, Object> assembleReport(
            String sessionId, Map<String, Object> sessionData,
            Map<String, Object> qual, Map<String, Object> coach,
            LocalMetrics m, List<String> questions,
            List<Map<String, Object>> turns, Map<Integer, String> ansMap,
            boolean qualValid, boolean coachValid,
            double durationSec, double sessionStart) {

        Map<String, Object> resumeData  = castMap(sessionData.getOrDefault("resume_data", new HashMap<>()));
        String interviewType            = (String) sessionData.getOrDefault("interview_type", "Technical");

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("sessionId",        sessionId);
        report.put("aiAnalysisPartial", !qualValid || !coachValid);

        // 1. Candidate info
        report.put("candidate", Map.of(
            "name",          resumeData.getOrDefault("name",  "Candidate"),
            "role",          resumeData.getOrDefault("role",  "Professional"),
            "date",          LocalDate.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy")),
            "duration",      String.format("%.0f min", durationSec / 60.0),
            "interviewType", interviewType,
            "id",            sessionId != null && sessionId.length() > 8 ? sessionId.substring(0, 8) : sessionId
        ));

        // 2. Grammar & vocabulary from qual
        Map<String, Object> grammarResult  = castMap(qual.getOrDefault("grammarAnalysis",
            Map.of("score",50,"commonErrors",List.of(),"tenseConsistency","consistent","corrections",List.of())));
        Map<String, Object> vocabResult    = castMap(qual.getOrDefault("vocabularyAnalysis",
            Map.of("score",m.keywordScore,"domainKeywordsUsed",m.keywordMatches,"missingKeywords",m.keywordMisses,"sophisticationLevel","intermediate")));
        int grammarScore = clamp(toDouble(grammarResult.get("score"), 50.0).intValue());

        // 3. Communication score: wpm*0.35 + filler*0.35 + grammar*0.30
        int communicationScore = clamp((int)(m.wpmScore * 0.35 + m.fillerScore * 0.35 + grammarScore * 0.30));

        // 4. Answer analysis ─ real transcripts injected, scores averaged from rubric
        // ── BUG 6 FIX: build full transcript from per-question turns for WPM/filler ──
        String fullTranscriptForMetrics = ansMap.values().stream()
            .filter(v -> v != null && !v.isBlank()
                      && !v.equalsIgnoreCase("No answer provided.")
                      && !v.equalsIgnoreCase("No speech detected."))
            .collect(Collectors.joining(" "));
        // Re-compute local metrics if we have richer per-question transcript
        if (!fullTranscriptForMetrics.isBlank() && fullTranscriptForMetrics.split("\\s+").length > m.totalWords) {
            log.info("[Report] Re-computing metrics from per-question transcript ({} words)",
                fullTranscriptForMetrics.split("\\s+").length);
            // Update word counts from actual captured answers
            m.totalWords  = fullTranscriptForMetrics.split("\\s+").length;
            double rawWpm = durationSec > 60 ? m.totalWords / (durationSec / 60.0) : 0;
            m.wpm      = Math.max(60, Math.min(220, rawWpm));
            m.wpmScore = calculateWpmScore(m.wpm);
            Map<String, Integer> fc = fillerDetectorService.countFillerWords(fullTranscriptForMetrics);
            m.fillerCounts = fc;
            m.fillerCount  = fc.values().stream().mapToInt(Integer::intValue).sum();
        }

        List<Map<String, Object>> answerAnalysis = castMapList(qual.getOrDefault("answerAnalysis", new ArrayList<>()));
        if (answerAnalysis.isEmpty()) {
            log.info("[Report] Generating fallback answerAnalysis list from questions");
            for (int i = 0; i < questions.size(); i++) {
                Map<String, Object> ans = new LinkedHashMap<>();
                ans.put("questionIndex", i);
                if (i < questions.size()) {
                    ans.put("questionText", questions.get(i));
                }
                ans.put("clarityScore", 5);
                ans.put("relevanceScore", 5);
                ans.put("structureScore", 5);
                ans.put("specificityScore", 5);
                ans.put("technicalDepthScore", 5);
                ans.put("usedSTAR", false);
                ans.put("feedback", "AI evaluation not completed. Good start, focus on structuring answers.");
                ans.put("keyStrengths", List.of("Delivered transcript"));
                ans.put("improvements", List.of("Use structured formats"));
                ans.put("idealAnswer", "AI evaluation was not completed for this question. A strong answer would use the STAR method with specific examples and measurable outcomes relevant to the question topic.");
                answerAnalysis.add(ans);
            }
        }

        int technicalAvg = 50, clarityAvg = 50;
        if (!answerAnalysis.isEmpty()) {
            int techSum = 0, clarSum = 0;
            for (int i = 0; i < answerAnalysis.size(); i++) {
                Map<String, Object> ans = answerAnalysis.get(i);
                // ── BUG 4 FIX: inject question text from questions list ──────────
                if (i < questions.size()) {
                    ans.putIfAbsent("questionText", questions.get(i));
                }
                // Inject real transcript
                // Only treat as "no answer" if: null, blank, explicit no-answer placeholder, or pure punctuation (≤3 chars like ".")
                String real = ansMap.get(i);
                String realTrimmed = real != null ? real.trim() : "";
                boolean hasAnswer = !realTrimmed.isEmpty()
                    && !realTrimmed.equalsIgnoreCase("No answer provided.")
                    && !realTrimmed.equalsIgnoreCase("No answer recorded.")
                    && !realTrimmed.equalsIgnoreCase("No speech detected.")
                    && realTrimmed.replaceAll("[^a-zA-Z0-9]", "").length() > 3;
                ans.put("transcript", hasAnswer ? realTrimmed : "No answer was provided for this question.");
                log.info("[Report] Q{} hasAnswer={} len={} preview='{}'", i, hasAnswer, realTrimmed.length(),
                    realTrimmed.substring(0, Math.min(50, realTrimmed.length())));
                ans.put("id", i + 1);

                // Inject audio URL and duration_ms if present in the turns list
                String audioUrl = null;
                Number durationMs = null;
                for (Map<String, Object> turn : turns) {
                    if ("candidate".equals(turn.get("role"))) {
                        Number qIdxNum = (Number) turn.get("question_index");
                        if (qIdxNum != null && qIdxNum.intValue() == i) {
                            audioUrl = (String) turn.get("audio_url");
                            durationMs = (Number) turn.get("duration_ms");
                            break;
                        }
                    }
                }
                if (audioUrl != null) {
                    ans.put("audioUrl", audioUrl);
                }
                if (durationMs != null) {
                    ans.put("durationMs", durationMs.longValue());
                }

                // Inject per-answer filler word detection with character positions
                if (hasAnswer) {
                    Map<String, Integer> perAnswerFillers = fillerDetectorService.countFillerWords(realTrimmed);
                    if (!perAnswerFillers.isEmpty()) {
                        List<Map<String, Object>> fillerPositions = new ArrayList<>();
                        String lowerText = realTrimmed.toLowerCase();
                        for (Map.Entry<String, Integer> fe : perAnswerFillers.entrySet()) {
                            String filler = fe.getKey().toLowerCase();
                            int startIdx = 0;
                            while ((startIdx = lowerText.indexOf(filler, startIdx)) != -1) {
                                // Only match whole words (check boundaries)
                                boolean leftOk = startIdx == 0 || !Character.isLetterOrDigit(lowerText.charAt(startIdx - 1));
                                boolean rightOk = (startIdx + filler.length()) >= lowerText.length()
                                    || !Character.isLetterOrDigit(lowerText.charAt(startIdx + filler.length()));
                                if (leftOk && rightOk) {
                                    Map<String, Object> pos = new LinkedHashMap<>();
                                    pos.put("word", fe.getKey());
                                    pos.put("charStart", startIdx);
                                    pos.put("charEnd", startIdx + filler.length());
                                    // Estimate timestamp: (charPosition / totalChars) * durationMs
                                    if (durationMs != null && durationMs.longValue() > 0) {
                                        double ratio = (double) startIdx / Math.max(1, lowerText.length());
                                        pos.put("estimatedTimeMs", (long)(ratio * durationMs.longValue()));
                                    }
                                    fillerPositions.add(pos);
                                }
                                startIdx += filler.length();
                            }
                        }
                        fillerPositions.sort(Comparator.comparingInt(p -> (int) p.get("charStart")));
                        ans.put("fillerPositions", fillerPositions);
                        ans.put("fillerCount", perAnswerFillers.values().stream().mapToInt(Integer::intValue).sum());
                    }
                }

                if (!hasAnswer) {
                    // ── BUG 5 FIX: skip AI scoring for empty answers ──────────
                    ans.put("clarityScore",       0);
                    ans.put("relevanceScore",      0);
                    ans.put("structureScore",      0);
                    ans.put("specificityScore",    0);
                    ans.put("technicalDepthScore", 0);
                    ans.put("score",               0);
                    ans.put("feedback",            "No answer was provided for this question.");
                    continue;
                }

                // ── BUG 3 FIX: scores are 0-10 from prompt; normalize strictly ──
                int clarity    = clamp10(toDouble(ans.get("clarityScore"),        5.0).intValue());
                int relevance  = clamp10(toDouble(ans.get("relevanceScore"),       5.0).intValue());
                int structure  = clamp10(toDouble(ans.get("structureScore"),       5.0).intValue());
                int specificity= clamp10(toDouble(ans.get("specificityScore"),     5.0).intValue());
                int techDepth  = clamp10(toDouble(ans.get("technicalDepthScore"),  5.0).intValue());

                ans.put("clarityScore",       clarity);
                ans.put("relevanceScore",      relevance);
                ans.put("structureScore",      structure);
                ans.put("specificityScore",    specificity);
                ans.put("technicalDepthScore", techDepth);
                // Store per-answer score on 0-10 scale for frontend display
                ans.put("score",    (clarity + relevance + structure + specificity + techDepth) / 5);
                ans.put("maxScore", 10);

                // Convert to 0-100 for the overall average computation
                techSum += techDepth * 10; clarSum += clarity * 10;
            }
            technicalAvg = answerAnalysis.isEmpty() ? 50 : clamp(techSum / answerAnalysis.size());
            clarityAvg   = answerAnalysis.isEmpty() ? 50 : clamp(clarSum / answerAnalysis.size());
        }
        report.put("answers", answerAnalysis);

        // 5. Role fit score
        Map<String, Object> roleFit = castMap(qual.getOrDefault("roleFitAssessment",
            Map.of("score",m.keywordScore,"fitLevel","Moderate","evidencePoints",List.of(),"gapAreas",List.of())));
        int roleFitScore = clamp(toDouble(roleFit.get("score"), m.keywordScore).intValue());

        // 6. Overall score: tech*0.30 + comm*0.25 + conf*0.20 + clarity*0.15 + keyword*0.10, scaled by completion ratio
        int totalQuestions = questions.size();
        int answeredQuestions = 0;
        for (int i = 0; i < totalQuestions; i++) {
            String real = ansMap.get(i);
            if (real != null && !real.isBlank()
                    && !real.equalsIgnoreCase("No answer provided.")
                    && !real.equalsIgnoreCase("No speech detected.")
                    && real.trim().length() > 14) {
                answeredQuestions++;
            }
        }
        double completionRatio = totalQuestions > 0 ? (double) answeredQuestions / totalQuestions : 1.0;
        int overallScore = clamp((int)(
            (technicalAvg          * 0.30 +
             communicationScore    * 0.25 +
             m.emotionConfScore    * 0.20 +
             clarityAvg            * 0.15 +
             toDouble(vocabResult.get("score"), (double) m.keywordScore) * 0.10) * completionRatio
        ));

        report.put("overallScore",     overallScore);
        report.put("executiveSummary", qual.getOrDefault("executiveSummary", "Report generated from measurable metrics."));
        report.put("finalVerdict",     qual.getOrDefault("overallVerdict", "Maybe"));

        // Build grammarAnalysis map matching frontend expected fields
        Map<String, Object> grammarAnalysis = new LinkedHashMap<>();
        int gScore = clamp(toDouble(grammarResult.get("score"), 50.0).intValue());
        grammarAnalysis.put("score", gScore);
        List<Map<String, Object>> correctionsList = parseAndNormalizeCorrections(grammarResult.get("corrections"));
        int errorsCount = correctionsList.size();
        if (errorsCount == 0 && gScore < 95) {
            errorsCount = (100 - gScore) / 8;
        }
        grammarAnalysis.put("errors", errorsCount);
        long tenseCount = correctionsList.stream()
            .filter(c -> c.getOrDefault("rule", "").toString().toLowerCase().contains("tense") 
                      || c.getOrDefault("rule", "").toString().toLowerCase().contains("verb"))
            .count();
        if (tenseCount == 0 && errorsCount > 0) {
            tenseCount = Math.max(1, errorsCount / 3);
        }
        grammarAnalysis.put("tenseIssues", tenseCount);
        int complexityVal = Math.min(95, Math.max(45, (int)(m.uniqueWords * 100.0 / Math.max(1, m.totalWords)) + 25));
        grammarAnalysis.put("complexity", complexityVal);
        grammarAnalysis.put("corrections", correctionsList);
        report.put("grammarAnalysis", grammarAnalysis);

        // Build vocabulary map matching frontend expected fields
        Map<String, Object> vocabularyMap = new LinkedHashMap<>();
        int vocabScore = clamp(toDouble(vocabResult.get("score"), m.keywordScore).intValue());
        vocabularyMap.put("richnessScore", vocabScore);
        vocabularyMap.put("totalWords", m.totalWords);
        List<String> usedKeywords = castStringList(vocabResult.getOrDefault("domainKeywordsUsed", m.keywordMatches));
        List<String> missingKeywords = castStringList(vocabResult.getOrDefault("missingKeywords", m.keywordMisses));
        vocabularyMap.put("domainTermsUsed", usedKeywords);
        vocabularyMap.put("missingDomainTerms", missingKeywords);
        report.put("vocabulary", vocabularyMap);

        // Build roleFitAssessment map matching frontend expected fields
        Map<String, Object> roleFitAssessmentMap = new LinkedHashMap<>();
        int rFitScore = clamp(toDouble(roleFit.get("score"), m.keywordScore).intValue());
        roleFitAssessmentMap.put("roleFitScore", rFitScore);
        String fitLevel = (String) roleFit.getOrDefault("fitLevel", "Moderate");
        roleFitAssessmentMap.put("summary", fitLevel);
        List<?> evidencePoints = (List<?>) roleFit.getOrDefault("evidencePoints", List.of());
        List<?> gapAreas = (List<?>) roleFit.getOrDefault("gapAreas", List.of());
        roleFitAssessmentMap.put("evidence", evidencePoints);
        roleFitAssessmentMap.put("gaps", gapAreas);
        report.put("roleFitAssessment", roleFitAssessmentMap);

        // Normalize scores to a 0-10 scale
        double comm10 = toScale10(communicationScore);
        double tech10 = toScale10(technicalAvg);
        double gram10 = toScale10(gScore);
        double conf10 = toScale10(m.emotionConfScore);
        double role10 = toScale10(rFitScore);
        double stru10 = toScale10(clarityAvg);
        double voca10 = toScale10(vocabScore);
        double eye10  = toScale10(m.emotionConfScore);

        double softSkills = Math.round(((conf10 + comm10 + eye10) / 3.0) * 10.0) / 10.0;
        double problemSolving = Math.round(((tech10 + stru10) / 2.0) * 10.0) / 10.0;

        report.put("scores", Map.of(
            "communication",  comm10,
            "technical",      tech10,
            "grammar",        gram10,
            "confidence",     conf10,
            "roleFit",        role10,
            "structure",      stru10,
            "vocabulary",     voca10,
            "eyeContact",     eye10,
            "softSkills",     softSkills,
            "problemSolving", problemSolving
        ));

        report.put("strengths",      qual.getOrDefault("strengths",     List.of()));
        report.put("areasToImprove", qual.getOrDefault("areasToImprove",List.of()));
        report.put("grammarAnalysis",   grammarAnalysis);
        report.put("vocabulary",        vocabularyMap);
        report.put("roleFitAssessment", roleFitAssessmentMap);

        // Generate answerCompleteness dynamically
        List<Map<String, Object>> perAnswerList = new ArrayList<>();
        int completenessSum = 0;
        for (Map<String, Object> ans : answerAnalysis) {
            int relevance = toDouble(ans.get("relevanceScore"), 5.0).intValue();
            int specificity = toDouble(ans.get("specificityScore"), 5.0).intValue();
            int completenessPercent = Math.min(100, Math.max(0, (relevance + specificity) * 5));
            completenessSum += completenessPercent;
            
            String feedback = (String) ans.getOrDefault("feedback", "");
            String note = "Addressed core concepts.";
            if (feedback != null && !feedback.isBlank()) {
                note = feedback.length() > 60 ? feedback.substring(0, 57) + "..." : feedback;
            }
            
            Map<String, Object> completenessItem = new LinkedHashMap<>();
            completenessItem.put("completenessPercent", completenessPercent);
            completenessItem.put("note", note);
            perAnswerList.add(completenessItem);
        }
        int overallCompleteness = answerAnalysis.isEmpty() ? 50 : (completenessSum / answerAnalysis.size());
        Map<String, Object> answerCompleteness = Map.of(
            "overallCompletenessScore", overallCompleteness,
            "perAnswer", perAnswerList
        );
        report.put("answerCompleteness", answerCompleteness);

        // 7. Coaching data matching frontend expected fields
        Map<String, Object> rawReadiness = castMap(coach.getOrDefault("recruiterReadiness", new HashMap<>()));
        Map<String, Object> recruiterReadinessMap = new LinkedHashMap<>();
        int readinessScoreVal = clamp(toDouble(rawReadiness.get("score"), 50.0).intValue());
        recruiterReadinessMap.put("readinessScore", readinessScoreVal);
        recruiterReadinessMap.put("verdict", rawReadiness.getOrDefault("tier", "Needs Work"));
        List<?> rawFixBefore = (List<?>) rawReadiness.getOrDefault("fixBeforeNextInterview", List.of("Practise structured responses", "Reduce pauses"));
        List<?> rawStrong = (List<?>) rawReadiness.getOrDefault("strongPoints", List.of("Clear pronunciation"));
        recruiterReadinessMap.put("mustImproveBefore", rawFixBefore);
        recruiterReadinessMap.put("readyStrengths", rawStrong);
        report.put("recruiterReadiness", recruiterReadinessMap);

        Map<String, Object> rawPace = castMap(coach.getOrDefault("paceAnalysis", new HashMap<>()));
        Map<String, Object> paceAnalysisMap = new LinkedHashMap<>();
        paceAnalysisMap.put("wpm", m.wpm);
        String pacingLabel = "Moderate";
        if (m.wpm > 160) pacingLabel = "Too Fast";
        else if (m.wpm >= 120) pacingLabel = "Ideal";
        else if (m.wpm >= 90) pacingLabel = "Moderate";
        else pacingLabel = "Too Slow";
        paceAnalysisMap.put("pacingLabel", pacingLabel);
        paceAnalysisMap.put("insight", rawPace.getOrDefault("recommendation", "Maintain a steady speaking rhythm."));
        
        List<Map<String, Object>> timeDistribution = new ArrayList<>();
        for (int i = 0; i < questions.size(); i++) {
            double durationSecForQ = 0.0;
            for (Map<String, Object> turn : turns) {
                if ("candidate".equals(turn.get("role"))) {
                    Number qi = (Number) turn.get("question_index");
                    if (qi != null && qi.intValue() == i) {
                        Number dur = (Number) turn.get("duration_ms");
                        if (dur != null) {
                            durationSecForQ = dur.doubleValue() / 1000.0;
                        }
                    }
                }
            }
            if (durationSecForQ == 0.0) {
                String ans = ansMap.get(i);
                if (ans != null && !ans.isBlank()) {
                    int words = ans.split("\\s+").length;
                    durationSecForQ = Math.max(5.0, (words * 60.0) / 130.0);
                }
            }
            Map<String, Object> distItem = new LinkedHashMap<>();
            distItem.put("label", "Answer to Question " + (i + 1));
            distItem.put("durationNote", String.format("%.0fs speaking time", durationSecForQ));
            timeDistribution.add(distItem);
        }
        paceAnalysisMap.put("timeDistribution", timeDistribution);
        report.put("paceAnalysis", paceAnalysisMap);

        Map<String, Object> rawHesitation = castMap(coach.getOrDefault("hesitationInsights", new HashMap<>()));
        Map<String, Object> hesitationInsightsMap = new LinkedHashMap<>();
        hesitationInsightsMap.put("totalFillerWords", m.fillerCount);
        double fRate = m.totalWords > 0 ? (m.fillerCount * 100.0) / (m.totalWords + m.fillerCount) : 0.0;
        hesitationInsightsMap.put("fillerRate", fRate);
        hesitationInsightsMap.put("pauseCount", m.pauseCount);
        List<String> sortedFillers = m.fillerCounts.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
        if (sortedFillers.isEmpty() && m.fillerCount > 0) {
            sortedFillers = List.of("um", "like", "ah");
        }
        hesitationInsightsMap.put("topFillers", sortedFillers);
        hesitationInsightsMap.put("hesitationPattern", rawHesitation.getOrDefault("pattern", "Minor pauses detected."));
        hesitationInsightsMap.put("impactOnDelivery", rawHesitation.getOrDefault("recommendation", "Try pausing silently rather than vocalizing fillers."));
        report.put("hesitationInsights", hesitationInsightsMap);

        // 8. Coaching plan - frontend expects cefrLevel, weekPlan, strengths, weaknesses
        Map<String, Object> coachingPlan  = castMap(coach.getOrDefault("coachingPlan", new HashMap<>()));
        Object rawWeekPlan                = coachingPlan.get("weekPlan");
        List<?> weekPlan                  = rawWeekPlan instanceof List ? (List<?>) rawWeekPlan : List.of();
        
        List<Map<String, Object>> normalizedWeekPlan = new ArrayList<>();
        for (Object itemObj : weekPlan) {
            if (itemObj instanceof Map) {
                Map<String, Object> itemMap = new LinkedHashMap<>(castMap(itemObj));
                Object dayVal = itemMap.get("day");
                if (dayVal != null) {
                    if (dayVal instanceof Number) {
                        itemMap.put("day", "Day " + dayVal);
                    }
                } else {
                    Object daysVal = itemMap.get("days");
                    if (daysVal != null) {
                        itemMap.put("day", daysVal.toString());
                    } else {
                        itemMap.put("day", "Day");
                    }
                }
                normalizedWeekPlan.add(itemMap);
            }
        }
        
        String cefr = "B2";
        if (comm10 >= 8.5) cefr = "C1";
        else if (comm10 >= 7.0) cefr = "B2";
        else if (comm10 >= 5.0) cefr = "B1";
        else cefr = "A2";

        report.put("coaching", Map.of(
            "strengths",  qual.getOrDefault("strengths",     List.of()),
            "weaknesses", qual.getOrDefault("areasToImprove",List.of()),
            "weekPlan",   normalizedWeekPlan,
            "cefrLevel",  cefr
        ));

        // 9. Raw metrics
        report.put("fillerWords", m.fillerCounts);
        report.put("wpm",         m.wpm);
        report.put("wpmScore",    m.wpmScore);
        report.put("pauseCount",  m.pauseCount);
        report.put("facialAnalysis", m.emotionData);
        report.put("videoMoments",   buildVideoMoments(turns, sessionStart));

        // 10. JD skill analysis (only present when JD was provided)
        Object skillGaps    = sessionData.get("skill_gaps");
        Object matchedSkills = sessionData.get("matched_skills");
        if (skillGaps     != null) report.put("skillGaps",     skillGaps);
        if (matchedSkills != null) report.put("matchedSkills", matchedSkills);

        // 11. Company mode metadata
        Object companyId      = sessionData.get("company_id");
        Object companyDisplay = sessionData.get("company_display");
        Object interviewStyle = sessionData.get("interview_style");
        Object richQuestions  = sessionData.get("rich_questions");
        if (companyId      != null) report.put("companyId",      companyId);
        if (companyDisplay != null) report.put("companyDisplay", companyDisplay);
        if (interviewStyle != null) report.put("interviewStyle", interviewStyle);
        if (richQuestions  != null) report.put("richQuestions",  richQuestions);

        return report;
    }

    // -- Private Helpers ---------------------------------------------------------
    private Map<Integer, String> buildAnswerMap(List<Map<String, Object>> turns, List<String> questions) {
        Map<Integer, String> map = new HashMap<>();
        int qIdx = 0;
        for (Map<String, Object> turn : turns) {
            String role = ((String) turn.getOrDefault("role","")).toLowerCase();
            String text = ((String) turn.getOrDefault("text","")).trim();

            if ("interviewer".equals(role) && qIdx < questions.size()) {
                qIdx++;
            } else if ("candidate".equals(role) && !text.isBlank()
                    && !text.equalsIgnoreCase("No answer provided.")
                    && !text.equalsIgnoreCase("(No speech detected)")) {
                // question_index is set reliably by the new CandidatePanel
                Number qi  = (Number) turn.get("question_index");
                int idx    = qi != null ? qi.intValue() : Math.max(0, qIdx - 1);
                map.merge(idx, text, (a, b) -> a + " " + b);
            }
        }
        return map;
    }


    private List<Map<String, Object>> buildQAPairs(List<String> questions, Map<Integer, String> ansMap) {
        List<Map<String, Object>> pairs = new ArrayList<>();
        for (int i = 0; i < questions.size(); i++) {
            String ans = ansMap.getOrDefault(i, "No answer recorded.");
            pairs.add(Map.of(
                "questionIndex", i,
                "question",      questions.get(i),
                "answer",        ans.length() > 500 ? ans.substring(0, 500) + "..." : ans
            ));
        }
        return pairs;
    }

    private List<Map<String, Object>> buildVideoMoments(List<Map<String, Object>> turns, double sessionStart) {
        List<Map<String, Object>> moments = new ArrayList<>();
        for (Map<String, Object> turn : turns) {
            String role = (String) turn.get("role");
            String text = (String) turn.getOrDefault("text", "");
            double rel  = Math.max(0, toDouble(turn.get("timestamp_ms"), 0.0) / 1000.0 - sessionStart);
            if ("interviewer".equals(role)) {
                moments.add(Map.of("type","question","time",rel,
                    "label","Asked: " + (text.length() > 45 ? text.substring(0,45) + "..." : text)));
            } else if ("candidate".equals(role)) {
                fillerDetectorService.countFillerWords(text).keySet()
                    .forEach(f -> moments.add(Map.of("type","filler","time",rel,"label","Filler: \""+f+"\"")));
            }
        }
        moments.sort(Comparator.comparingDouble(mo -> (Double) mo.get("time")));
        return moments;
    }

    private int clamp(int v)   { return Math.max(0,  Math.min(100, v)); }
    /** Normalize per-question scores which are on 0-10 scale. */
    private int clamp10(int v) { return Math.max(0,  Math.min(10,  v)); }

    private double toScale10(double score0to100) {
        return Math.round((Math.max(0.0, Math.min(100.0, score0to100)) / 10.0) * 10.0) / 10.0;
    }

    private String stripFences(String text) {
        if (text == null) return "{}";
        String trimmed = text.trim();
        int firstBrace = trimmed.indexOf('{');
        int lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            return trimmed.substring(firstBrace, lastBrace + 1);
        }
        int firstBracket = trimmed.indexOf('[');
        int lastBracket = trimmed.lastIndexOf(']');
        if (firstBracket >= 0 && lastBracket > firstBracket) {
            return trimmed.substring(firstBracket, lastBracket + 1);
        }
        return trimmed;
    }

    private static final ObjectMapper SAFE_CAST_MAPPER = new ObjectMapper();

    private Double toDouble(Object val, double fallback) {
        return val instanceof Number n ? n.doubleValue() : fallback;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> castMap(Object o) {
        if (o instanceof Map) {
            return (Map<String, Object>) o;
        }
        if (o instanceof String s) {
            try {
                String trimmed = s.trim();
                if (!trimmed.isEmpty()) {
                    return SAFE_CAST_MAPPER.readValue(trimmed, new TypeReference<Map<String, Object>>() {});
                }
            } catch (Exception e) {
                log.warn("Failed to parse JSON string to Map: {}", s, e);
            }
        }
        return new HashMap<>();
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> castMapList(Object o) {
        if (o instanceof List<?> list) {
            List<Map<String, Object>> res = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map) {
                    res.add((Map<String, Object>) item);
                } else if (item instanceof String s) {
                    try {
                        String trimmed = s.trim();
                        if (!trimmed.isEmpty()) {
                            res.add(SAFE_CAST_MAPPER.readValue(trimmed, new TypeReference<Map<String, Object>>() {}));
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse JSON string element in list to Map: {}", s, e);
                    }
                }
            }
            return res;
        }
        if (o instanceof String s) {
            try {
                String trimmed = s.trim();
                if (!trimmed.isEmpty()) {
                    return SAFE_CAST_MAPPER.readValue(trimmed, new TypeReference<List<Map<String, Object>>>() {});
                }
            } catch (Exception e) {
                log.warn("Failed to parse JSON string to List<Map>: {}", s, e);
            }
        }
        return new ArrayList<>();
    }

    @SuppressWarnings("unchecked")
    public static List<String> castStringList(Object o) {
        if (o instanceof List<?> list) {
            List<String> res = new ArrayList<>();
            for (Object item : list) {
                if (item != null) {
                    res.add(item.toString());
                }
            }
            return res;
        }
        if (o instanceof String s) {
            try {
                String trimmed = s.trim();
                if (!trimmed.isEmpty()) {
                    return SAFE_CAST_MAPPER.readValue(trimmed, new TypeReference<List<String>>() {});
                }
            } catch (Exception e) {
                log.warn("Failed to parse JSON string to List<String>: {}", s, e);
            }
        }
        return new ArrayList<>();
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> parseAndNormalizeCorrections(Object o) {
        List<Map<String, Object>> normalized = new ArrayList<>();
        if (o == null) {
            return normalized;
        }
        List<?> rawList = null;
        if (o instanceof List) {
            rawList = (List<?>) o;
        } else if (o instanceof String s) {
            try {
                String trimmed = s.trim();
                if (!trimmed.isEmpty()) {
                    rawList = SAFE_CAST_MAPPER.readValue(trimmed, new TypeReference<List<Object>>() {});
                }
            } catch (Exception e) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("timestamp", "0:00");
                item.put("rule", "Grammar");
                item.put("original", "");
                item.put("corrected", s);
                normalized.add(item);
                return normalized;
            }
        }
        if (rawList != null) {
            for (Object item : rawList) {
                if (item instanceof Map) {
                    Map<?, ?> map = (Map<?, ?>) item;
                    Map<String, Object> normMap = new LinkedHashMap<>();
                    normMap.put("timestamp", map.get("timestamp") != null ? map.get("timestamp").toString() : "0:00");
                    normMap.put("rule", map.get("rule") != null ? map.get("rule").toString() : "Grammar");
                    normMap.put("original", map.get("original") != null ? map.get("original").toString() : "");
                    normMap.put("corrected", map.get("corrected") != null ? map.get("corrected").toString() : "");
                    normalized.add(normMap);
                } else if (item != null) {
                    Map<String, Object> normMap = new LinkedHashMap<>();
                    normMap.put("timestamp", "0:00");
                    normMap.put("rule", "Style");
                    normMap.put("original", "");
                    normMap.put("corrected", item.toString());
                    normalized.add(normMap);
                }
            }
        }
        return normalized;
    }

    // -- Inner Class: LocalMetrics ------------------------------------------------
    private static class LocalMetrics {
        double wpm;
        int    wpmScore, fillerScore, fillerCount, pauseCount;
        int    totalWords, uniqueWords, keywordScore, emotionConfScore;
        Map<String, Integer> fillerCounts   = new HashMap<>();
        List<String>         keywordMatches = new ArrayList<>();
        List<String>         keywordMisses  = new ArrayList<>();
        Map<String, Object>  emotionData    = new HashMap<>();

        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("wpm",                wpm);
            m.put("wpmScore",           wpmScore);
            m.put("fillerScore",        fillerScore);
            m.put("fillerCount",        fillerCount);
            m.put("pauseCount",         pauseCount);
            m.put("totalWords",         totalWords);
            m.put("uniqueWords",        uniqueWords);
            m.put("keywordScore",       keywordScore);
            m.put("emotionConfScore",   emotionConfScore);
            m.put("keywordMatches",     keywordMatches);
            m.put("keywordMisses",      keywordMisses);
            return m;
        }
    }
}
