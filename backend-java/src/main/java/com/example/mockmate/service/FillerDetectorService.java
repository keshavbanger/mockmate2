package com.example.mockmate.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class FillerDetectorService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api-key}")
    private String geminiApiKey;

    private static final List<String> FILLER_WORDS = List.of(
            "you know", "kind of", "sort of", "you see", "i mean", "i guess",
            "um", "uh", "hmm", "err", "like", "basically", "actually",
            "literally", "right", "so", "well"
    );

    private static final Map<String, Pattern> FILLER_PATTERNS = FILLER_WORDS.stream()
            .collect(Collectors.toMap(
                    word -> word,
                    word -> Pattern.compile("\\b" + Pattern.quote(word) + "\\b", Pattern.CASE_INSENSITIVE)
            ));

    private static final String QUALITY_PROMPT = """
            Rate this interview answer from 1 to 5 based on three criteria: relevance, clarity, and depth.
            
            Question: %s
            Answer: %s
            
            Scoring guide:
              5 = Excellent — highly relevant, clearly explained, well-structured, detailed
              4 = Good — relevant and clear but could use slightly more depth
              3 = Average — partially relevant or lacking specifics
              2 = Weak — vague, off-topic, or very short
              1 = Very poor — does not address the question at all
            
            Return ONLY valid JSON with exactly these two keys:
              score (integer 1-5)
              feedback (string, max 20 words, constructive improvement hint)
            
            No markdown, no explanation. JSON only.
            """;

    public FillerDetectorService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.baseUrl("https://generativelanguage.googleapis.com/v1beta/models").build();
        this.objectMapper = objectMapper;
    }

    public Map<String, Integer> countFillerWords(String transcript) {
        if (transcript == null || transcript.trim().isEmpty()) {
            return new HashMap<>();
        }

        Map<String, Integer> counts = new HashMap<>();
        for (Map.Entry<String, Pattern> entry : FILLER_PATTERNS.entrySet()) {
            Matcher matcher = entry.getValue().matcher(transcript);
            int count = 0;
            while (matcher.find()) count++;
            if (count > 0) counts.put(entry.getKey(), count);
        }
        return counts;
    }

    public double getWordsPerMinute(String transcript, double durationSeconds) {
        if (transcript == null || transcript.trim().isEmpty() || durationSeconds <= 0) return 0.0;
        int wordCount = transcript.split("\\s+").length;
        double durationMinutes = durationSeconds / 60.0;
        return Math.round((wordCount / durationMinutes) * 10.0) / 10.0;
    }

    public int getPauseCount(String transcript) {
        if (transcript == null || transcript.isEmpty()) return 0;
        
        List<Pattern> pausePatterns = List.of(
                Pattern.compile("\\.{3,}"),
                Pattern.compile("\\.\\s\\.\\s\\."),
                Pattern.compile("\\[(pause|silence|\\.\\.\\.)]", Pattern.CASE_INSENSITIVE),
                Pattern.compile("\\s--\\s")
        );

        int count = 0;
        for (Pattern p : pausePatterns) {
            Matcher m = p.matcher(transcript);
            while (m.find()) count++;
        }
        return count;
    }

    public Map<String, Object> analyzeAnswerQuality(String question, String answer) {
        if (answer == null || answer.trim().length() < 5) {
            return Map.of("score", 1, "feedback", "Answer was too short to evaluate.");
        }

        String safeAnswer = answer.length() > 3000 ? answer.substring(0, 3000) : answer;
        String prompt = String.format(QUALITY_PROMPT, question.trim(), safeAnswer.trim());

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))));

        try {
            String url = "/gemini-1.5-flash:generateContent?key=" + geminiApiKey;
            String rawResponse = webClient.post()
                    .uri(url)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            var rootNode = objectMapper.readTree(rawResponse);
            String extractedText = rootNode.path("candidates").get(0)
                    .path("content").path("parts").get(0).path("text").asText();

            String cleanJson = stripMarkdownFences(extractedText);
            var result = objectMapper.readValue(cleanJson, Map.class);
            
            int score = result.containsKey("score") ? ((Number) result.get("score")).intValue() : 3;
            score = Math.max(1, Math.min(5, score));
            String feedback = result.getOrDefault("feedback", "No feedback provided.").toString();
            
            return Map.of("score", score, "feedback", feedback);
        } catch (Exception e) {
            log.error("Gemini error in analyze_answer_quality", e);
            return Map.of("score", 3, "feedback", "Analysis unavailable.");
        }
    }

    public Map<String, Object> summarizeFillerStats(Map<String, Integer> counts, String transcript) {
        int totalWords = transcript == null ? 0 : transcript.split("\\s+").length;
        int fillerCount = counts.values().stream().mapToInt(Integer::intValue).sum();
        double rate = totalWords > 0 ? Math.round(((double) fillerCount / totalWords * 100) * 100.0) / 100.0 : 0.0;
        
        List<String> topFillers = counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(3)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        return Map.of(
                "total_words", totalWords,
                "filler_count", fillerCount,
                "filler_rate_percent", rate,
                "breakdown", counts,
                "top_fillers", topFillers
        );
    }

    private String stripMarkdownFences(String text) {
        String clean = text.trim();
        if (clean.startsWith("```json")) clean = clean.substring(7);
        else if (clean.startsWith("```")) clean = clean.substring(3);
        if (clean.endsWith("```")) clean = clean.substring(0, clean.length() - 3);
        return clean.trim();
    }
}
