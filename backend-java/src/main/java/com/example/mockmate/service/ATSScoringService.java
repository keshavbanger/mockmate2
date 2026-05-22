package com.example.mockmate.service;

import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ATSScoringService {

    // ── Skill alias normalization ──────────────────────────────────────────────────
    private static final Map<String, String> SKILL_ALIASES = Map.ofEntries(
        Map.entry("js",          "javascript"),
        Map.entry("reactjs",     "javascript"),
        Map.entry("react.js",    "javascript"),
        Map.entry("node.js",     "nodejs"),
        Map.entry("rest api",    "rest apis"),
        Map.entry("spring",      "spring boot"),
        Map.entry("postgres",    "postgresql"),
        Map.entry("mongo",       "mongodb"),
        Map.entry("k8s",         "kubernetes"),
        Map.entry("ts",          "typescript")
    );

    // ── Synonym map ───────────────────────────────────────────────────────────────
    private static final Map<String, List<String>> SYNONYMS = Map.of(
        "developed", List.of("built", "created", "engineered"),
        "managed",   List.of("led", "headed", "oversaw"),
        "improved",  List.of("optimized", "enhanced", "boosted"),
        "designed",  List.of("architected", "planned", "structured"),
        "deployed",  List.of("released", "shipped", "launched")
    );

    // ── Section detection with extended aliases ────────────────────────────────────
    private static final Map<String, Pattern> SECTION_PATTERNS = Map.of(
        "summary",    Pattern.compile("(?i)(summary|objective|profile|about\\s+me|professional\\s+summary)"),
        "skills",     Pattern.compile("(?i)(skills|technologies|tech\\s+stack|technical\\s+skills|core\\s+competencies|expertise)"),
        "experience", Pattern.compile("(?i)(experience|work\\s+history|employment|work\\s+experience|professional\\s+background|career\\s+history|positions\\s+held)"),
        "projects",   Pattern.compile("(?i)(projects?|portfolio|personal\\s+projects?|key\\s+projects?)"),
        "education",  Pattern.compile("(?i)(education|degree|university|college|academic\\s+background|qualifications)")
    );

    // ── JD section weight patterns ─────────────────────────────────────────────────
    private static final List<Map.Entry<Pattern, Double>> JD_WEIGHT_RULES = List.of(
        Map.entry(Pattern.compile("(?i)(job\\s+title|position|role):\\s*(.+)"),                          5.0),
        Map.entry(Pattern.compile("(?i)(required|must\\s+have|must-have|requirements?)\\s*:"),           3.0),
        Map.entry(Pattern.compile("(?i)(responsibilities|duties|what\\s+you.ll\\s+do)\\s*:"),           2.0),
        Map.entry(Pattern.compile("(?i)(preferred|nice\\s+to\\s+have|bonus|plus)\\s*:"),                1.0),
        Map.entry(Pattern.compile("(?i)(about\\s+(us|the\\s+company)|company\\s+description)\\s*:"),    0.5)
    );

    // ── Formatting risk patterns ───────────────────────────────────────────────────
    private static final List<Pattern> FORMAT_RISK_PATTERNS = List.of(
        Pattern.compile("(\\|){3,}"),                                        // pipe tables
        Pattern.compile("(?i)(column|col-\\d|grid\\s+layout|multi.?col)"),   // column hints
        Pattern.compile("(?m)^.{200,}$"),                                    // very long lines
        Pattern.compile("(?i)(\\p{So}|\\p{Sm}){3,}")                        // excessive symbols
    );

    private static final List<String> FORMAT_RISK_MESSAGES = List.of(
        "Pipe-based table layout detected — ATS parsers may read columns incorrectly",
        "Multi-column or grid layout keyword detected — ATS may parse in wrong reading order",
        "Very long unbroken lines detected — likely a multi-column format that confuses ATS",
        "Excessive special characters or symbols detected — may corrupt ATS parsing"
    );

    // ── Quantification pattern ─────────────────────────────────────────────────────
    private static final Pattern QUANT_PATTERN = Pattern.compile(
        "\\d+(%|\\+|x|X|k|K|M|\\s?(years?|months?|users?|clients?|million|thousand|percent|team|people|projects?))"
    );

    // ── Skill depth patterns ───────────────────────────────────────────────────────
    private static final Pattern SKILL_YEARS_PATTERN   = Pattern.compile("(?i)(\\d+)\\s*\\+?\\s*years?\\s+(?:of\\s+)?([a-zA-Z+#.]+)");
    private static final Pattern SKILL_EXPERT_PATTERN  = Pattern.compile("(?i)(expert|advanced|extensive|proficient|strong|senior)\\s+(?:in\\s+|with\\s+)?([a-zA-Z+#.]+)");
    private static final Pattern SKILL_BASIC_PATTERN   = Pattern.compile("(?i)(familiar|exposure|knowledge of|basic)\\s+(?:in\\s+|with\\s+)?([a-zA-Z+#.]+)");

    // ── Result DTO ─────────────────────────────────────────────────────────────────
    @Data
    @Builder
    public static class ScoringResult {
        private Map<String, String>  sectionFeedback;
        private List<String>         formattingRisks;
        private Map<String, Integer> skillDepthMap;
        private int                  sectionScore;
        private int                  formattingScore;
        private int                  quantificationScore;
        private int                  keywordOverlapScore;
    }

    // ── Main entry point ──────────────────────────────────────────────────────────
    public ScoringResult score(String resumeText, String jdText) {
        Map<String, String>  sectionFeedback  = detectSections(resumeText);
        List<String>         formattingRisks  = detectFormattingRisks(resumeText);
        Map<String, Integer> skillDepthMap    = detectSkillDepth(resumeText);
        int sectionScore                      = calcSectionScore(sectionFeedback);
        int formattingScore                   = calcFormattingScore(formattingRisks);
        int quantificationScore               = quantificationScore(resumeText);
        int keywordOverlapScore               = weightedKeywordScore(resumeText, jdText);

        log.debug("[ATSScoring] sections={} format={} quant={} keyword={}",
                sectionScore, formattingScore, quantificationScore, keywordOverlapScore);

        return ScoringResult.builder()
                .sectionFeedback(sectionFeedback)
                .formattingRisks(formattingRisks)
                .skillDepthMap(skillDepthMap)
                .sectionScore(sectionScore)
                .formattingScore(formattingScore)
                .quantificationScore(quantificationScore)
                .keywordOverlapScore(keywordOverlapScore)
                .build();
    }

    // ── A. Section Detection ───────────────────────────────────────────────────────
    Map<String, String> detectSections(String text) {
        Map<String, String> result = new LinkedHashMap<>();
        for (Map.Entry<String, Pattern> entry : SECTION_PATTERNS.entrySet()) {
            String  section = entry.getKey();
            Matcher m       = entry.getValue().matcher(text);
            boolean found   = m.find();

            if (!found) {
                result.put(section, "missing");
                continue;
            }

            int    headerIdx    = m.start();
            String afterHeader  = text.substring(Math.min(headerIdx + 20, text.length()));
            int    contentLen   = Math.min(afterHeader.length(), 400);
            String snippet      = afterHeader.substring(0, contentLen).trim();
            result.put(section, snippet.split("\\s+").length < 15 ? "weak" : "present");
        }
        return result;
    }

    // ── B. Formatting Risk Detection ──────────────────────────────────────────────
    List<String> detectFormattingRisks(String text) {
        List<String> risks = new ArrayList<>();
        for (int i = 0; i < FORMAT_RISK_PATTERNS.size(); i++) {
            if (FORMAT_RISK_PATTERNS.get(i).matcher(text).find()) {
                risks.add(FORMAT_RISK_MESSAGES.get(i));
            }
        }
        // Resume length: rough estimate — 500 words ≈ 1 page
        long wordCount = text.split("\\s+").length;
        if (wordCount > 1000) {
            risks.add("Resume appears to exceed 2 pages — consider trimming to keep it concise");
        }
        return risks;
    }

    // ── C. JD Keyword Weighting ───────────────────────────────────────────────────
    Map<String, Double> weightKeywords(String jd) {
        Map<String, Double> weighted = new LinkedHashMap<>();
        String[] lines = jd.split("\\n");
        double currentWeight = 1.0;

        for (String line : lines) {
            // Check if this line changes the active section weight
            for (Map.Entry<Pattern, Double> rule : JD_WEIGHT_RULES) {
                if (rule.getKey().matcher(line).find()) {
                    currentWeight = rule.getValue();
                    break;
                }
            }
            // Tokenize line and assign current weight
            for (String token : tokenizeNormalized(line)) {
                weighted.merge(token, currentWeight, Double::max);
            }
        }
        return weighted;
    }

    // ── D. Weighted Keyword Score ─────────────────────────────────────────────────
    int weightedKeywordScore(String resumeText, String jdText) {
        Set<String>          resumeTokens   = tokenizeNormalized(resumeText);
        Map<String, Double>  jdWeighted     = weightKeywords(jdText);

        if (jdWeighted.isEmpty()) return 0;

        double totalWeight   = jdWeighted.values().stream().mapToDouble(Double::doubleValue).sum();
        double matchedWeight = jdWeighted.entrySet().stream()
                .filter(e -> resumeTokens.contains(e.getKey()))
                .mapToDouble(Map.Entry::getValue)
                .sum();

        return (int) Math.min(100, (matchedWeight / totalWeight) * 100);
    }

    // ── E. Quantification Score ────────────────────────────────────────────────────
    int quantificationScore(String text) {
        long count = QUANT_PATTERN.matcher(text).results().count();
        // 0 → 0, 3 → 50, 6+ → 100
        return (int) Math.min(100, (count / 6.0) * 100);
    }

    // ── F. Skill Depth Detection ──────────────────────────────────────────────────
    Map<String, Integer> detectSkillDepth(String text) {
        Map<String, Integer> depthMap = new LinkedHashMap<>();

        // Expert: "X years of Java"
        Matcher yearsMatcher = SKILL_YEARS_PATTERN.matcher(text);
        while (yearsMatcher.find()) {
            String skill = normalizeSkill(yearsMatcher.group(2));
            depthMap.merge(skill, 3, Integer::max);
        }

        // Intermediate: "proficient in Java"
        Matcher expertMatcher = SKILL_EXPERT_PATTERN.matcher(text);
        while (expertMatcher.find()) {
            String skill = normalizeSkill(expertMatcher.group(2));
            depthMap.merge(skill, 2, Integer::max);
        }

        // Basic: "familiar with Java" (only if not already rated higher)
        Matcher basicMatcher = SKILL_BASIC_PATTERN.matcher(text);
        while (basicMatcher.find()) {
            String skill = normalizeSkill(basicMatcher.group(2));
            depthMap.putIfAbsent(skill, 1);
        }

        return depthMap;
    }

    // ── Score Calculators ─────────────────────────────────────────────────────────
    private int calcSectionScore(Map<String, String> sections) {
        long present = sections.values().stream().filter("present"::equals).count();
        long weak    = sections.values().stream().filter("weak"::equals).count();
        return (int) Math.min(100, (present * 20) + (weak * 10));
    }

    private int calcFormattingScore(List<String> risks) {
        return Math.max(0, 100 - (risks.size() * 20));
    }

    // ── Tokenization helpers ──────────────────────────────────────────────────────
    private Set<String> tokenizeNormalized(String text) {
        if (text == null || text.isBlank()) return Collections.emptySet();
        Set<String> base = Arrays.stream(text.toLowerCase().split("[^a-z0-9+#.]+"))
                .filter(t -> t.length() > 2)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        // Expand synonyms
        Set<String> expanded = new LinkedHashSet<>(base);
        for (Map.Entry<String, List<String>> entry : SYNONYMS.entrySet()) {
            if (base.contains(entry.getKey())) {
                expanded.addAll(entry.getValue());
            }
            for (String syn : entry.getValue()) {
                if (base.contains(syn)) expanded.add(entry.getKey());
            }
        }

        // Apply aliases
        Set<String> aliased = new LinkedHashSet<>();
        for (String token : expanded) {
            aliased.add(SKILL_ALIASES.getOrDefault(token, token));
        }
        return aliased;
    }

    private String normalizeSkill(String raw) {
        String lower = raw.toLowerCase().trim();
        return SKILL_ALIASES.getOrDefault(lower, lower);
    }
}
