package com.example.mockmate.service;

import com.example.mockmate.model.techinterview.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewPlanGeneratorService {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;
    private final DSAProblemService dsaProblemService;
    private final OpenRouterFallbackService openRouterFallbackService;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL    = "llama-3.3-70b-versatile";

    // ── System Prompt ─────────────────────────────────────────
    private static final String SYSTEM_PROMPT = """
You are a technical hiring manager at a top tech company. You are designing a personalized interview plan for a specific candidate applying for a specific role.

Your job is to decide:
1. Which topics to assess
2. How many questions per topic
3. Difficulty of each topic
4. Time allocation per topic
5. What tools to open (code/SQL/whiteboard)
6. DSA problems to assign (from real LeetCode problem set)

TIME REWEIGHTING RULES:
- Introduction is ALWAYS first and MUST be capped at 3-5 minutes MAX.
- Technical Theory (if included) must be concise (max 5-10 min total, 2-3 questions max).
- DSA + SQL combined MUST account for AT LEAST 50% of total interview duration (for a 45-min interview: DSA = 25+ min; for 60-min: DSA = 35+ min).
- System Design / Architecture is only included for SDE-2 / Staff level candidates.
- Tailor questions directly to technologies found in candidate resume and JD.

Return ONLY valid JSON. No markdown, no code blocks, no explanation. Pure JSON object.
""";

    // ── Main Entry Point ──────────────────────────────────────
    public InterviewPlan generatePlan(InterviewPlanConfig config) {
        log.info("Generating interview plan for role={} type={} company={} duration={}min",
                config.getRoleLevel(), config.getInterviewType(),
                config.getCompanyStyle(), config.getDurationMinutes());

        String userPrompt = buildUserPrompt(config);

        try {
            String rawJson = callGroq(userPrompt);
            InterviewPlan plan = parsePlanFromGroq(rawJson, config);
            plan.setPlanId(UUID.randomUUID().toString());
            plan.setCreatedAt(System.currentTimeMillis() / 1000);
            plan.setConfig(config);
            plan.setRawGroqResponse(rawJson);

            // Resolve DSA problem IDs from LeetCode numbers
            resolveDsaProblems(plan);

            if (config.isStartDirectlyToDsa() && plan.getInterviewPlan() != null && plan.getInterviewPlan().getRounds() != null) {
                List<InterviewRound> rounds = plan.getInterviewPlan().getRounds();
                // Moving DSA to the front used to leave the Introduction round
                // still sitting in the list — so once the fast-tracked DSA
                // round ended, advancing to "the next round" could land right
                // back on "Introduction" mid-interview (candidate already
                // answered coding questions, UI suddenly says "let's start
                // with your introduction"). The candidate explicitly chose to
                // skip the intro; skipping it means never landing on it,
                // not just starting past it.
                rounds.removeIf(r -> r.getRoundType() == InterviewRound.RoundType.INTRO);
                Optional<InterviewRound> dsaRound = rounds.stream().filter(r -> r.getRoundType() == InterviewRound.RoundType.DSA).findFirst();
                if (dsaRound.isPresent()) {
                    rounds.remove(dsaRound.get());
                    rounds.add(0, dsaRound.get());
                }
            }

            log.info("Plan generated: {} rounds, planId={}", 
                    plan.getInterviewPlan().getRounds().size(), plan.getPlanId());
            return plan;

        } catch (Exception e) {
            log.error("Failed to generate or parse Groq plan response, falling back to default plan", e);
            InterviewPlan fallbackPlan = buildFallbackPlan(config);
            fallbackPlan.setPlanId(UUID.randomUUID().toString());
            fallbackPlan.setCreatedAt(System.currentTimeMillis() / 1000);
            fallbackPlan.setConfig(config);
            resolveDsaProblems(fallbackPlan);
            return fallbackPlan;
        }
    }

    // ── User Prompt Builder ───────────────────────────────────
    // Previously the prompt only said "DSA problems to assign (from real
    // LeetCode problem set)" with zero visibility into which LeetCode IDs
    // this app's local problem bank (~16 problems, see DSAProblemService)
    // actually has full test cases/starter code for. The LLM would
    // therefore freely invent well-known but unavailable problems (Group
    // Anagrams, Number of Islands, etc.), every one of which used to
    // silently resolve to Two Sum (see the now-removed masking fallback in
    // DSAProblemService.findProblemInternal). Listing the real inventory
    // here lets the model's picks actually match on the first try instead
    // of falling through to a resolver-side guess.
    private String buildUserPrompt(InterviewPlanConfig config) {
        return """
Generate a personalized interview plan.

Resume: %s

Job description: %s

Role level: %s
Interview type: %s
Company style: %s
Total duration: %d minutes
Preferred coding language: %s

DSA PROBLEM SELECTION — MANDATORY CONSTRAINT:
You may ONLY assign DSA problems from this exact list of LeetCode IDs — this app has no others loaded, and any ID outside this list cannot be shown to the candidate:
%s
Pick problems whose topic best matches the JD/resume, vary difficulty per the role level, and NEVER reuse the same leetcodeId twice across the whole plan.

Return this exact JSON structure:
{
  "candidateProfile": {
    "detectedTechnologies": ["string"],
    "detectedProjects": ["string"],
    "experienceSignals": ["string"],
    "weaknessSignals": ["string"],
    "strengths": ["string"]
  },
  "interviewPlan": {
    "totalMinutes": %d,
    "rounds": [
      {
        "roundId": "round_1",
        "roundName": "string",
        "roundType": "INTRO|TECHNICAL_THEORY|DSA|SQL|SYSTEM_DESIGN|LLD|DATABASE_DESIGN|DEBUGGING|BEHAVIORAL|PROJECT_DEEP_DIVE|WRAP_UP",
        "allocatedMinutes": 10,
        "topics": ["string"],
        "questionCount": 5,
        "difficulty": "EASY|MEDIUM|HARD|MIXED",
        "toolRequired": "CODE_EDITOR|SQL_EDITOR|WHITEBOARD|NONE",
        "language": "%s or null",
        "focusAreas": ["string"],
        "dsaProblems": [
          {
            "leetcodeId": 1,
            "title": "Two Sum",
            "difficulty": "EASY",
            "topic": "array",
            "url": "https://leetcode.com/problems/two-sum/",
            "whySelected": "string"
          }
        ],
        "mustCoverPoints": ["string"],
        "skipIfCandidateWeak": false,
        "escalationEnabled": true
      }
    ],
    "adaptationRules": {
      "ifCandidateExcels": "string",
      "ifCandidateStruggles": "string",
      "minimumRoundsRequired": ["round_1", "round_X"],
      "timeWarningAt": 10
    },
    "companyStyleGuidance": "string",
    "evaluationCriteria": {
      "primaryFactors": ["string"],
      "dealBreakers": ["string"]
    }
  }
}
""".formatted(
                truncate(config.getResumeText(), 3000),
                truncate(config.getJdText(), 2000),
                config.getRoleLevel(),
                config.getInterviewType(),
                config.getCompanyStyle(),
                config.getDurationMinutes(),
                config.getPreferredLanguage(),
                buildAvailableProblemsBlock(),
                config.getDurationMinutes(),
                config.getPreferredLanguage()
        );
    }

    // Formats the local DSA problem bank as a compact, LLM-readable list so
    // plan generation picks IDs that actually exist locally instead of
    // guessing against the full universe of real LeetCode problems.
    private String buildAvailableProblemsBlock() {
        Collection<DSAProblem> all = dsaProblemService.getAllProblems();
        if (all.isEmpty()) return "(none loaded)";
        StringBuilder sb = new StringBuilder();
        for (DSAProblem p : all) {
            sb.append("- leetcodeId=").append(p.getLeetcodeId())
              .append(" \"").append(p.getTitle()).append("\" (")
              .append(p.getDifficulty()).append(", topics: ")
              .append(p.getTopics() != null ? String.join(", ", p.getTopics()) : "general")
              .append(")\n");
        }
        return sb.toString();
    }

    // ── Groq Call ─────────────────────────────────────────────
    private String callGroq(String userPrompt) {
        List<String> modelsToTry = List.of(
                MODEL,
                "llama-3.1-70b-versatile",
                "llama-3.1-8b-instant",
                "llama3-70b-8192"
        );

        Exception lastException = null;

        for (String modelName : modelsToTry) {
            Map<String, Object> body = new HashMap<>();
            body.put("model", modelName);
            body.put("temperature", 0.3);
            body.put("max_tokens", 4096);
            body.put("response_format", Map.of("type", "json_object"));
            body.put("messages", List.of(
                    Map.of("role", "system", "content", SYSTEM_PROMPT),
                    Map.of("role", "user", "content", userPrompt)
            ));

            try {
                log.info("Attempting Groq call for interview plan using model: {}", modelName);
                String response = webClientBuilder.build()
                        .post()
                        .uri(GROQ_URL)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + groqApiKey)
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .bodyValue(body)
                        .retrieve()
                        .bodyToMono(String.class)
                        .timeout(java.time.Duration.ofSeconds(15))
                        .block();

                if (response != null && !response.isEmpty()) {
                    JsonNode root = objectMapper.readTree(response);
                    String content = root.path("choices").get(0)
                            .path("message").path("content").asText();
                    if (content != null && !content.isEmpty()) {
                        return content;
                    }
                }
            } catch (Exception e) {
                log.warn("Groq plan generation failed with model {}: {}", modelName, e.getMessage());
                lastException = e;
            }
        }

        log.warn("All Groq models failed for interview plan generation — trying OpenRouter as last resort", lastException);
        String orContent = openRouterFallbackService.complete(SYSTEM_PROMPT, userPrompt, 4096);
        if (orContent != null) return orContent;

        log.error("OpenRouter fallback also failed for interview plan generation", lastException);
        throw new RuntimeException("Failed to generate interview plan from AI", lastException);
    }

    // ── Parse Groq Response ───────────────────────────────────
    private InterviewPlan parsePlanFromGroq(String rawJson, InterviewPlanConfig config) throws Exception {
        JsonNode root = objectMapper.readTree(rawJson);

        CandidateProfile profile = objectMapper.treeToValue(
                root.path("candidateProfile"), CandidateProfile.class);

        InterviewPlan.PlanDetails details = objectMapper.treeToValue(
                root.path("interviewPlan"), InterviewPlan.PlanDetails.class);

        // Parse rounds
        List<InterviewRound> rounds = new ArrayList<>();
        JsonNode roundsNode = root.path("interviewPlan").path("rounds");
        for (JsonNode rn : roundsNode) {
            InterviewRound round = objectMapper.treeToValue(rn, InterviewRound.class);
            round.setTopicsCovered(new ArrayList<>());
            rounds.add(round);
        }
        if (details != null) {
            details.setRounds(rounds);
        }

        InterviewPlan plan = new InterviewPlan();
        plan.setCandidateProfile(profile);
        plan.setInterviewPlan(details);
        return plan;
    }

    // ── Resolve DSA Problem IDs ───────────────────────────────
    private void resolveDsaProblems(InterviewPlan plan) {
        if (plan.getInterviewPlan() == null || plan.getInterviewPlan().getRounds() == null) return;

        // Tracks every problemId already assigned across the WHOLE plan, not
        // just one round — without this, two unresolved refs (in the same or
        // different rounds) could both fall back to the same default
        // problem, and the candidate would see the identical problem twice
        // in one interview.
        Set<String> usedProblemIds = new HashSet<>();

        // Lazily built once per plan, only if actually needed. This is
        // DSAProblemService.selectProblems — a real difficulty/company/JD-
        // relevance selector that used to sit completely unused, with DSA
        // selection delegated entirely to the LLM's own LeetCode guesswork
        // against this app's 9-problem bank. Used here as the fallback pool
        // so a fallback is still difficulty/JD-relevant instead of always
        // defaulting to "Two Sum".
        List<DSAProblem> curatedPool = null;

        for (InterviewRound round : plan.getInterviewPlan().getRounds()) {
            if (round.getDsaProblems() == null) continue;
            for (InterviewRound.DSAProblemRef ref : round.getDsaProblems()) {
                // Map LeetCode ID → local problem ID
                String localId = "lc-" + String.format("%03d", ref.getLeetcodeId());
                DSAProblem problem = dsaProblemService.getProblem(localId);
                DSAProblem resolved;
                if (problem != null && !usedProblemIds.contains(localId)) {
                    resolved = problem;
                    // Already the LLM's original pick — title/difficulty
                    // already match, no resync needed.
                } else {
                    // Either not in the local bank, or already used
                    // elsewhere in this plan. ref.title/difficulty still
                    // held the LLM's ORIGINAL pick until this fix — the AI
                    // interviewer would tell the candidate "your challenge
                    // is Number of Islands" while the editor actually loaded
                    // Two Sum. Resync both fields to whatever problem
                    // actually gets loaded so what's said matches what's shown.
                    DSAProblem closest = problem == null ? dsaProblemService.findByLeetcodeId(ref.getLeetcodeId()) : null;
                    if (closest != null && !usedProblemIds.contains(closest.getId())) {
                        resolved = closest;
                    } else {
                        if (curatedPool == null) {
                            curatedPool = new ArrayList<>(dsaProblemService.selectProblems(
                                    plan.getConfig().getRoleLevel(), plan.getConfig().getJdText(),
                                    plan.getConfig().getCompanyStyle()));
                        }
                        resolved = curatedPool.stream()
                                .filter(p -> !usedProblemIds.contains(p.getId()))
                                .findFirst()
                                .orElseGet(() -> dsaProblemService.getProblem("lc-001"));
                        log.warn("DSA problem lc-{} unavailable or already used, falling back to curated pick {}",
                                ref.getLeetcodeId(), resolved != null ? resolved.getId() : "lc-001");
                    }
                }

                ref.setProblemId(resolved != null ? resolved.getId() : "lc-001");
                if (resolved != null) {
                    ref.setTitle(resolved.getTitle());
                    ref.setDifficulty(resolved.getDifficulty());
                    usedProblemIds.add(resolved.getId());
                }
            }
        }
    }

    // ── Fallback Plan ─────────────────────────────────────────
    private InterviewPlan buildFallbackPlan(InterviewPlanConfig config) {
        log.warn("Using fallback interview plan");
        InterviewPlan plan = new InterviewPlan();
        plan.setPlanId(UUID.randomUUID().toString());
        plan.setConfig(config);
        plan.setCreatedAt(System.currentTimeMillis() / 1000);

        CandidateProfile profile = new CandidateProfile();
        profile.setDetectedTechnologies(List.of("General Programming"));
        profile.setDetectedProjects(List.of());
        profile.setStrengths(List.of("Technical aptitude"));
        profile.setWeaknessSignals(List.of());
        profile.setExperienceSignals(List.of(config.getRoleLevel()));
        plan.setCandidateProfile(profile);

        List<InterviewRound> rounds = buildDefaultRounds(config);
        InterviewPlan.PlanDetails details = new InterviewPlan.PlanDetails();
        details.setTotalMinutes(config.getDurationMinutes());
        details.setRounds(rounds);
        details.setCompanyStyleGuidance("Standard technical interview format.");

        InterviewPlan.AdaptationRules rules = new InterviewPlan.AdaptationRules();
        rules.setIfCandidateExcels("Increase difficulty, ask advanced follow-ups.");
        rules.setIfCandidateStruggles("Give hints, simplify, move on if stuck.");
        rules.setMinimumRoundsRequired(List.of("round_1", "round_dsa", "round_wrap"));
        rules.setTimeWarningAt(10);
        details.setAdaptationRules(rules);

        InterviewPlan.EvaluationCriteria criteria = new InterviewPlan.EvaluationCriteria();
        criteria.setPrimaryFactors(List.of("DSA skill", "CS fundamentals", "Communication"));
        criteria.setDealBreakers(List.of("Cannot solve any DSA problem", "Cannot explain own projects"));
        details.setEvaluationCriteria(criteria);

        plan.setInterviewPlan(details);
        return plan;
    }

    private List<InterviewRound> buildDefaultRounds(InterviewPlanConfig config) {
        List<InterviewRound> rounds = new ArrayList<>();

        int totalMin = config.getDurationMinutes() > 0 ? config.getDurationMinutes() : 45;

        // Round 1: Intro (5 min max)
        InterviewRound intro = new InterviewRound();
        intro.setRoundId("round_1");
        intro.setRoundName("Introduction");
        intro.setRoundType(InterviewRound.RoundType.INTRO);
        intro.setAllocatedMinutes(5);
        intro.setTopics(List.of("Self introduction", "Key project overview"));
        intro.setQuestionCount(2);
        intro.setDifficulty(InterviewRound.Difficulty.EASY);
        intro.setToolRequired(InterviewRound.ToolRequired.NONE);
        intro.setLanguage(null);
        intro.setMustCoverPoints(List.of("Background", "Key Project"));
        intro.setTopicsCovered(new ArrayList<>());
        rounds.add(intro);

        // Round 2: DSA (at least 60% of time)
        InterviewRound dsa = new InterviewRound();
        dsa.setRoundId("round_dsa");
        dsa.setRoundName("DSA Round");
        dsa.setRoundType(InterviewRound.RoundType.DSA);
        dsa.setAllocatedMinutes(Math.max(25, totalMin - 10));
        dsa.setTopics(List.of("Arrays", "Hash Maps", "Strings"));
        dsa.setQuestionCount(2);
        dsa.setDifficulty(InterviewRound.Difficulty.MIXED);
        dsa.setToolRequired(InterviewRound.ToolRequired.CODE_EDITOR);
        dsa.setLanguage(config.getPreferredLanguage());
        dsa.setMustCoverPoints(List.of("Time complexity", "Space complexity", "Edge cases"));
        dsa.setEscalationEnabled(true);
        dsa.setTopicsCovered(new ArrayList<>());

        // Default 2 problems: Two Sum + Valid Parentheses
        InterviewRound.DSAProblemRef p1 = new InterviewRound.DSAProblemRef();
        p1.setLeetcodeId(1); p1.setTitle("Two Sum"); p1.setDifficulty("EASY");
        p1.setTopic("array"); p1.setUrl("https://leetcode.com/problems/two-sum/");
        p1.setProblemId("lc-001");
        InterviewRound.DSAProblemRef p2 = new InterviewRound.DSAProblemRef();
        p2.setLeetcodeId(20); p2.setTitle("Valid Parentheses"); p2.setDifficulty("EASY");
        p2.setTopic("stack"); p2.setUrl("https://leetcode.com/problems/valid-parentheses/");
        p2.setProblemId("lc-020");
        dsa.setDsaProblems(List.of(p1, p2));
        rounds.add(dsa);

        // Round 3: Wrap up (5 min)
        InterviewRound wrap = new InterviewRound();
        wrap.setRoundId("round_wrap");
        wrap.setRoundName("Wrap Up");
        wrap.setRoundType(InterviewRound.RoundType.WRAP_UP);
        wrap.setAllocatedMinutes(5);
        wrap.setTopics(List.of("Candidate questions"));
        wrap.setQuestionCount(1);
        wrap.setDifficulty(InterviewRound.Difficulty.EASY);
        wrap.setToolRequired(InterviewRound.ToolRequired.NONE);
        wrap.setTopicsCovered(new ArrayList<>());
        rounds.add(wrap);

        return rounds;
    }

    // ── Utility ───────────────────────────────────────────────
    private String truncate(String text, int maxLen) {
        if (text == null) return "";
        return text.length() > maxLen ? text.substring(0, maxLen) + "..." : text;
    }
}
