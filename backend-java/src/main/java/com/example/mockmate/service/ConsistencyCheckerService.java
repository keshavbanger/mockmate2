package com.example.mockmate.service;

import com.example.mockmate.model.ConsistencyCheckResult;
import com.example.mockmate.model.ConsistencyCheckResult.ConsistencyCheck;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.*;
import java.util.stream.Collectors;

/**
 * Runs 6 deterministic consistency checks on resume text.
 * No Groq calls.
 */
@Slf4j
@Service
public class ConsistencyCheckerService {

    // ── Date format patterns ──────────────────────────────────────────────────
    private static final List<Pattern> DATE_FORMATS = List.of(
        Pattern.compile("(?i)\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{4}\\b"),  // Jan 2023
        Pattern.compile("\\b\\d{4}[-/]\\d{2}\\b"),                                                  // 2023-01
        Pattern.compile("(?i)\\b(January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{4}\\b"), // January 2023
        Pattern.compile("\\b\\d{2}/\\d{4}\\b"),                                                      // 01/2023
        Pattern.compile("\\b\\d{4}\\b(?=\\s*[-–—])")                                                 // just year
    );

    // ── Present tense verbs that signal possible tense inconsistency in past roles ──
    private static final Set<String> PRESENT_TENSE_VERBS = Set.of(
        "manage", "manages", "develop", "develops", "work", "works",
        "design", "designs", "build", "builds", "lead", "leads",
        "coordinate", "coordinates", "create", "creates", "implement", "implements",
        "maintain", "maintains", "analyze", "analyzes", "handle", "handles"
    );

    // ── Section header capitalization patterns ───────────────────────────────
    private static final Pattern ALL_CAPS_HEADER   = Pattern.compile("^[A-Z\\s]{4,30}$");
    private static final Pattern TITLE_CASE_HEADER = Pattern.compile("^[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*$");

    public ConsistencyCheckResult runAllChecks(String resumeText) {
        if (resumeText == null || resumeText.isBlank()) {
            return ConsistencyCheckResult.builder()
                .consistencyScore(0)
                .passedChecks(0)
                .totalChecks(6)
                .checks(List.of())
                .build();
        }

        List<ConsistencyCheck> checks = new ArrayList<>();
        checks.add(checkTenseConsistency(resumeText));
        checks.add(checkDateFormatConsistency(resumeText));
        checks.add(checkBulletEndingConsistency(resumeText));
        checks.add(checkSectionCapitalization(resumeText));
        checks.add(checkDuplicateContent(resumeText));
        checks.add(checkNameConsistency(resumeText));

        long passed = checks.stream().filter(c -> "PASS".equals(c.getStatus())).count();
        int score   = (int) Math.round((passed * 100.0) / checks.size());

        log.info("[ConsistencyChecker] passedChecks={}/{} score={}", passed, checks.size(), score);

        return ConsistencyCheckResult.builder()
            .consistencyScore(score)
            .passedChecks((int) passed)
            .totalChecks(checks.size())
            .checks(checks)
            .build();
    }

    // ── Check 1: Tense consistency ────────────────────────────────────────────
    private ConsistencyCheck checkTenseConsistency(String text) {
        // Look for experience section then scan for present-tense verbs in bullets
        Pattern expSection = Pattern.compile(
            "(?i)(experience|internship|work history)[\\s\\S]{0,20}\\n([\\s\\S]{0,1500}?)(?=\\n[A-Z]{3,}|$)");
        Matcher sm = expSection.matcher(text);
        List<String> badBullets = new ArrayList<>();

        if (sm.find()) {
            String section = sm.group(2);
            Matcher bm = Pattern.compile("(?m)^\\s*[•\\-\\*]\\s+(.+)$").matcher(section);
            while (bm.find() && badBullets.size() < 3) {
                String bullet = bm.group(1).trim();
                String firstWord = bullet.split("\\s+")[0].toLowerCase().replaceAll("[^a-z]", "");
                if (PRESENT_TENSE_VERBS.contains(firstWord)) {
                    badBullets.add("\"" + bullet.substring(0, Math.min(bullet.length(), 70)) + "…\"");
                }
            }
        }

        boolean pass = badBullets.isEmpty();
        return ConsistencyCheck.builder()
            .checkName("Tense Consistency")
            .status(pass ? "PASS" : "FAIL")
            .detail(pass
                ? "All experience bullets use past tense correctly."
                : "Present-tense verbs found in past experience section. Use past tense for previous roles.")
            .examples(badBullets)
            .build();
    }

    // ── Check 2: Date format consistency ─────────────────────────────────────
    private ConsistencyCheck checkDateFormatConsistency(String text) {
        Set<Integer> formatsDetected = new HashSet<>();
        List<String> examples = new ArrayList<>();

        for (int i = 0; i < DATE_FORMATS.size(); i++) {
            Matcher m = DATE_FORMATS.get(i).matcher(text);
            if (m.find()) {
                formatsDetected.add(i);
                if (examples.size() < 3) examples.add(m.group());
            }
        }

        boolean pass = formatsDetected.size() <= 1;
        return ConsistencyCheck.builder()
            .checkName("Date Format Consistency")
            .status(pass ? "PASS" : "FAIL")
            .detail(pass
                ? "All dates use a consistent format."
                : "Multiple date formats detected (e.g., " + String.join(", ", examples) + "). Pick one format: 'Jan 2023' is recommended.")
            .examples(pass ? List.of() : examples)
            .build();
    }

