package com.example.mockmate.service;

import com.example.mockmate.model.GeneratedResume;
import com.example.mockmate.model.ResumeValidationException;
import com.example.mockmate.model.VerifiedResumeInput;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Part 3 of the Resume Generator Prompt Pack — post-validation, run before
 * the generated resume is handed to any renderer. Fails CLOSED: any
 * violation throws {@link ResumeValidationException} rather than letting a
 * banned phrase, an invented number, or a leaked print artifact reach a
 * document a real person sends to a real employer.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeGenerationValidator {

    private final ObjectMapper objectMapper;

    private static final List<String> BANNED_PHRASES = List.of(
            "however", "although", "lack", "limited", "may hinder", "weaker",
            "below average", "despite", "unfortunately", "cgpa",
            "areas of improvement", "declaration"
    );

    private static final List<String> PII_TERMS = List.of(
            "date of birth", "gender", "marital", "nationality", "father",
            "mother tongue", "passport", "religion"
    );

    private static final Set<String> DANGLING_ENDINGS = Set.of(
            "and", "with", "the", "using", "a", "an", "of", "for", "to", "in", "on"
    );

    private static final Pattern SCAFFOLD_PATTERN =
            Pattern.compile("(?i)^\\s*(role|description|duration|title)\\s*:");
    private static final Pattern TIMESTAMP_PATTERN =
            Pattern.compile("\\d+/\\d+/\\d+,\\s*\\d+:\\d+\\s*[AP]M");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("\\d+(\\.\\d+)?");
    private static final Pattern EMOJI_PATTERN =
            Pattern.compile("[\\x{1F300}-\\x{1FAFF}\\x{2700}-\\x{27BF}]");

    /** @throws ResumeValidationException listing every violation found. */
    public void validate(GeneratedResume output, VerifiedResumeInput verified) {
        List<String> violations = new ArrayList<>();

        String flat = flatten(output).toLowerCase();

        // ── Banned language in the summary (the resume argues FOR the
        // candidate — no hedging, no CGPA mention, no negative clause) ────
        if (output.getSummary() != null) {
            String summaryLower = output.getSummary().toLowerCase();
            for (String banned : BANNED_PHRASES) {
                if (summaryLower.contains(banned)) {
                    violations.add("Banned phrase '" + banned + "' found in summary");
                }
            }
        }

        // ── PII anywhere in the document ──────────────────────────────────
        // Scanned excluding omittedFields: the writer is REQUIRED to name
        // omitted PII categories there (e.g. "father's or mother's name") to
        // prove it deliberately left them out — that self-report must not
        // itself trip the very check it's honoring.
        String piiScanTarget = flattenExcludingOmittedFields(output).toLowerCase();
        for (String term : PII_TERMS) {
            if (piiScanTarget.contains(term)) {
                violations.add("PII term '" + term + "' found in generated output");
            }
        }

        // ── No emoji/icon glyphs in contact fields ────────────────────────
        if (output.getContact() != null) {
            String contactFlat = String.join(" ",
                    nullToEmpty(output.getContact().getEmail()),
                    nullToEmpty(output.getContact().getPhone()),
                    nullToEmpty(output.getContact().getLocation()));
            if (EMOJI_PATTERN.matcher(contactFlat).find()) {
                violations.add("Emoji/icon glyph found in contact line");
            }
        }

        // ── Skills: exactly-once, and a strict subset of what was verified ─
        List<String> allSkills = allSkillItems(output);
        Set<String> verifiedLower = verified.getConfirmedSkills() == null
                ? Set.of()
                : verified.getConfirmedSkills().stream().map(String::toLowerCase).collect(java.util.stream.Collectors.toSet());
        for (String skill : allSkills) {
            if (!verifiedLower.contains(skill.toLowerCase())) {
                violations.add("Unconfirmed skill in output (candidate never confirmed it): '" + skill + "'");
            }
        }
        List<String> lowerSkills = allSkills.stream().map(String::toLowerCase).toList();
        if (new HashSet<>(lowerSkills).size() != lowerSkills.size()) {
            violations.add("Duplicate skill(s) detected across categories");
        }

        // ── Bullets: no scaffolding leak, no fragments, no invented numbers ─
        validateProjectBullets(output, verified, violations);
        validateExperienceBullets(output, verified, violations);

        // ── Browser print artifacts ───────────────────────────────────────
        if (flat.contains("localhost")) {
            violations.add("'localhost' leaked into generated output");
        }
        if (TIMESTAMP_PATTERN.matcher(flat).find()) {
            violations.add("Browser print timestamp pattern leaked into generated output");
        }

        if (!violations.isEmpty()) {
            log.warn("[ResumeValidator] {} violation(s): {}", violations.size(), violations);
            throw new ResumeValidationException(violations);
        }
    }

    private void validateProjectBullets(GeneratedResume output, VerifiedResumeInput verified, List<String> violations) {
        if (output.getProjects() == null) return;
        for (int i = 0; i < output.getProjects().size(); i++) {
            var proj = output.getProjects().get(i);
            if (proj.getBullets() == null) continue;
            Set<String> sourceNumbers = sourceNumbersFor(verified.getProjects(), i);
            for (var bullet : proj.getBullets()) {
                checkBulletText(bullet.getText(), bullet.isHasPlaceholder(), sourceNumbers, violations);
            }
        }
    }

    private void validateExperienceBullets(GeneratedResume output, VerifiedResumeInput verified, List<String> violations) {
        if (output.getExperience() == null) return;
        for (int i = 0; i < output.getExperience().size(); i++) {
            var exp = output.getExperience().get(i);
            if (exp.getBullets() == null) continue;
            Set<String> sourceNumbers = sourceNumbersFor(verified.getExperience(), i);
            for (String text : exp.getBullets()) {
                checkBulletText(text, false, sourceNumbers, violations);
            }
        }
    }

    private void checkBulletText(String text, boolean hasPlaceholder, Set<String> sourceNumbers, List<String> violations) {
        if (text == null || text.isBlank()) return;
        String trimmed = text.trim();

        if (SCAFFOLD_PATTERN.matcher(trimmed).find()) {
            violations.add("Scaffolding leaked into bullet (looks like an unfilled template field): '" + trimmed + "'");
        }
        if (!Character.isUpperCase(trimmed.charAt(0))) {
            violations.add("Bullet doesn't start with an uppercase letter: '" + trimmed + "'");
        }
        String lower = trimmed.toLowerCase();
        for (String ending : DANGLING_ENDINGS) {
            if (lower.endsWith(" " + ending)) {
                violations.add("Bullet ends on a dangling word ('" + ending + "'), reads as a sentence fragment: '" + trimmed + "'");
                break;
            }
        }

        // Invented numbers: every number in the bullet (unless it carries an
        // explicit placeholder) must already appear somewhere in the
        // corresponding verified source entry. Matched at entry-level (not
        // per-bullet) since the writer may reorder/merge bullets within an
        // entry — still catches a genuinely fabricated number.
        if (!hasPlaceholder) {
            Set<String> outNums = extractNumbers(trimmed);
            if (!sourceNumbers.containsAll(outNums)) {
                Set<String> invented = new LinkedHashSet<>(outNums);
                invented.removeAll(sourceNumbers);
                violations.add("Bullet contains number(s) " + invented + " not present in the verified source: '" + trimmed + "'");
            }
        }
    }

    private Set<String> sourceNumbersFor(List<VerifiedResumeInput.VerifiedEntry> entries, int index) {
        if (entries == null || index >= entries.size()) return Set.of();
        var entry = entries.get(index);
        Set<String> nums = new LinkedHashSet<>();
        if (entry.getBullets() != null) {
            for (String b : entry.getBullets()) nums.addAll(extractNumbers(b));
        }
        return nums;
    }

    private Set<String> extractNumbers(String text) {
        if (text == null) return Set.of();
        Set<String> nums = new LinkedHashSet<>();
        Matcher m = NUMBER_PATTERN.matcher(text);
        while (m.find()) nums.add(m.group());
        return nums;
    }

    private List<String> allSkillItems(GeneratedResume output) {
        List<String> items = new ArrayList<>();
        if (output.getSkills() != null) {
            for (var group : output.getSkills()) {
                if (group.getItems() != null) items.addAll(group.getItems());
            }
        }
        return items;
    }

    private String flatten(GeneratedResume output) {
        try {
            return objectMapper.writeValueAsString(output);
        } catch (Exception e) {
            return "";
        }
    }

    private String flattenExcludingOmittedFields(GeneratedResume output) {
        try {
            ObjectNode node = objectMapper.valueToTree(output);
            node.remove("omittedFields");
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            return "";
        }
    }

    private String nullToEmpty(String s) { return s == null ? "" : s; }
}
