package com.example.mockmate.service;

import com.example.mockmate.model.ATSParserPreview;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Computes additional deterministic scores not covered by ATSScoringService:
 *   – actionVerbScore
 *   – ATSParserPreview
 *
 * ConsistencyScore is handled by ConsistencyCheckerService.
 * No Groq calls are made here.
 */
@Slf4j
@Service
public class EnhancedScoringService {

    // ── Strong action verbs ──────────────────────────────────────────────────
    private static final Set<String> STRONG_VERBS = Set.of(
        "built", "engineered", "designed", "developed", "implemented", "architected",
        "optimized", "led", "delivered", "created", "spearheaded", "launched",
        "automated", "integrated", "reduced", "increased", "achieved", "ranked",
        "coordinated", "managed", "deployed", "streamlined", "drove", "established",
        "improved", "constructed", "migrated", "refactored", "scaled", "shipped",
        "published", "secured", "mentored", "trained", "founded", "directed"
    );

    // ── ATS buzzwords to flag ────────────────────────────────────────────────
    private static final List<String> BUZZWORDS = List.of(
        "synergy", "leverage", "dynamic", "passionate", "results-driven",
        "detail-oriented", "team player", "hardworking", "proactive",
        "go-getter", "self-starter", "thought leader", "guru", "ninja",
        "wizard", "rockstar", "innovative", "cutting-edge"
    );

    // ── Parser patterns ──────────────────────────────────────────────────────
    private static final Pattern EMAIL_PATTERN  = Pattern.compile(
        "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}");
    private static final Pattern PHONE_PATTERN  = Pattern.compile(
        "(?:\\+?91[\\s\\-]?)?[6-9]\\d{9}|(?:\\+?1[\\s\\-]?)?\\(?\\d{3}\\)?[\\s\\-]?\\d{3}[\\s\\-]?\\d{4}");
    private static final Pattern GITHUB_PATTERN = Pattern.compile(
        "(?i)github\\.com/([a-zA-Z0-9\\-]+)");
    private static final Pattern LINKEDIN_PATTERN = Pattern.compile(
        "(?i)linkedin\\.com/in/([a-zA-Z0-9\\-]+)");
    private static final Pattern LOCATION_PATTERN = Pattern.compile(
        "(?i)\\b(bangalore|bengaluru|mumbai|delhi|hyderabad|pune|chennai|kolkata|noida|gurugram|india|remote)\\b");

    // Bullet start pattern
    private static final Pattern BULLET_PATTERN = Pattern.compile(
        "(?m)^\\s*[•\\-\\*✓➤▸►◆▪]\\s+(.+)$");

    // ── A. Action Verb Score ──────────────────────────────────────────────────
    /**
     * Returns 0–100.
     * score = (bullets starting with strong verb / total bullets) * 100
     */
    public int computeActionVerbScore(String resumeText) {
        if (resumeText == null || resumeText.isBlank()) return 0;

        Matcher m = BULLET_PATTERN.matcher(resumeText);
        int totalBullets = 0;
        int strongVerbBullets = 0;

        while (m.find()) {
            totalBullets++;
            String bulletContent = m.group(1).trim();
            String firstWord = bulletContent.split("\\s+")[0].toLowerCase().replaceAll("[^a-z]", "");
            if (STRONG_VERBS.contains(firstWord)) {
                strongVerbBullets++;
            }
        }

        if (totalBullets == 0) {
            // No bullets found — check for lines that start with strong verbs (inline format)
            long verbLines = Arrays.stream(resumeText.split("\\n"))
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .filter(line -> {
                    String first = line.split("\\s+")[0].toLowerCase().replaceAll("[^a-z]", "");
                    return STRONG_VERBS.contains(first);
                })
                .count();
            long totalLines = Arrays.stream(resumeText.split("\\n"))
                .filter(line -> !line.trim().isBlank()).count();
            int score = totalLines > 0 ? (int) Math.min(100, (verbLines * 100.0 / totalLines)) : 0;
            log.info("[EnhancedScoring] actionVerbScore (no bullets)={}", score);
            return score;
        }

        int score = (int) Math.min(100, (strongVerbBullets * 100.0 / totalBullets));
        log.info("[EnhancedScoring] actionVerbScore={} ({}/{} bullets)", score, strongVerbBullets, totalBullets);
        return score;
    }

