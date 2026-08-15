package com.example.mockmate.service;

import com.example.mockmate.model.techinterview.DSAProblem;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DSAProblemService {

    private final ObjectMapper objectMapper;

    // ID → problem (e.g. "lc-001" → DSAProblem)
    private final Map<String, DSAProblem> problemBank = new LinkedHashMap<>();
    // LeetCode ID → problem (e.g. 1 → DSAProblem)
    private final Map<Integer, DSAProblem> byLeetcodeId = new HashMap<>();

    @PostConstruct
    public void loadProblems() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath:problems/dsa/**/*.json");
            int loaded = 0;
            for (Resource res : resources) {
                try {
                    DSAProblem problem = objectMapper.readValue(res.getInputStream(), DSAProblem.class);
                    if (!isValidProblem(problem)) {
                        log.error("Skipping invalid DSA problem in {}: missing testCases or starterCode", res.getFilename());
                        continue;
                    }

                    long publicCount = problem.getTestCases().stream().filter(tc -> !tc.isHidden()).count();
                    long hiddenCount = problem.getTestCases().stream().filter(DSAProblem.TestCase::isHidden).count();
                    if (publicCount < 2 || hiddenCount < 1) {
                        log.warn("DSA problem {} ({}) has sparse test cases: {} public, {} hidden (recommended >=2 public, >=1 hidden)",
                                problem.getId(), res.getFilename(), publicCount, hiddenCount);
                    }

                    problemBank.put(problem.getId(), problem);
                    byLeetcodeId.put(problem.getLeetcodeId(), problem);
                    loaded++;
                } catch (Exception e) {
                    log.warn("Failed to load DSA problem from {}: {}", res.getFilename(), e.getMessage());
                }
            }
            log.info("Loaded {} valid DSA problems into bank.", loaded);
        } catch (Exception e) {
            log.error("Failed to scan DSA problem resources", e);
        }
    }

    public boolean isValidProblem(DSAProblem p) {
        if (p == null || p.getId() == null) return false;
        if (p.getStarterCode() == null || p.getStarterCode().getJava() == null || p.getStarterCode().getJava().isBlank()) {
            return false;
        }
        if (p.getTestCases() == null || p.getTestCases().isEmpty()) {
            return false;
        }
        long publicCount = p.getTestCases().stream().filter(tc -> !tc.isHidden()).count();
        return publicCount > 0;
    }

    // ── Getters ───────────────────────────────────────────────

    /** Returns problem without solution (safe for candidate) */
    public DSAProblem getProblem(String id) {
        DSAProblem p = findProblemInternal(id);
        return p != null ? p.toPublicView() : null;
    }

    /** Returns full problem including solution (for report generation) */
    public DSAProblem getProblemFull(String id) {
        return findProblemInternal(id);
    }

    private DSAProblem findProblemInternal(String id) {
        if (id == null || id.isBlank()) {
            return problemBank.isEmpty() ? null : problemBank.values().iterator().next();
        }
        // 1. Direct match in problemBank
        if (problemBank.containsKey(id)) {
            return problemBank.get(id);
        }
        // 2. Try numeric LeetCode ID match
        try {
            String digits = id.replaceAll("[^0-9]", "");
            if (!digits.isBlank()) {
                int lcId = Integer.parseInt(digits);
                if (lcId > 0 && byLeetcodeId.containsKey(lcId)) {
                    return byLeetcodeId.get(lcId);
                }
            }
        } catch (Exception ignored) {}

        // 3. Search case-insensitive by ID, title, or title slug
        String idLower = id.toLowerCase().trim();
        for (DSAProblem p : problemBank.values()) {
            if (p.getId() != null && p.getId().equalsIgnoreCase(idLower)) return p;
            if (p.getTitle() != null) {
                String titleLower = p.getTitle().toLowerCase().trim();
                if (titleLower.equalsIgnoreCase(idLower)) return p;
                if (titleLower.replace(" ", "-").equalsIgnoreCase(idLower)) return p;
                if (titleLower.replace(" ", "_").equalsIgnoreCase(idLower)) return p;
                if (idLower.contains(titleLower) || titleLower.contains(idLower)) return p;
            }
        }

        // No match. This used to silently return "lc-001" (Two Sum) here,
        // disguised as a genuine hit — every caller checked `!= null` as
        // proof of a match, so any ID the LLM invented that wasn't one of
        // the ~16 problems actually in the local bank (see loadProblems())
        // resolved to Two Sum while being logged/treated as "the LLM's
        // original pick." That's what made DSA rounds converge on Two Sum
        // regardless of role/difficulty: InterviewPlanGeneratorService.
        // resolveDsaProblems() already has a real diversity-aware fallback
        // chain (numeric-ID lookup → curated relevance-sorted pool → last
        // resort), but it only runs when this method actually reports a
        // miss instead of masking it.
        return null;
    }

    public DSAProblem findByLeetcodeId(int lcId) {
        DSAProblem p = byLeetcodeId.get(lcId);
        return p != null ? p.toPublicView() : null;
    }

    // ── Selection Logic ───────────────────────────────────────

    /**
     * Selects DSA problems based on role level, JD topics, and company style.
     */
    public List<DSAProblem> selectProblems(String roleLevel, String jdText, String companyStyle) {
        int[] dist = getDifficultyDistribution(roleLevel);
        int easyCount  = dist[0];
        int mediumCount= dist[1];
        int hardCount  = dist[2];

        List<String> jdTopics = extractTopicsFromJD(jdText);
        Set<String> selected  = new LinkedHashSet<>();
        List<DSAProblem> result = new ArrayList<>();

        // Easy problems
        List<DSAProblem> easyPool = getByDifficulty("EASY", companyStyle, jdTopics);
        Collections.shuffle(easyPool);
        for (int i = 0; i < Math.min(easyCount, easyPool.size()); i++) {
            DSAProblem p = easyPool.get(i);
            if (selected.add(p.getId())) result.add(p.toPublicView());
        }

        // Medium problems
        List<DSAProblem> mediumPool = getByDifficulty("MEDIUM", companyStyle, jdTopics);
        Collections.shuffle(mediumPool);
        for (int i = 0; i < Math.min(mediumCount, mediumPool.size()); i++) {
            DSAProblem p = mediumPool.get(i);
            if (selected.add(p.getId())) result.add(p.toPublicView());
        }

        // Hard problems
        List<DSAProblem> hardPool = getByDifficulty("HARD", companyStyle, jdTopics);
        Collections.shuffle(hardPool);
        for (int i = 0; i < Math.min(hardCount, hardPool.size()); i++) {
            DSAProblem p = hardPool.get(i);
            if (selected.add(p.getId())) result.add(p.toPublicView());
        }

        // Ensure minimum 2 problems
        if (result.size() < 2 && !easyPool.isEmpty()) {
            DSAProblem fallback = problemBank.get("lc-001");
            if (fallback != null && !selected.contains("lc-001")) {
                result.add(0, fallback.toPublicView());
            }
        }

        log.info("Selected {} DSA problems for roleLevel={}", result.size(), roleLevel);
        return result;
    }

    // ── Difficulty Distribution ───────────────────────────────

    /** Returns [easy, medium, hard] counts */
    private int[] getDifficultyDistribution(String roleLevel) {
        return switch (roleLevel.toUpperCase()) {
            case "INTERN"  -> new int[]{2, 0, 0};
            case "FRESHER" -> new int[]{1, 1, 0};
            case "SDE_1", "SDE-1" -> new int[]{1, 2, 0};
            case "SDE_2", "SDE-2" -> new int[]{0, 2, 1};
            case "SDE_3", "SDE-3" -> new int[]{0, 1, 2};
            default -> new int[]{1, 1, 0};
        };
    }

    // ── Problem Filtering ─────────────────────────────────────

    private List<DSAProblem> getByDifficulty(String difficulty, String companyStyle, List<String> jdTopics) {
        List<DSAProblem> all = problemBank.values().stream()
                .filter(p -> isValidProblem(p) && difficulty.equalsIgnoreCase(p.getDifficulty()))
                .collect(Collectors.toList());

        if (all.isEmpty()) return all;

        // Sort by relevance: company match → jd topic match → frequency
        all.sort((a, b) -> {
            int scoreA = relevanceScore(a, companyStyle, jdTopics);
            int scoreB = relevanceScore(b, companyStyle, jdTopics);
            return Integer.compare(scoreB, scoreA); // descending
        });
        return all;
    }

    private int relevanceScore(DSAProblem p, String companyStyle, List<String> jdTopics) {
        int score = 0;
        if (p.getCompanies() != null && companyStyle != null) {
            if (p.getCompanies().stream().anyMatch(c ->
                    c.equalsIgnoreCase(companyStyle))) score += 3;
        }
        if (p.getTopics() != null && jdTopics != null) {
            for (String topic : jdTopics) {
                if (p.getTopics().stream().anyMatch(t ->
                        t.toLowerCase().contains(topic.toLowerCase()))) {
                    score += 2;
                    break;
                }
            }
        }
        if ("VERY_HIGH".equalsIgnoreCase(p.getFrequency())) score += 2;
        else if ("HIGH".equalsIgnoreCase(p.getFrequency()))  score += 1;
        if (p.getNeetcodeListNumber() > 0) score += 1;
        return score;
    }

    private List<String> extractTopicsFromJD(String jdText) {
        if (jdText == null || jdText.isBlank()) return List.of();
        String lower = jdText.toLowerCase();
        List<String> topics = new ArrayList<>();
        String[] keywords = {"array", "string", "tree", "graph", "dp", "dynamic programming",
                "hash", "linked list", "stack", "queue", "heap", "binary search", "sorting",
                "recursion", "backtracking", "greedy", "sliding window", "two pointer"};
        for (String kw : keywords) {
            if (lower.contains(kw)) topics.add(kw);
        }
        return topics;
    }

    public Collection<DSAProblem> getAllProblems() {
        return problemBank.values().stream()
                .map(DSAProblem::toPublicView)
                .toList();
    }

    public int getProblemCount() {
        return problemBank.size();
    }
}