    // ── Check 3: Bullet ending consistency ───────────────────────────────────
    private ConsistencyCheck checkBulletEndingConsistency(String text) {
        Matcher m = Pattern.compile("(?m)^\\s*[•\\-\\*]\\s+(.+)$").matcher(text);
        int withPeriod = 0, withoutPeriod = 0;
        List<String> breakers = new ArrayList<>();

        while (m.find()) {
            String bullet = m.group(1).trim();
            if (bullet.endsWith(".")) withPeriod++;
            else withoutPeriod++;
        }

        int total = withPeriod + withoutPeriod;
        boolean pass = total == 0 || withPeriod == 0 || withoutPeriod == 0;

        if (!pass) {
            breakers.add(withPeriod + " bullets end with period, " + withoutPeriod + " do not — pick one style");
        }

        return ConsistencyCheck.builder()
            .checkName("Bullet Ending Consistency")
            .status(pass ? "PASS" : "FAIL")
            .detail(pass
                ? "Bullet endings are consistent throughout the resume."
                : "Mixed bullet endings detected. Some bullets end with periods, others do not.")
            .examples(breakers)
            .build();
    }

    // ── Check 4: Section header capitalization ────────────────────────────────
    private ConsistencyCheck checkSectionCapitalization(String text) {
        int allCaps = 0, titleCase = 0;
        List<String> headers = new ArrayList<>();

        for (String line : text.split("\\n")) {
            String trimmed = line.trim();
            if (trimmed.length() < 3 || trimmed.length() > 35) continue;
            if (trimmed.split("\\s+").length > 5) continue; // not a header if too many words
            if (ALL_CAPS_HEADER.matcher(trimmed).matches() && trimmed.matches(".*[A-Z]{3,}.*")) {
                allCaps++;
                headers.add("\"" + trimmed + "\" (ALL CAPS)");
            } else if (TITLE_CASE_HEADER.matcher(trimmed).matches()) {
                titleCase++;
                headers.add("\"" + trimmed + "\" (Title Case)");
            }
        }

        boolean pass = allCaps == 0 || titleCase == 0;
        List<String> examples = headers.size() > 4 ? headers.subList(0, 4) : headers;

        return ConsistencyCheck.builder()
            .checkName("Section Header Capitalization")
            .status(pass ? "PASS" : "FAIL")
            .detail(pass
                ? "Section headers use consistent capitalization."
                : "Mixed capitalization: some headers are ALL CAPS, others are Title Case. Pick one style.")
            .examples(pass ? List.of() : examples)
            .build();
    }

    // ── Check 5: Duplicate content ────────────────────────────────────────────
    private ConsistencyCheck checkDuplicateContent(String text) {
        String[] lines = text.split("\\n");
        Map<String, Integer> lineCount = new LinkedHashMap<>();
        List<String> duplicates = new ArrayList<>();

        for (String line : lines) {
            String norm = line.trim().toLowerCase().replaceAll("\\s+", " ");
            if (norm.length() < 15) continue; // skip short lines
            lineCount.merge(norm, 1, Integer::sum);
        }

        lineCount.forEach((line, count) -> {
            if (count > 1 && duplicates.size() < 3) {
                String display = line.length() > 60 ? line.substring(0, 60) + "…" : line;
                duplicates.add("\"" + display + "\" (appears " + count + "x)");
            }
        });

        boolean pass = duplicates.isEmpty();
        return ConsistencyCheck.builder()
            .checkName("Duplicate Content")
            .status(pass ? "PASS" : "FAIL")
            .detail(pass
                ? "No duplicate content detected."
                : "Duplicate lines/phrases found. Remove repetition to improve ATS scoring.")
            .examples(duplicates)
            .build();
    }

    // ── Check 6: Name / project name consistency ──────────────────────────────
    private ConsistencyCheck checkNameConsistency(String text) {
        // Find capitalized multi-word tokens used multiple times with different casing
        Pattern namePattern = Pattern.compile("\\b[A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+)+\\b");
        Matcher m = namePattern.matcher(text);
        Map<String, Set<String>> canonicalMap = new LinkedHashMap<>();

        while (m.find()) {
            String found = m.group();
            String key = found.toLowerCase();
            canonicalMap.computeIfAbsent(key, k -> new LinkedHashSet<>()).add(found);
        }

        List<String> inconsistencies = canonicalMap.entrySet().stream()
            .filter(e -> e.getValue().size() > 1)
            .map(e -> String.join(" vs ", e.getValue()))
            .limit(3)
            .toList();

        boolean pass = inconsistencies.isEmpty();
        return ConsistencyCheck.builder()
            .checkName("Name & Project Capitalization")
            .status(pass ? "PASS" : "FAIL")
            .detail(pass
                ? "Project and company names are spelled consistently."
                : "Inconsistent capitalization of project/company names detected.")
            .examples(inconsistencies)
            .build();
    }
}