    // ── B. ATS Parser Preview ─────────────────────────────────────────────────
    public ATSParserPreview computeParserPreview(String resumeText, List<String> matchedKeywords) {
        if (resumeText == null || resumeText.isBlank()) {
            return ATSParserPreview.builder()
                .detectedName("NOT DETECTED ⚠️")
                .detectedEmail("NOT DETECTED ⚠️")
                .detectedPhone("NOT DETECTED ⚠️")
                .detectedLocation("NOT DETECTED")
                .detectedGithub("NOT DETECTED ⚠️")
                .detectedLinkedin("NOT DETECTED")
                .detectedSkills(List.of())
                .detectedExperience(List.of())
                .detectedProjects(List.of())
                .detectedEducation("NOT DETECTED")
                .totalKeywordsDetected(0)
                .parsingWarnings(List.of())
                .build();
        }

        String email    = extractFirst(EMAIL_PATTERN, resumeText);
        String phone    = extractFirst(PHONE_PATTERN, resumeText);
        String github   = extractFirst(GITHUB_PATTERN, resumeText);
        String linkedin = extractFirst(LINKEDIN_PATTERN, resumeText);
        String location = extractFirst(LOCATION_PATTERN, resumeText);

        // Name: heuristic — first non-empty, non-all-caps, non-keyword line that's 2-4 words
        String name = detectName(resumeText);

        // Education: look for degree/university mentions
        String education = detectEducation(resumeText);

        // Projects: look for project-header lines
        List<String> projects = detectProjectNames(resumeText);

        // Experience: look for company + role lines
        List<String> experience = detectExperienceEntries(resumeText);

        // Parsing warnings
        List<String> warnings = buildParsingWarnings(resumeText, email, phone, github);

        ATSParserPreview preview = ATSParserPreview.builder()
            .detectedName(name != null ? name : "NOT DETECTED ⚠️")
            .detectedEmail(email != null ? email : "NOT DETECTED ⚠️")
            .detectedPhone(phone != null ? phone : "NOT DETECTED ⚠️")
            .detectedLocation(location != null ? location : "NOT DETECTED")
            .detectedGithub(github != null ? "github.com/" + github : "NOT DETECTED ⚠️")
            .detectedLinkedin(linkedin != null ? "linkedin.com/in/" + linkedin : "NOT DETECTED")
            .detectedSkills(matchedKeywords != null ? matchedKeywords : List.of())
            .detectedExperience(experience)
            .detectedProjects(projects)
            .detectedEducation(education != null ? education : "NOT DETECTED")
            .totalKeywordsDetected(matchedKeywords != null ? matchedKeywords.size() : 0)
            .parsingWarnings(warnings)
            .build();

        log.info("[EnhancedScoring] parserPreview: name={}, email={}, github={}, warnings={}",
            preview.getDetectedName(), email != null ? "found" : "missing",
            github != null ? "found" : "missing", warnings.size());

        return preview;
    }

    // ── Buzzword Detection ────────────────────────────────────────────────────
    public List<String> detectBuzzwords(String resumeText) {
        if (resumeText == null || resumeText.isBlank()) return List.of();
        String lower = resumeText.toLowerCase();
        return BUZZWORDS.stream()
            .filter(lower::contains)
            .toList();
    }

