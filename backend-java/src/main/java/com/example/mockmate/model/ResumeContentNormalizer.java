package com.example.mockmate.model;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Defensive normalization pass applied to a NormalizedResume immediately
 * before it reaches any renderer (HTML/DOCX/LaTeX). This is the last
 * deterministic checkpoint before the artifact reaches a real user, so it's
 * where duplicate/blank content gets caught regardless of which upstream
 * step introduced it — the Groq reconstruction call, or
 * {@code ResumeATSEnforcer}'s content-restoration merges, neither of which
 * dedupe or blank-filter what they emit.
 */
public final class ResumeContentNormalizer {

    private ResumeContentNormalizer() {}

    public static NormalizedResume normalize(NormalizedResume r) {
        if (r == null) return null;

        r.setProfessionalSummary(repairKnownMissingSpaces(r.getProfessionalSummary()));

        if (r.getAchievements() != null)   r.setAchievements(dedupList(repairAll(r.getAchievements())));
        if (r.getCertifications() != null) r.setCertifications(dedupList(repairAll(r.getCertifications())));
        if (r.getLeadership() != null)     r.setLeadership(dedupList(repairAll(r.getLeadership())));

        if (r.getExperience() != null) {
            for (var exp : r.getExperience()) {
                if (exp.getBullets() != null) exp.setBullets(dedupList(repairAll(exp.getBullets())));
            }
        }
        if (r.getProjects() != null) {
            for (var proj : r.getProjects()) {
                if (proj.getBullets() != null) proj.setBullets(dedupList(repairAll(proj.getBullets())));
            }
        }

        if (r.getSkills() != null) {
            r.setSkills(normalizeSkills(r.getSkills()));
        }

        return r;
    }

    // ── Dedup: normalise case, whitespace, and trailing punctuation before
    // comparing. Two entries differing only by a trailing period are dupes,
    // and this also drops blank/whitespace-only entries — a non-empty LIST
    // containing one blank string was rendering as an empty section header
    // with nothing under it, while the real content had been duplicated
    // into a different section entirely by the same upstream merge. ──────
    private static List<String> dedupList(List<String> items) {
        List<String> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String item : items) {
            if (item == null || item.isBlank()) continue;
            String key = normalizeForCompare(item);
            if (key.isEmpty() || seen.contains(key)) continue;
            seen.add(key);
            result.add(item.trim());
        }
        return result;
    }

    private static String normalizeForCompare(String s) {
        return s.trim().toLowerCase().replaceAll("[.\\s]+$", "").replaceAll("\\s+", " ");
    }

    private static List<String> repairAll(List<String> items) {
        List<String> out = new ArrayList<>();
        for (String s : items) out.add(repairKnownMissingSpaces(s));
        return out;
    }

    // ── Skills: merge same-label categories, dedupe values within a
    // category, and detect+merge the "label == value" singleton pattern —
    // each skill arriving as its own one-item category (label:"Java",
    // value:"Java") instead of being grouped under "Languages: Java,
    // Python..." — into one consolidated category. This singleton pattern is
    // exactly what produces "Java Java", "Spring Boot Spring Boot" when the
    // template prints a skill's label and value side by side in one row. ──
    private static List<NormalizedResume.NSkillCategory> normalizeSkills(
            List<NormalizedResume.NSkillCategory> skills) {

        List<NormalizedResume.NSkillCategory> grouped = new ArrayList<>();
        Map<String, NormalizedResume.NSkillCategory> byLabel = new LinkedHashMap<>();
        List<String> singletonValues = new ArrayList<>();
        Set<String> singletonSeen = new HashSet<>();

        for (var sk : skills) {
            if (sk == null) continue;
            String label = sk.getLabel() != null ? sk.getLabel().trim() : "";
            String value = sk.getValue() != null ? sk.getValue().trim() : "";
            if (label.isEmpty() && value.isEmpty()) continue;

            boolean isSingleton = !label.isEmpty() && label.equalsIgnoreCase(value);
            if (isSingleton) {
                String key = value.toLowerCase();
                if (!singletonSeen.contains(key)) {
                    singletonSeen.add(key);
                    singletonValues.add(value);
                }
                continue;
            }

            String labelKey = label.toLowerCase();
            NormalizedResume.NSkillCategory existing = byLabel.get(labelKey);
            if (existing != null) {
                existing.setValue(mergeCommaList(existing.getValue(), value));
            } else {
                NormalizedResume.NSkillCategory copy = NormalizedResume.NSkillCategory.builder()
                        .label(label).value(dedupCommaList(value))
                        .priority(sk.getPriority()).jdRelevant(sk.isJdRelevant()).build();
                byLabel.put(labelKey, copy);
                grouped.add(copy);
            }
        }

        if (!singletonValues.isEmpty()) {
            grouped.add(NormalizedResume.NSkillCategory.builder()
                    .label("Additional Skills")
                    .value(String.join(", ", singletonValues))
                    .priority(grouped.size() + 1)
                    .jdRelevant(false)
                    .build());
        }

        return grouped;
    }

    private static String mergeCommaList(String existing, String toAdd) {
        String combined = (existing == null ? "" : existing) + ", " + (toAdd == null ? "" : toAdd);
        return dedupCommaList(combined);
    }

    private static String dedupCommaList(String csv) {
        if (csv == null || csv.isBlank()) return "";
        List<String> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String part : csv.split("[,;]")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) continue;
            String key = trimmed.toLowerCase();
            if (seen.contains(key)) continue;
            seen.add(key);
            result.add(trimmed);
        }
        return String.join(", ", result);
    }

    // ── Bounded missing-space repair ───────────────────────────────────────
    // These originate in upstream PDF text extraction (PDFBox merges text
    // across a line-wrap without inserting a space), not in this renderer —
    // but the renderer shouldn't propagate them either. Only repair an
    // UNAMBIGUOUS known-compound split (a small curated list of terms that
    // actually appear in this domain); never attempt generic dictionary
    // word-splitting, which would mangle legitimate compound tokens like
    // "MockMate" or "StreamSmart".
    private static final Map<Pattern, String> KNOWN_MISSING_SPACE_FIXES = buildKnownFixes();

    private static Map<Pattern, String> buildKnownFixes() {
        Map<String, String> pairs = new LinkedHashMap<>();
        pairs.put("persistentstorage", "persistent storage");
        pairs.put("concurrentsessions", "concurrent sessions");
        pairs.put("concurrentsession", "concurrent session");
        pairs.put("realtimeavatar", "real-time avatar");
        pairs.put("automatedscoring", "automated scoring");
        pairs.put("dynamicquiz", "dynamic quiz");
        pairs.put("layeredcontroller", "layered controller");

        Map<Pattern, String> out = new LinkedHashMap<>();
        pairs.forEach((k, v) -> out.put(Pattern.compile("(?i)\\b" + k + "\\b"), v));
        return out;
    }

    public static String repairKnownMissingSpaces(String text) {
        if (text == null || text.isBlank()) return text;
        String result = text;
        for (var entry : KNOWN_MISSING_SPACE_FIXES.entrySet()) {
            result = entry.getKey().matcher(result).replaceAll(Matcher.quoteReplacement(entry.getValue()));
        }
        return result;
    }
}
