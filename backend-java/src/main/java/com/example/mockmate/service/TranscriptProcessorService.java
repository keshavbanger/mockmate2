package com.example.mockmate.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TranscriptProcessorService {

    private final SessionStoreService sessionStoreService;
    private final FillerDetectorService fillerDetectorService;

    public Map<String, Object> generateTranscriptFromVideo(String sessionId) {
        try {
            Map<String, Object> session = sessionStoreService.getSession(sessionId);
            if (session == null) {
                throw new IllegalArgumentException("Session " + sessionId + " not found");
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> turns = (List<Map<String, Object>>) session.getOrDefault("turns", new ArrayList<>());
            
            if (!turns.isEmpty()) {
                String transcriptText = turns.stream()
                        .map(t -> (String) t.getOrDefault("text", ""))
                        .collect(Collectors.joining(" "));
                
                log.info("Using existing Tavus transcript for session {} ({} turns)", sessionId, turns.size());
                
                Map<String, Object> fillerAnalysis = analyzeFillers(turns, transcriptText);
                
                Map<String, Object> result = new HashMap<>();
                result.put("transcript", transcriptText);
                result.put("turns", turns);
                result.put("filler_analysis", fillerAnalysis);
                result.put("source", "tavus_webhook");
                return result;
            }

            log.info("Attempting audio extraction and transcription for session {}", sessionId);
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("transcript", "");
            fallback.put("turns", new ArrayList<>());
            fallback.put("filler_analysis", new HashMap<>());
            fallback.put("source", "none");
            fallback.put("note", "No transcript available. Set TRANSCRIPTION_SERVICE env var to enable transcription.");
            return fallback;

        } catch (Exception e) {
            log.error("Transcript generation failed for session {}", sessionId, e);
            Map<String, Object> error = new HashMap<>();
            error.put("transcript", "");
            error.put("turns", new ArrayList<>());
            error.put("filler_analysis", new HashMap<>());
            error.put("source", "error");
            error.put("error", e.getMessage());
            return error;
        }
    }

    private Map<String, Object> analyzeFillers(List<Map<String, Object>> turns, String fullTranscript) {
        Map<String, Integer> fillerCounts = fillerDetectorService.countFillerWords(fullTranscript);
        Map<String, Object> analysis = new HashMap<>();

        for (Map.Entry<String, Integer> entry : fillerCounts.entrySet()) {
            String word = entry.getKey();
            List<Map<String, Object>> occurrences = new ArrayList<>();
            
            for (int i = 0; i < turns.size(); i++) {
                Map<String, Object> turn = turns.get(i);
                String turnText = ((String) turn.getOrDefault("text", "")).toLowerCase();
                
                // Note: simple substring search as fallback, regex is better but this mimics python
                int count = turnText.split(Pattern.quote(word), -1).length - 1;
                if (count > 0) {
                    Map<String, Object> occ = new HashMap<>();
                    occ.put("turn_index", i);
                    occ.put("timestamp_ms", turn.get("timestamp_ms"));
                    occ.put("text", turn.get("text"));
                    occurrences.add(occ);
                }
            }
            if (!occurrences.isEmpty()) {
                Map<String, Object> wordData = new HashMap<>();
                wordData.put("count", entry.getValue());
                wordData.put("occurrences", occurrences);
                analysis.put(word, wordData);
            }
        }
        return analysis;
    }

    public void updateSessionWithTranscript(String sessionId, Map<String, Object> transcriptData) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> turns = (List<Map<String, Object>>) transcriptData.getOrDefault("turns", new ArrayList<>());
            String transcriptText = (String) transcriptData.getOrDefault("transcript", "");
            
            if (transcriptText.isEmpty() && !turns.isEmpty()) {
                transcriptText = turns.stream()
                        .map(t -> (String) t.getOrDefault("text", ""))
                        .collect(Collectors.joining(" "));
            }

            sessionStoreService.updateSession(sessionId, "transcript_raw", transcriptText);
            sessionStoreService.updateSession(sessionId, "turns", turns);
            sessionStoreService.updateSession(sessionId, "filler_analysis", transcriptData.getOrDefault("filler_analysis", new HashMap<>()));
            sessionStoreService.updateSession(sessionId, "transcript_source", transcriptData.getOrDefault("source", "unknown"));

            log.info("Session {} updated with transcript ({} chars, {} turns)", sessionId, transcriptText.length(), turns.size());
        } catch (Exception e) {
            log.error("Failed to update session with transcript: {}", e.getMessage());
        }
    }
}
