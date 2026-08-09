package com.example.mockmate.service;

import com.example.mockmate.model.CategoryKeywordMatch;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
    private static final Map<String, List<String>> SKILL_SYNONYMS = Map.ofEntries(
        Map.entry("java", List.of("java 8", "java 11", "core java", "j2ee")),
        Map.entry("spring boot", List.of("spring", "springboot", "spring mvc", "spring framework")),
        Map.entry("hibernate", List.of("jpa", "spring data jpa", "orm")),
        Map.entry("rest apis", List.of("rest", "restful", "api development", "web services", "microservices")),
        Map.entry("mysql", List.of("sql", "relational database", "rdbms")),
        Map.entry("mongodb", List.of("mongo", "nosql")),
        Map.entry("react", List.of("reactjs", "react.js")),
        Map.entry("node.js", List.of("node", "nodejs", "express.js")),
        Map.entry("aws", List.of("amazon web services", "ec2", "s3")),
        Map.entry("docker", List.of("containerization")),
        Map.entry("kubernetes", List.of("k8s")),
        Map.entry("ci/cd", List.of("jenkins", "github actions", "gitlab ci", "continuous integration")),
        Map.entry("git", List.of("github", "version control", "bitbucket")),
        Map.entry("oop", List.of("object oriented programming", "oops")),
        Map.entry("dsa", List.of("data structures", "algorithms")),
        Map.entry("dbms", List.of("database management"))
    );

    // ── Section detection with extended aliases ────────────────────────────────────
    private static final Map<String, Pattern> SECTION_PATTERNS = Map.of(
        "summary",    Pattern.compile("(?i)(summary|objective|profile|about\\s+me|professional\\s+summary)"),
        "skills",     Pattern.compile("(?i)(skills|technologies|tech\\s+stack|technical\\s+skills|core\\s+competencies|expertise)"),
        "experience", Pattern.compile("(?i)(experience|work\\s+history|employment|work\\s+experience|professional\\s+background|career\\s+history|positions\\s+held)"),
        "projects",   Pattern.compile("(?i)(projects?|portfolio|personal\\s+projects?|key\\s+projects?)"),
        "education",  Pattern.compile("(?i)(education|degree|university|college|academic\\s+background|qualifications)")
    );

    // ── Formatting risk patterns ───────────────────────────────────────────────────
    // "Very long lines" used to be a single-match check against a shared pattern
    // list, which meant one long bullet or a single URL line — very common in
    // legitimately single-column resumes, especially after PDFBox merges wrapped
    // text without newlines — was enough to flag the whole resume as a likely
    // multi-column layout. It's now checked separately and requires several
    // occurrences before it's treated as a real signal (see detectFormattingRisks).
    private static final Pattern LONG_LINE_PATTERN = Pattern.compile("(?m)^.{200,}$");
    private static final int     LONG_LINE_MIN_OCCURRENCES = 3;

    private static final List<Pattern> FORMAT_RISK_PATTERNS = List.of(
        Pattern.compile("(\\|){3,}"),                                        // pipe tables
        Pattern.compile("(?i)(column|col-\\d|grid\\s+layout|multi.?col)"),   // column hints
        Pattern.compile("(?i)(\\p{So}|\\p{Sm}){3,}")                        // excessive symbols
    );

    private static final List<String> FORMAT_RISK_MESSAGES = List.of(
        "Pipe-based table layout detected — ATS parsers may read columns incorrectly",
        "Multi-column or grid layout keyword detected — ATS may parse in wrong reading order",
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

    // ── Hard-truth content-quality patterns ────────────────────────────────────────
    private static final List<String> FILLER_PHRASES = List.of(
        "seamless", "scalable architecture", "user-friendly", "best practices", "robust",
        "dynamic", "innovative", "cutting-edge", "state-of-the-art", "leveraged", "utilized",
        "passionate about", "hardworking", "team player", "detail-oriented", "go-getter",
        "results-driven", "synergy", "proactive"
    );

    private static final Pattern IMPACT_WORD_PATTERN = Pattern.compile(
        "(?i)(reduc|increas|improv|optimi[sz]|boost|cut\\b|sav|grew|enabl|accelerat|eliminat|achiev|resulting|led to)"
    );

    private static final Pattern BULLET_LINE_PATTERN = Pattern.compile("(?m)^\\s*[•\\-\\*✓➤▸►◆▪]\\s+(.+)$");
    private static final Pattern CGPA_PATTERN = Pattern.compile("(?i)\\b(?:cgpa|gpa)\\s*[:\\-]?\\s*(\\d{1,2}(?:\\.\\d{1,2})?)\\s*(?:/\\s*10)?\\b");
    private static final Pattern GITHUB_PATTERN = Pattern.compile("(?i)github\\.com/[\\w.\\-]+");
    private static final Pattern LINKEDIN_PATTERN = Pattern.compile("(?i)linkedin\\.com/in/[\\w\\-]+");
    private static final Pattern ADDRESS_PATTERN = Pattern.compile(
        "(?i)\\baddress\\s*[:\\-]|\\b\\d{6}\\b\\s*(?=.{0,20}(street|road|nagar|colony|sector|near))"
    );
    private static final Pattern PERSONAL_DETAILS_PATTERN = Pattern.compile(
        "(?i)\\b(date of birth|\\bdob\\b|marital status|\\bgender\\b|nationality|father'?s name|religion)\\b"
    );
    private static final Pattern TITLE_UNDER_NAME_PATTERN = Pattern.compile(
        "(?m)^[A-Z][A-Z\\s]{4,30}(DEVELOPER|ENGINEER|PROGRAMMER|ANALYST)\\s*$"
    );
    private static final Pattern INTERNSHIP_PATTERN = Pattern.compile("(?i)\\bintern(ship)?\\b");
    private static final Pattern HACKATHON_PATTERN = Pattern.compile(
        "(?i)\\bhackathon\\b|\\bwinner\\b|1st\\s+prize|\\btop\\s+\\d+\\b|\\branked?\\s+\\d+(st|nd|rd|th)?\\b"
    );
    private static final Pattern CERTIFICATION_PATTERN = Pattern.compile(
        "(?i)\\bcertifi(ed|cation)\\b|\\bcoursera\\b|\\budemy\\b|\\bnptel\\b|\\budacity\\b"
    );
    private static final Pattern PUBLICATION_PATTERN = Pattern.compile(
        "(?i)\\bpublished\\b|\\bpublication\\b|\\bieee\\b|research\\s+paper"
    );
    private static final Pattern YEAR_OF_STUDY_PATTERN = Pattern.compile(
        "(?i)\\b(1st|first|2nd|second|3rd|third|4th|fourth|final)\\s+year\\b"
    );
    private static final Pattern SUSPICIOUS_PRECISE_PERCENT_PATTERN = Pattern.compile("\\b\\d{1,2}\\.\\d%");
    private static final Pattern BASICS_QUALIFIER_PATTERN = Pattern.compile(
        "(?i)\\(\\s*(basic|basics|beginner|beginner level)\\s*\\)"
    );
    private static final Pattern DATE_RANGE_PATTERN = Pattern.compile(
        "(?i)(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s*\\d{4}|\\b(19|20)\\d{2}\\s*[-–—]\\s*(present|(19|20)\\d{2})\\b"
    );
    private static final Pattern ROLE_TITLE_HINT_PATTERN = Pattern.compile(
        "(?i)\\b(developer|engineer|intern|analyst|manager)\\b"
    );

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
        private List<String>         matchedKeywords;
        private List<String>         missingKeywords;
        // NEW fields
        private int                  actionVerbScore;
        private List<CategoryKeywordMatch> categoryKeywords;
        // Hard-truth rebuild: deterministic signals feeding the 7-component score
        private HardTruthSignals     hardTruthSignals;
        private Map<String, Integer> sectionTiers;       // per-section 0-3 quality tier
        private int                  sectionCompletenessScore; // sum of tiers, 0-15
    }

    /**
     * Deterministic signals for the hard-truth scoring engine: content quality
     * (per-bullet), quantified-bullet counts, credibility signals, CGPA, and
     * proxy checks for formatting penalties (GitHub/LinkedIn/address/personal
     * details/title-under-name). These feed ATSReportBuilder's 7-component
     * score and HonestReportValidator's sanity checks.
     *
     * Some checks (missing dates/role title per experience entry, skill-with-
     * no-evidence) are resume-wide approximations rather than true per-entry
     * parsing, since this layer works on raw extracted text, not a structured
     * resume model. They're intentionally conservative (yes/no, not counted
     * per entry) rather than fabricating precision we don't have.
     */
    @Data
    @Builder
    public static class HardTruthSignals {
        private Double  cgpa;
        private boolean hasGithub;
        private boolean hasLinkedin;
        private boolean hasAddress;
        private boolean hasPersonalDetails;
        private boolean hasTitleUnderName;
        private boolean hasInternship;
        private boolean experienceMissingDates;
        private boolean experienceMissingTitle;
        private boolean projectsMissingTechStack;
        private String  yearOfStudy; // e.g. "3rd year", "final year", or null

        private int          contentQualityScore; // 0-25, already normalized
        private int          quantifiedBulletCount;
        private int          fillerPhraseCount;
        private List<String> fillerPhrasesFound;
        private List<BulletSignal> bulletSignals;

        private int          credibilityScore; // 0-5, net of positive/negative
        private boolean       hasHackathonMention;
        private boolean       hasCertificationMention;
        private boolean       hasPublicationMention;
        private List<String> unsupportedSkills; // listed but no evidence elsewhere
        private int          suspiciousPreciseMetricCount;

        private boolean hasStrongProject; // proxy: 2+ quantified bullets or a hackathon mention
    }

    @Data
    @Builder
    public static class BulletSignal {
        private String section;
        private String text;
        private int    qualityScore; // 0-100
        private List<String> issues;
    }

    // ── Main entry point ──────────────────────────────────────────────────────────
    public ScoringResult score(String resumeText, String jdText) {
        Map<String, String>  sectionFeedback  = detectSections(resumeText);
        List<String>         formattingRisks  = detectFormattingRisks(resumeText);
        Map<String, Integer> skillDepthMap    = detectSkillDepth(resumeText);
        int sectionScore                      = calcSectionScore(sectionFeedback);
        int formattingScore                   = calcFormattingScore(formattingRisks);
        int quantificationScore               = calculateQuantificationScore(resumeText);
        int keywordOverlapScore               = calculateKeywordScore(resumeText, jdText);
        List<String> matchedKeywords          = getMatchedKeywords(resumeText, jdText);
        List<String> missingKeywords          = getMissingKeywords(resumeText, jdText);
        int actionVerbScore                   = calculateActionVerbScore(resumeText);
        List<CategoryKeywordMatch> catKeywords = buildCategoryKeywords(resumeText, jdText);
        HardTruthSignals hardTruthSignals      = computeHardTruthSignals(resumeText);
        Map<String, Integer> sectionTiers       = computeSectionTiers(resumeText, matchedKeywords, missingKeywords);
        int sectionCompletenessScore            = sectionTiers.values().stream().mapToInt(Integer::intValue).sum();

        log.info("[ATSScoring] sections={} format={} quant={} keyword={} actionVerb={} contentQuality={} cgpa={} sectionCompleteness={}",
                sectionScore, formattingScore, quantificationScore, keywordOverlapScore, actionVerbScore,
                hardTruthSignals.getContentQualityScore(), hardTruthSignals.getCgpa(), sectionCompletenessScore);

        return ScoringResult.builder()
                .sectionFeedback(sectionFeedback)
                .formattingRisks(formattingRisks)
                .skillDepthMap(skillDepthMap)
                .sectionScore(sectionScore)
                .formattingScore(formattingScore)
                .quantificationScore(quantificationScore)
                .keywordOverlapScore(keywordOverlapScore)
                .matchedKeywords(matchedKeywords)
                .missingKeywords(missingKeywords)
                .actionVerbScore(actionVerbScore)
                .categoryKeywords(catKeywords)
                .hardTruthSignals(hardTruthSignals)
                .sectionTiers(sectionTiers)
                .sectionCompletenessScore(sectionCompletenessScore)
                .build();
    }

    // ── A. Section Detection ───────────────────────────────────────────────────────
    Map<String, String> detectSections(String text) {
        Map<String, String> result = new LinkedHashMap<>();
        String lower = text.toLowerCase();

        for (Map.Entry<String, Pattern> entry : SECTION_PATTERNS.entrySet()) {
            String section = entry.getKey();
            Matcher m = entry.getValue().matcher(text);

            if (m.find()) {
                int headerIdx = m.start();
                String afterHeader = text.substring(Math.min(headerIdx + 20, text.length()));
                int contentLen = Math.min(afterHeader.length(), 400);
                String snippet = afterHeader.substring(0, contentLen).trim();
                result.put(section, snippet.split("\\s+").length < 10 ? "weak" : "present");
            } else {
                result.put(section, "missing");
            }
        }

        // SEMANTIC FALLBACKS
        if ("missing".equals(result.get("summary"))) {
            if (lower.contains("passionate") || lower.contains("enthusiast") || lower.contains("seeking")) {
                result.put("summary", "present");
            }
        }

        if ("missing".equals(result.get("skills"))) {
            boolean hasSkillContent = SKILL_SYNONYMS.keySet().stream()
                .filter(k -> List.of("java", "spring boot", "rest apis", "mysql", "git").contains(k))
                .anyMatch(lower::contains);
            if (hasSkillContent) result.put("skills", "present");
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

        long longLineCount = LONG_LINE_PATTERN.matcher(text).results().count();
        if (longLineCount >= LONG_LINE_MIN_OCCURRENCES) {
            risks.add("Very long unbroken lines detected — likely a multi-column format that confuses ATS");
        }

        // Resume length: rough estimate — 500 words ≈ 1 page
        long wordCount = text.split("\\s+").length;
        if (wordCount > 1000) {
            risks.add("Resume appears to exceed 2 pages — consider trimming to keep it concise");
        }
        return risks;
    }

    // ── C. Keyword Score and Methods ──────────────────────────────────────────────

    // The full keyword universe used for JD/resume matching. Previously this was
    // just SKILL_SYNONYMS.keySet() (~16 Java/Spring-centric terms), which meant a
    // JD for a Python/DevOps/frontend role that never happened to use one of those
    // 16 exact words would match ZERO keywords. We now also pull in every keyword
    // from ATSRulesLibrary.JD_KEYWORD_CATEGORIES (~60 terms across languages,
    // frameworks, databases, cloud/devops, frontend, testing, CS fundamentals),
    // which previously was only used for the informational category breakdown and
    // never fed the actual keywordOverlapScore.
    private static final Set<String> ALL_KNOWN_KEYWORDS = buildAllKnownKeywords();

    private static Set<String> buildAllKnownKeywords() {
        Set<String> all = new LinkedHashSet<>(SKILL_SYNONYMS.keySet());
        ATSRulesLibrary.JD_KEYWORD_CATEGORIES.values().forEach(all::addAll);
        return all;
    }

    private String normalizeTerm(String term) {
        String lower = term.toLowerCase().trim();
        for (Map.Entry<String, List<String>> entry : SKILL_SYNONYMS.entrySet()) {
            if (entry.getKey().equals(lower) || entry.getValue().contains(lower)) {
                return entry.getKey();
            }
        }
        return lower;
    }

    private boolean resumeContainsKeyword(String resumeTextLower, String keyword) {
        if (resumeTextLower.contains(keyword)) return true;
        List<String> synonyms = SKILL_SYNONYMS.getOrDefault(keyword, List.of());
        return synonyms.stream().anyMatch(resumeTextLower::contains);
    }

    private Set<String> extractJDKeywords(String jdText) {
        String jdLower = jdText.toLowerCase();
        Set<String> found = new LinkedHashSet<>();
        for (String keyword : ALL_KNOWN_KEYWORDS) {
            if (resumeContainsKeyword(jdLower, keyword)) found.add(keyword);
        }
        return found;
    }

    int calculateKeywordScore(String resumeText, String jdText) {
        Set<String> jdKeywords = extractJDKeywords(jdText);
        if (jdKeywords.isEmpty()) {
            // No recognized keywords in the JD at all — this used to silently
            // return 100 (a "perfect" score with zero real analysis behind it).
            // Return a neutral score instead so an unrecognized/unusual JD
            // doesn't masquerade as a flawless keyword match.
            log.warn("[ATSScoring] No known keywords detected in JD — returning neutral keyword score");
            return 50;
        }
        String resumeLower = resumeText.toLowerCase();
        long matchCount = jdKeywords.stream()
            .filter(kw -> resumeContainsKeyword(resumeLower, kw))
            .count();
        return (int) Math.min(100, ((double) matchCount / jdKeywords.size()) * 100);
    }

    List<String> getMatchedKeywords(String resumeText, String jdText) {
        Set<String> jdKeywords = extractJDKeywords(jdText);
        String resumeLower = resumeText.toLowerCase();
        return jdKeywords.stream()
            .filter(kw -> resumeContainsKeyword(resumeLower, kw))
            .toList();
    }

    List<String> getMissingKeywords(String resumeText, String jdText) {
        Set<String> jdKeywords = extractJDKeywords(jdText);
        String resumeLower = resumeText.toLowerCase();
        return jdKeywords.stream()
            .filter(kw -> !resumeContainsKeyword(resumeLower, kw))
            .toList();
    }

    // ── D. Category Keyword Matching (NEW) ────────────────────────────────────────
    List<CategoryKeywordMatch> buildCategoryKeywords(String resumeText, String jdText) {
        String resumeLower = resumeText != null ? resumeText.toLowerCase() : "";
        String jdLower     = jdText     != null ? jdText.toLowerCase()     : "";
        List<CategoryKeywordMatch> results = new ArrayList<>();

        for (Map.Entry<String, List<String>> catEntry : ATSRulesLibrary.JD_KEYWORD_CATEGORIES.entrySet()) {
            String category  = catEntry.getKey();
            List<String> all = catEntry.getValue();

            // Only look at keywords that are actually mentioned in the JD
            List<String> inJD = all.stream()
                .filter(kw -> jdLower.contains(kw))
                .toList();

            if (inJD.isEmpty()) continue; // this category is irrelevant for this JD

            List<String> matched = inJD.stream()
                .filter(kw -> resumeContainsKeyword(resumeLower, kw))
                .toList();
            List<String> missing = inJD.stream()
                .filter(kw -> !resumeContainsKeyword(resumeLower, kw))
                .toList();

            int coverage = inJD.isEmpty() ? 0 : (int) Math.round((matched.size() * 100.0) / inJD.size());
            String importance = ATSRulesLibrary.CATEGORY_IMPORTANCE.getOrDefault(category, "Important");

            log.debug("[ATSScoring] Category={} matched={}/{} coverage={}%", category, matched.size(), inJD.size(), coverage);

            results.add(CategoryKeywordMatch.builder()
                .category(category)
                .matchedCount(matched.size())
                .totalInJD(inJD.size())
                .coveragePercent(coverage)
                .importance(importance)
                .matchedKeywords(matched)
                .missingKeywords(missing)
                .build());
        }

        // Sort by importance (Critical first), then by coverage ascending (worst first)
        results.sort(Comparator.comparingInt((CategoryKeywordMatch c) -> importanceOrder(c.getImportance()))
            .thenComparingInt(CategoryKeywordMatch::getCoveragePercent));

        return results;
    }

    private int importanceOrder(String importance) {
        return switch (importance) {
            case "Critical"     -> 0;
            case "Important"    -> 1;
            case "Nice-to-have" -> 2;
            default             -> 3;
        };
    }

    // ── E. Quantification Score ────────────────────────────────────────────────────
    private static final Pattern RAW_NUMBER_PATTERN = Pattern.compile("\\b\\d{2,5}\\b");

    int calculateQuantificationScore(String text) {
        int score = 0;
        if (text.contains("%")) score += 30;
        if (Pattern.compile("(?i)(1st|2nd|3rd|\\d+th|first|second|top\\s+\\d+)").matcher(text).find()) score += 20;
        if (Pattern.compile("(?i)(team\\s+of\\s+\\d+|\\d+\\+\\s+members)").matcher(text).find()) score += 20;
        if (Pattern.compile("(?i)(national|state|global|university\\s+level)").matcher(text).find()) score += 10;

        // Bare numbers are a weak signal on their own — a graduation year ("2023"),
        // a PIN code, or a phone-number fragment matches just as well as a real
        // impact metric ("50 users", "3 projects"). Excluding plausible years
        // (1950-2099) removes the single most common false-positive source.
        long rawNumbers = RAW_NUMBER_PATTERN.matcher(text).results()
            .map(java.util.regex.MatchResult::group)
            .filter(n -> {
                int val = Integer.parseInt(n);
                boolean looksLikeYear = n.length() == 4 && val >= 1950 && val <= 2099;
                return !looksLikeYear;
            })
            .count();
        score += Math.min(20, rawNumbers * 5);

        return Math.min(100, score);
    }

    // ── F. Action Verb Score (NEW) ─────────────────────────────────────────────────
    int calculateActionVerbScore(String text) {
        Set<String> strongVerbs = ATSRulesLibrary.ACTION_VERBS;
        Matcher m = Pattern.compile("(?m)^\\s*[•\\-\\*✓➤▸►◆▪]\\s+(.+)$").matcher(text);
        int total = 0, strong = 0;

        while (m.find()) {
            total++;
            String firstWord = m.group(1).trim().split("\\s+")[0].toLowerCase().replaceAll("[^a-z]", "");
            if (strongVerbs.contains(firstWord)) strong++;
        }

        if (total == 0) return 50; // no bullets = neutral
        int score = (int) Math.min(100, (strong * 100.0 / total));
        log.debug("[ATSScoring] actionVerbScore={} ({}/{} bullets)", score, strong, total);
        return score;
    }

    // ── G. Skill Depth Detection ──────────────────────────────────────────────
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

    // ── Score Calculators ─────────────────────────────────────────────────────
    private int calcSectionScore(Map<String, String> sections) {
        long present = sections.values().stream().filter("present"::equals).count();
        long weak    = sections.values().stream().filter("weak"::equals).count();
        return (int) Math.min(100, (present * 20) + (weak * 10));
    }

    private int calcFormattingScore(List<String> risks) {
        return Math.max(0, 100 - (risks.size() * 20));
    }

    // ── Tokenization helpers ──────────────────────────────────────────────────

    private String normalizeSkill(String raw) {
        String lower = raw.toLowerCase().trim();
        return SKILL_ALIASES.getOrDefault(lower, lower);
    }

    // ── H. Hard-Truth Signals ───────────────────────────────────────────────────
    HardTruthSignals computeHardTruthSignals(String text) {
        String lower = text.toLowerCase();

        Double cgpa = detectCgpa(text);
        boolean hasGithub = GITHUB_PATTERN.matcher(text).find();
        boolean hasLinkedin = LINKEDIN_PATTERN.matcher(text).find();
        boolean hasAddress = ADDRESS_PATTERN.matcher(text).find();
        boolean hasPersonalDetails = PERSONAL_DETAILS_PATTERN.matcher(text).find();
        boolean hasTitleUnderName = TITLE_UNDER_NAME_PATTERN.matcher(
                text.length() > 300 ? text.substring(0, 300) : text).find();
        boolean hasInternship = INTERNSHIP_PATTERN.matcher(text).find();
        boolean hasHackathon = HACKATHON_PATTERN.matcher(text).find();
        boolean hasCertification = CERTIFICATION_PATTERN.matcher(text).find();
        boolean hasPublication = PUBLICATION_PATTERN.matcher(text).find();

        String yearOfStudy = null;
        Matcher yearMatcher = YEAR_OF_STUDY_PATTERN.matcher(text);
        if (yearMatcher.find()) yearOfStudy = yearMatcher.group(0);

        // Experience section: resume-wide proxy, not true per-entry parsing —
        // grabs the snippet after the "experience" header and checks whether a
        // date range or role-title-like word appears anywhere in it.
        boolean[] experienceSignals = checkExperienceMissingSignals(text);
        boolean experienceMissingDates = experienceSignals[0];
        boolean experienceMissingTitle = experienceSignals[1];
        boolean projectsMissingTechStack = checkProjectsMissingTechStack(text, lower);

        // ── Bullet-level content quality ───────────────────────────────────
        List<String> bullets = extractBullets(text);
        List<BulletSignal> bulletSignals = new ArrayList<>();
        int quantifiedBulletCount = 0;
        for (String bullet : bullets) {
            BulletSignal signal = scoreBullet(bullet);
            bulletSignals.add(signal);
            if (QUANT_PATTERN.matcher(bullet).find()) quantifiedBulletCount++;
        }

        int fillerPhraseCount = 0;
        List<String> fillerPhrasesFound = new ArrayList<>();
        for (String phrase : FILLER_PHRASES) {
            if (lower.contains(phrase)) {
                fillerPhrasesFound.add(phrase);
                // count occurrences, not just presence, since repeated filler is worse
                int idx = 0;
                while ((idx = lower.indexOf(phrase, idx)) != -1) {
                    fillerPhraseCount++;
                    idx += phrase.length();
                }
            }
        }

        int contentQualityScore = computeContentQualityScore(bulletSignals, fillerPhraseCount);

        // ── Credibility ─────────────────────────────────────────────────────
        int positiveSignals = 0;
        if (hasGithub) positiveSignals++;
        if (hasLinkedin) positiveSignals++;
        if (hasHackathon) positiveSignals++;
        if (hasCertification) positiveSignals++;
        if (hasPublication) positiveSignals++;

        int suspiciousPreciseMetricCount = (int) SUSPICIOUS_PRECISE_PERCENT_PATTERN.matcher(text).results().count();
        List<String> unsupportedSkills = findUnsupportedSkills(text, lower);
        int basicsQualifierCount = (int) BASICS_QUALIFIER_PATTERN.matcher(text).results().count();

        int negativeSignals = Math.min(3, suspiciousPreciseMetricCount)
                + Math.min(3, unsupportedSkills.size())
                + Math.min(2, basicsQualifierCount);

        int credibilityScore = Math.max(0, Math.min(5, positiveSignals - negativeSignals));

        boolean hasStrongProject = quantifiedBulletCount >= 2 || hasHackathon;

        return HardTruthSignals.builder()
                .cgpa(cgpa)
                .hasGithub(hasGithub)
                .hasLinkedin(hasLinkedin)
                .hasAddress(hasAddress)
                .hasPersonalDetails(hasPersonalDetails)
                .hasTitleUnderName(hasTitleUnderName)
                .hasInternship(hasInternship)
                .experienceMissingDates(experienceMissingDates)
                .experienceMissingTitle(experienceMissingTitle)
                .projectsMissingTechStack(projectsMissingTechStack)
                .yearOfStudy(yearOfStudy)
                .contentQualityScore(contentQualityScore)
                .quantifiedBulletCount(quantifiedBulletCount)
                .fillerPhraseCount(fillerPhraseCount)
                .fillerPhrasesFound(fillerPhrasesFound)
                .bulletSignals(bulletSignals)
                .credibilityScore(credibilityScore)
                .hasHackathonMention(hasHackathon)
                .hasCertificationMention(hasCertification)
                .hasPublicationMention(hasPublication)
                .unsupportedSkills(unsupportedSkills)
                .suspiciousPreciseMetricCount(suspiciousPreciseMetricCount)
                .hasStrongProject(hasStrongProject)
                .build();
    }

    private Double detectCgpa(String text) {
        Matcher m = CGPA_PATTERN.matcher(text);
        if (m.find()) {
            try {
                double val = Double.parseDouble(m.group(1));
                if (val <= 10.0) return val;
            } catch (NumberFormatException ignored) { /* fall through */ }
        }
        return null;
    }

    private List<String> extractBullets(String text) {
        List<String> bullets = new ArrayList<>();
        Matcher m = BULLET_LINE_PATTERN.matcher(text);
        while (m.find()) bullets.add(m.group(1).trim());
        return bullets;
    }

    /**
     * Per-bullet quality score against the 6-criteria rubric: strong action
     * verb (+1), specific metric (+2), named technology (+1), filler-free
     * (+1), describes what was done (+1, proxied by bullet length), describes
     * impact/result (+2). Max 8, scaled to 0-100 for display.
     */
    private BulletSignal scoreBullet(String bullet) {
        String lower = bullet.toLowerCase();
        List<String> issues = new ArrayList<>();
        int points = 0;

        String firstWord = bullet.trim().split("\\s+")[0].toLowerCase().replaceAll("[^a-z]", "");
        if (ATSRulesLibrary.ACTION_VERBS.contains(firstWord)) {
            points += 1;
        } else {
            issues.add("Doesn't open with a strong action verb");
        }

        if (QUANT_PATTERN.matcher(bullet).find()) {
            points += 2;
        } else {
            issues.add("No specific metric or number");
        }

        boolean mentionsTech = ALL_KNOWN_KEYWORDS.stream().anyMatch(lower::contains);
        if (mentionsTech) {
            points += 1;
        } else {
            issues.add("Doesn't name a specific technology");
        }

        boolean hasFiller = FILLER_PHRASES.stream().anyMatch(lower::contains);
        if (!hasFiller) {
            points += 1;
        } else {
            issues.add("Contains filler/buzzword language");
        }

        if (bullet.trim().split("\\s+").length >= 6) {
            points += 1;
        } else {
            issues.add("Too short to describe what was actually built/done");
        }

        if (IMPACT_WORD_PATTERN.matcher(bullet).find()) {
            points += 2;
        } else {
            issues.add("Doesn't describe the impact or result");
        }

        int qualityScore = (int) Math.round(points * 100.0 / 8.0);
        return BulletSignal.builder()
                .text(bullet)
                .qualityScore(qualityScore)
                .issues(issues)
                .build();
    }

    private int computeContentQualityScore(List<BulletSignal> bulletSignals, int fillerPhraseCount) {
        if (bulletSignals.isEmpty()) {
            // No bullets to assess — treat as below-average rather than giving
            // free credit for "nothing to penalize".
            return 10;
        }
        double avgQuality = bulletSignals.stream().mapToInt(BulletSignal::getQualityScore).average().orElse(0);
        double normalized = (avgQuality / 100.0) * 25.0;
        double penalized = normalized - (fillerPhraseCount * 0.5);
        return (int) Math.round(Math.max(0, Math.min(25, penalized)));
    }

    /** Returns [missingDates, missingTitle]. Both false if there's no experience
     *  section at all — that's a section-completeness concern, not a formatting one. */
    private boolean[] checkExperienceMissingSignals(String text) {
        Matcher header = SECTION_PATTERNS.get("experience").matcher(text);
        if (!header.find()) return new boolean[]{false, false};
        int start = Math.min(header.start() + 10, text.length());
        int end = Math.min(start + 600, text.length());
        String snippet = text.substring(start, end);
        boolean hasDate = DATE_RANGE_PATTERN.matcher(snippet).find();
        boolean hasTitleHint = ROLE_TITLE_HINT_PATTERN.matcher(snippet).find();
        return new boolean[]{!hasDate, !hasTitleHint};
    }

    private boolean checkProjectsMissingTechStack(String text, String lower) {
        Matcher header = SECTION_PATTERNS.get("projects").matcher(text);
        if (!header.find()) return false; // no projects section — section completeness handles that
        int start = Math.min(header.start() + 10, text.length());
        int end = Math.min(start + 800, text.length());
        String snippet = text.substring(start, end).toLowerCase();
        boolean mentionsTech = ALL_KNOWN_KEYWORDS.stream().anyMatch(snippet::contains);
        return !mentionsTech;
    }

    /**
     * A skill counts as "unsupported" if it's mentioned in the skills-section
     * snippet but nowhere else in the resume (no project/experience bullet
     * ever uses it) — a real, if approximate, proxy for "listed with zero
     * project evidence".
     */
    private List<String> findUnsupportedSkills(String text, String lower) {
        Matcher header = SECTION_PATTERNS.get("skills").matcher(text);
        if (!header.find()) return List.of();
        int start = Math.min(header.start() + 10, text.length());
        int end = Math.min(start + 400, text.length());
        String skillsSnippet = lower.substring(start, end);
        String restOfDoc = lower.substring(0, start) + lower.substring(end);

        List<String> unsupported = new ArrayList<>();
        for (String keyword : ALL_KNOWN_KEYWORDS) {
            if (skillsSnippet.contains(keyword) && !restOfDoc.contains(keyword)) {
                unsupported.add(keyword);
                if (unsupported.size() >= 5) break;
            }
        }
        return unsupported;
    }

    // ── I. Section Completeness Tiers (0-3 per section, quality-aware) ────────────
    // Presence alone used to be worth full credit (a one-line "Education" header
    // scored the same as a detailed one). Each section now gets a 0-3 tier based
    // on actual content quality, not just whether the header was found.
    private static final Pattern SKILLS_CATEGORY_PATTERN = Pattern.compile(
        "(?i)\\b(languages|frameworks|tools|databases|libraries|technologies)\\s*:"
    );
    private static final Pattern GENERIC_SUMMARY_PATTERN = Pattern.compile(
        "(?i)\\b(seeking|looking for|opportunity to|passionate about)\\b"
    );
    private static final Pattern PROJECT_URL_PATTERN = Pattern.compile(
        "(?i)github\\.com/|github\\.io|vercel\\.app|netlify\\.app|\\bhttps?://"
    );
    private static final Pattern COURSEWORK_PATTERN = Pattern.compile(
        "(?i)relevant\\s+coursework|relevant\\s+courses|\\bsubjects\\b"
    );

    Map<String, Integer> computeSectionTiers(String text, List<String> matchedKeywords, List<String> missingKeywords) {
        Map<String, Integer> tiers = new LinkedHashMap<>();
        tiers.put("summary", tierSummary(text));
        tiers.put("skills", tierSkills(text, matchedKeywords, missingKeywords));
        tiers.put("experience", tierExperience(text));
        tiers.put("projects", tierProjects(text));
        tiers.put("education", tierEducation(text));
        return tiers;
    }

    private String snippetAfter(String text, Pattern headerPattern, int maxLen) {
        Matcher m = headerPattern.matcher(text);
        if (!m.find()) return null;
        int start = Math.min(m.start() + 10, text.length());
        int end = Math.min(start + maxLen, text.length());
        return text.substring(start, end);
    }

    private int tierSummary(String text) {
        String snippet = snippetAfter(text, SECTION_PATTERNS.get("summary"), 250);
        if (snippet == null) return 0;
        if (GENERIC_SUMMARY_PATTERN.matcher(snippet).find()) return 1;
        boolean mentionsTech = ALL_KNOWN_KEYWORDS.stream().anyMatch(snippet.toLowerCase()::contains);
        if (mentionsTech && snippet.split("\\s+").length >= 12) return 3;
        return 2;
    }

    private int tierSkills(String text, List<String> matchedKeywords, List<String> missingKeywords) {
        String snippet = snippetAfter(text, SECTION_PATTERNS.get("skills"), 350);
        if (snippet == null) return 0;
        boolean categorized = SKILLS_CATEGORY_PATTERN.matcher(snippet).find();
        if (!categorized) return 1;
        int matched = matchedKeywords != null ? matchedKeywords.size() : 0;
        int missing  = missingKeywords != null ? missingKeywords.size() : 0;
        boolean missingKeyJdSkills = (matched + missing) > 0 && missing > matched;
        return missingKeyJdSkills ? 2 : 3;
    }

    private int tierExperience(String text) {
        String snippet = snippetAfter(text, SECTION_PATTERNS.get("experience"), 600);
        if (snippet == null) return 0;
        boolean hasDate = DATE_RANGE_PATTERN.matcher(snippet).find();
        boolean hasTitle = ROLE_TITLE_HINT_PATTERN.matcher(snippet).find();
        if (!hasDate || !hasTitle) return 1;
        boolean hasMetrics = QUANT_PATTERN.matcher(snippet).find();
        return hasMetrics ? 3 : 2;
    }

    private int tierProjects(String text) {
        String snippet = snippetAfter(text, SECTION_PATTERNS.get("projects"), 800);
        if (snippet == null) return 0;
        boolean hasTechStack = ALL_KNOWN_KEYWORDS.stream().anyMatch(snippet.toLowerCase()::contains);
        if (!hasTechStack) return 1;
        boolean hasMetrics = QUANT_PATTERN.matcher(snippet).find();
        boolean hasUrl = PROJECT_URL_PATTERN.matcher(snippet).find();
        if (hasMetrics && hasUrl) return 3;
        return 2;
    }

    private int tierEducation(String text) {
        String snippet = snippetAfter(text, SECTION_PATTERNS.get("education"), 350);
        if (snippet == null) return 0;
        boolean hasCgpa = CGPA_PATTERN.matcher(snippet).find();
        boolean hasCoursework = COURSEWORK_PATTERN.matcher(snippet).find();
        return (hasCgpa && hasCoursework) ? 3 : 2;
    }
}
