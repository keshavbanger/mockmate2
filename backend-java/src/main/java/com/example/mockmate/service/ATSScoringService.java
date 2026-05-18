package com.example.mockmate.service;

import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ATSScoringService {

    // ── Section detection patterns ─────────────────────────────────────────────
    private static final Map<String, Pattern> SECTION_PATTERNS = Map.of(
        "summary",    Pattern.compile("(?i)(summary|objective|profile|about\\s+me|professional\\s+summary)"),
        "skills",     Pattern.compile("(?i)(skills|technologies|tech\\s+stack|competencies|expertise)"),
        "experience", Pattern.compile("(?i)(experience|work\\s+history|employment|positions?\\s+held)"),
        "projects",   Pattern.compile("(?i)(projects?|portfolio|side\\s+projects?)"),
        "education",  Pattern.compile("(?i)(education|degree|university|college|academic)")
    );

    // ── Formatting risk patterns ────────────────────────────────────────────────
    private static final List<Pattern> FORMAT_RISK_PATTERNS = List.of(
        Pattern.compile("(?i)(\\|){3,}"),                          // pipe-separated tables
        Pattern.compile("(?i)(column|col-\\d|grid|table)"),        // column/table hints in text
        Pattern.compile("(?m)^.{200,}$"),                          // very long lines → possible multi-col
        Pattern.compile("(?i)(\\p{So}|\\p{Sm}){3,}")              // excessive symbols/icons
    );

    private static final List<String> FORMAT_RISK_MESSAGES = List.of(
        "Possible table or pipe-based layout detected — may break ATS parsers",
        "Column/grid layout keywords detected — ATS may read in wrong order",
        "Very long unbroken lines detected — possible multi-column format",
        "Excessive special characters or symbols detected"
    );

    // ── Quantification patterns ─────────────────────────────────────────────────
    private static final Pattern QUANT_PATTERN =
        Pattern.compile("\\d+(%|\\+|x|X|k|K|M|\\s?(years?|months?|users?|clients?|million|thousand|percent))");

    @Data
    @Builder
    public static class ScoringResult {
        private Map<String, String> sectionFeedback;   // "present"|"weak"|"missing"
        private List<String>        formattingRisks;
        private int                 sectionScore;       // 0-100
        private int                 formattingScore;    // 0-100 (higher = safer)
        private int                 quantificationScore;// 0-100
        private int                 keywordOverlapScore;// 0-100
    }

    public ScoringResult score(String resumeText, String jdText) {
        Map<String, String> sectionFeedback   = detectSections(resumeText);
        List<String>        formattingRisks   = detectFormattingRisks(resumeText);
        int sectionScore                      = calcSectionScore(sectionFeedback);
        int formattingScore                   = calcFormattingScore(formattingRisks);
        int quantificationScore               = quantificationScore(resumeText);
        int keywordOverlapScore               = keywordOverlapScore(resumeText, jdText);

        log.debug("ATS scores → sections={} format={} quant={} keyword={}",
                sectionScore, formattingScore, quantificationScore, keywordOverlapScore);

        return ScoringResult.builder()
                .sectionFeedback(sectionFeedback)
                .formattingRisks(formattingRisks)
                .sectionScore(sectionScore)
                .formattingScore(formattingScore)
                .quantificationScore(quantificationScore)
                .keywordOverlapScore(keywordOverlapScore)
                .build();
    }

    // ── Section Detection ──────────────────────────────────────────────────────
    Map<String, String> detectSections(String text) {
        Map<String, String> result = new LinkedHashMap<>();
        for (Map.Entry<String, Pattern> entry : SECTION_PATTERNS.entrySet()) {
            String section = entry.getKey();
            boolean found  = entry.getValue().matcher(text).find();

            if (!found) {
                result.put(section, "missing");
                continue;
            }

            // "weak" = section header found but very short content after it
            int headerIdx = indexOfPattern(entry.getValue(), text);
            String afterHeader = text.substring(Math.min(headerIdx + 20, text.length()));
            int contentLength = Math.min(afterHeader.length(), 400);
            String snippet = afterHeader.substring(0, contentLength).trim();
            result.put(section, snippet.split("\\s+").length < 15 ? "weak" : "present");
        }
        return result;
    }

    // ── Formatting Risk Detection ──────────────────────────────────────────────
    List<String> detectFormattingRisks(String text) {
        List<String> risks = new ArrayList<>();
        for (int i = 0; i < FORMAT_RISK_PATTERNS.size(); i++) {
            if (FORMAT_RISK_PATTERNS.get(i).matcher(text).find()) {
                risks.add(FORMAT_RISK_MESSAGES.get(i));
            }
        }
        return risks;
    }

    // ── Quantification Score ───────────────────────────────────────────────────
    int quantificationScore(String text) {
        long count = QUANT_PATTERN.matcher(text).results().count();
        // 0 → 0, 3 → 50, 6+ → 100
        return (int) Math.min(100, (count / 6.0) * 100);
    }

    // ── Keyword Overlap Score ──────────────────────────────────────────────────
    int keywordOverlapScore(String resumeText, String jdText) {
        Set<String> resumeTokens = tokenize(resumeText);
        Set<String> jdTokens     = tokenize(jdText);
        if (jdTokens.isEmpty()) return 0;
        long overlap = jdTokens.stream().filter(resumeTokens::contains).count();
        return (int) Math.min(100, (overlap * 100.0) / jdTokens.size());
    }

    // ── Score Calculators ──────────────────────────────────────────────────────
    private int calcSectionScore(Map<String, String> sections) {
        long present = sections.values().stream().filter("present"::equals).count();
        long weak    = sections.values().stream().filter("weak"::equals).count();
        // present = 20pts, weak = 10pts, max = 5 sections × 20 = 100
        return (int) Math.min(100, (present * 20) + (weak * 10));
    }

    private int calcFormattingScore(List<String> risks) {
        // Each detected risk deducts 25 points
        return Math.max(0, 100 - (risks.size() * 25));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private Set<String> tokenize(String text) {
        if (text == null || text.isBlank()) return Collections.emptySet();
        return Arrays.stream(text.toLowerCase().split("[^a-z0-9+#.]+"))
                .filter(t -> t.length() > 2)
                .collect(Collectors.toSet());
    }

    private int indexOfPattern(Pattern p, String text) {
        var matcher = p.matcher(text);
        return matcher.find() ? matcher.start() : 0;
    }
}