    // ── Passive Voice Detection ───────────────────────────────────────────────
    public List<String> detectPassiveVoice(String resumeText) {
        if (resumeText == null || resumeText.isBlank()) return List.of();
        Pattern passive = Pattern.compile("(?i)\\b(was|were|is|are|been|being)\\s+[a-z]+ed\\b");
        Matcher m = passive.matcher(resumeText);
        List<String> instances = new ArrayList<>();
        while (m.find() && instances.size() < 5) {
            // Extract the surrounding context (up to 60 chars)
            int start = Math.max(0, m.start() - 10);
            int end   = Math.min(resumeText.length(), m.end() + 20);
            instances.add(resumeText.substring(start, end).trim());
        }
        return instances;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private String extractFirst(Pattern pattern, String text) {
        Matcher m = pattern.matcher(text);
        if (!m.find()) return null;
        if (m.groupCount() >= 1) {
            String g1 = m.group(1);
            return (g1 == null || g1.isBlank()) ? m.group() : g1;
        }
        return m.group();
    }

    private String extractFirstFull(Pattern pattern, String text) {
        Matcher m = pattern.matcher(text);
        return m.find() ? m.group() : null;
    }

    private String detectName(String text) {
        // The name is usually the first meaningful line with 2-4 capitalized words
        for (String line : text.split("\\n")) {
            String trimmed = line.trim();
            if (trimmed.isBlank()) continue;
            // Skip lines that look like headers, emails, phones, URLs
            if (trimmed.contains("@") || trimmed.contains("http") || trimmed.matches(".*\\d{7,}.*")) continue;
            // Skip ALL-CAPS section headers
            if (trimmed.equals(trimmed.toUpperCase()) && trimmed.length() > 3) continue;
            String[] words = trimmed.split("\\s+");
            if (words.length >= 2 && words.length <= 5) {
                boolean allCapitalized = Arrays.stream(words)
                    .allMatch(w -> !w.isEmpty() && Character.isUpperCase(w.charAt(0)));
                if (allCapitalized) return trimmed;
            }
        }
        return null;
    }

    private String detectEducation(String text) {
        Pattern edu = Pattern.compile(
            "(?i)(b\\.?tech|b\\.?e\\.?|m\\.?tech|m\\.?e\\.?|bca|mca|b\\.?sc|m\\.?sc|bachelor|master|phd|diploma)" +
            "[^\\n]{0,100}", Pattern.DOTALL);
        Matcher m = edu.matcher(text);
        if (m.find()) {
            String val = m.group().trim().replaceAll("\\s+", " ");
            return val.substring(0, Math.min(80, val.length()));
        }
        return null;
    }

    private List<String> detectProjectNames(String text) {
        List<String> projects = new ArrayList<>();
        // Look for lines that follow "Projects" section header
        Pattern projSection = Pattern.compile("(?i)(projects?|portfolio)[\\s\\S]{0,20}\\n([\\s\\S]{0,800})");
        Matcher m = projSection.matcher(text);
        if (m.find()) {
            String section = m.group(2);
            // Extract bold/title-like lines (all-caps or Title Case short lines)
            for (String line : section.split("\\n")) {
                String trimmed = line.trim();
                if (trimmed.isBlank() || trimmed.length() < 3 || trimmed.length() > 60) continue;
                if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) continue;
                if (trimmed.matches("[A-Z][a-zA-Z\\s\\-:]{2,50}")) {
                    projects.add(trimmed);
                    if (projects.size() >= 5) break;
                }
            }
        }
        return projects;
    }

    private List<String> detectExperienceEntries(String text) {
        List<String> entries = new ArrayList<>();
        Pattern expSection = Pattern.compile("(?i)(experience|internship|work\\s+history)[\\s\\S]{0,20}\\n([\\s\\S]{0,800})");
        Matcher m = expSection.matcher(text);
        if (m.find()) {
            String section = m.group(2);
            for (String line : section.split("\\n")) {
                String trimmed = line.trim();
                if (trimmed.isBlank() || trimmed.length() < 5) continue;
                if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) continue;
                // Lines with | or — often indicate "Company | Role"
                if (trimmed.contains("|") || trimmed.contains("—") || trimmed.contains("–")) {
                    entries.add(trimmed);
                    if (entries.size() >= 4) break;
                }
            }
        }
        return entries;
    }

    private List<String> buildParsingWarnings(String text, String email, String phone, String github) {
        List<String> warnings = new ArrayList<>();

        // Check for multi-column indicators
        long longLines = Arrays.stream(text.split("\\n"))
            .filter(l -> l.length() > 150).count();
        if (longLines >= 3) {
            warnings.add("Very long unbroken lines detected — likely multi-column layout. Workday and Taleo will misparse this.");
        }

        // Check for pipe tables
        if (text.contains("|||") || Pattern.compile("\\|.{5,}\\|.{5,}\\|").matcher(text).find()) {
            warnings.add("Pipe-based table or column separator detected — may cause ATS parsing errors in Taleo.");
        }

        // Check for special characters
        if (Pattern.compile("[\\u2605\\u25CF\\u25A0\\u25B8\\u27A4\\u2192]").matcher(text).find()) {
            warnings.add("Special Unicode characters (stars, arrows, symbols) detected — may corrupt Taleo/Workday parser.");
        }

        if (email == null) {
            warnings.add("Email address not detected in standard location — ensure it is in plain text in the resume header.");
        }

        if (phone == null) {
            warnings.add("Phone number not detected — add it to the header in standard format.");
        }

        if (github == null) {
            warnings.add("GitHub URL not found — missing from header. Most ATS systems look for it here.");
        }

        // Check resume length
        long wordCount = Arrays.stream(text.split("\\s+")).filter(w -> !w.isBlank()).count();
        if (wordCount > 1000) {
            warnings.add("Resume appears to exceed 2 pages — some ATS truncate at page 2.");
        }

        return warnings;
    }
}
