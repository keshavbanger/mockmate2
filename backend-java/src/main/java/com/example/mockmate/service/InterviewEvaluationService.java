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
public class InterviewEvaluationService {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;
    private final DSAProblemService dsaProblemService;
    private final SQLExecutionService sqlExecutionService;
    private final OpenRouterFallbackService openRouterFallbackService;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL    = "llama-3.3-70b-versatile";

    public TechInterviewReport evaluate(TechInterviewSession session) {
        TechInterviewReport report = new TechInterviewReport();
        report.setReportId(UUID.randomUUID().toString());
        report.setSessionId(session.getSessionId());
        report.setUserId(session.getUserId());
        report.setGeneratedAt(System.currentTimeMillis() / 1000);
        report.setCandidateProfile(session.getPlan().getCandidateProfile());

        InterviewPlanConfig config = session.getPlan().getConfig();
        report.setRoleLevel(config.getRoleLevel());
        report.setInterviewType(config.getInterviewType());
        report.setCompanyStyle(config.getCompanyStyle());
        report.setPreferredLanguage(config.getPreferredLanguage());

        long durationSec = (System.currentTimeMillis() / 1000) - session.getStartedAt();
        report.setInterviewDurationMinutes(durationSec / 60);

        // ── Compute per-category scores ───────────────────────
        Map<String, Integer> scoreByCategory = computeCategoryScores(session);
        report.setScoreByCategory(scoreByCategory);

        // ── Round weights ─────────────────────────────────────
        Map<String, Integer> weights = computeWeights(config.getRoleLevel(), config.getInterviewType());
        report.setCategoryWeights(weights);

        // ── Overall score (weighted average) ──────────────────
        int overallScore = computeWeightedScore(scoreByCategory, weights);
        report.setOverallScore(overallScore);

        // ── Hiring decision ───────────────────────────────────
        boolean dealBreaker = checkDealBreakers(session);
        report.setDealBreakerTriggered(dealBreaker);
        if (dealBreaker) {
            report.setHiringDecision(TechInterviewReport.HiringDecision.NO_HIRE);
            report.setHiringDecisionLabel("NO HIRE");
            report.setHiringDecisionReason("Deal breaker condition triggered.");
            report.setDealBreakerReason("Candidate could not demonstrate fundamental competency.");
        } else {
            TechInterviewReport.HiringDecision decision = scoreToDecision(overallScore);
            report.setHiringDecision(decision);
            report.setHiringDecisionLabel(decision.name().replace("_", " "));
            report.setHiringDecisionReason(decisionReason(decision, scoreByCategory));
        }

        // ── Radar data ────────────────────────────────────────
        report.setRadarData(buildRadarData(scoreByCategory));

        // ── Round summaries ───────────────────────────────────
        report.setRoundSummaries(buildRoundSummaries(session));

        // ── DSA reviews ───────────────────────────────────────
        report.setDsaReviews(buildDsaReviews(session));

        // ── SQL reviews ───────────────────────────────────────
        report.setSqlReviews(buildSqlReviews(session));

        // ── Full transcript ───────────────────────────────────
        report.setFullTranscript(session.getTurns() != null ? session.getTurns() : List.of());

        // ── Strengths & weaknesses (from Groq) ───────────────
        enrichWithGroq(report, session);

        // ── Company readiness ─────────────────────────────────
        report.setCompanyReadiness(buildCompanyReadiness(overallScore, scoreByCategory, config));

        // ── Next interview recommendation ─────────────────────
        report.setRetakeInWeeks(overallScore >= 70 ? "2-3" : overallScore >= 55 ? "3-4" : "4-6");
        report.setFocusBeforeRetake(buildFocusAreas(scoreByCategory));

        return report;
    }

    // ── Category Score Computation ────────────────────────────
    private Map<String, Integer> computeCategoryScores(TechInterviewSession session) {
        Map<String, Integer> scores = new LinkedHashMap<>();
        Map<String, List<Integer>> categoryTurnScores = new HashMap<>();

        if (session.getTurns() != null) {
            for (var turn : session.getTurns()) {
                String topic = turn.getTopicAssessed() != null ? turn.getTopicAssessed() : "General";
                String cat = topicToCategory(topic, session.getPlan());
                categoryTurnScores.computeIfAbsent(cat, k -> new ArrayList<>()).add(turn.getScore());
            }
        }

        categoryTurnScores.forEach((cat, turnScores) -> {
            int avg = (int) turnScores.stream().mapToInt(i -> i).average().orElse(0);
            scores.put(cat, avg);
        });

        // DSA from DSA attempts
        if (session.getDsaAttempts() != null && !session.getDsaAttempts().isEmpty()) {
            int dsaScore = (int) session.getDsaAttempts().values().stream()
                    .mapToInt(TechInterviewSession.DSAAttempt::getScore).average().orElse(0);
            scores.put("DSA", dsaScore);
        }

        // Defaults for missing categories
        scores.putIfAbsent("DSA", 0);
        scores.putIfAbsent("CS Theory", 0);
        scores.putIfAbsent("SQL", 0);
        scores.putIfAbsent("System Design", 0);
        scores.putIfAbsent("Communication", estimateCommunicationScore(session));
        scores.putIfAbsent("Project Knowledge", 0);

        return scores;
    }

    private String topicToCategory(String topic, InterviewPlan plan) {
        String lower = topic.toLowerCase();
        if (lower.contains("dsa") || lower.contains("algorithm") || lower.contains("complexity")) return "DSA";
        if (lower.contains("sql") || lower.contains("database") || lower.contains("query")) return "SQL";
        if (lower.contains("system design") || lower.contains("scalab") || lower.contains("architecture")) return "System Design";
        if (lower.contains("project") || lower.contains("experience") || lower.contains("built")) return "Project Knowledge";
        if (lower.contains("java") || lower.contains("spring") || lower.contains("oop") ||
            lower.contains("javascript") || lower.contains("react") || lower.contains("python")) return "CS Theory";
        return "CS Theory";
    }

    private int estimateCommunicationScore(TechInterviewSession session) {
        if (session.getTurns() == null || session.getTurns().isEmpty()) return 50;
        long nonEmpty = session.getTurns().stream()
                .filter(t -> t.getCandidateAnswer() != null && t.getCandidateAnswer().length() > 20)
                .count();
        return (int) Math.min(100, 40 + (nonEmpty * 5));
    }

    // ── Weights ───────────────────────────────────────────────
    private Map<String, Integer> computeWeights(String roleLevel, String interviewType) {
        Map<String, Integer> w = new LinkedHashMap<>();
        boolean isFrontend = "FRONTEND".equalsIgnoreCase(interviewType);
        boolean isSenior = roleLevel != null && (roleLevel.contains("2") || roleLevel.contains("3"));

        if (isFrontend) {
            w.put("DSA", 20); w.put("CS Theory", 35); w.put("SQL", 5);
            w.put("System Design", 15); w.put("Communication", 10); w.put("Project Knowledge", 15);
        } else if (isSenior) {
            w.put("DSA", 25); w.put("CS Theory", 20); w.put("SQL", 10);
            w.put("System Design", 30); w.put("Communication", 5); w.put("Project Knowledge", 10);
        } else {
            w.put("DSA", 30); w.put("CS Theory", 25); w.put("SQL", 20);
            w.put("System Design", 5); w.put("Communication", 10); w.put("Project Knowledge", 10);
        }
        return w;
    }

    private int computeWeightedScore(Map<String, Integer> scores, Map<String, Integer> weights) {
        int totalWeight = 0, weightedSum = 0;
        for (Map.Entry<String, Integer> e : weights.entrySet()) {
            int score  = scores.getOrDefault(e.getKey(), 0);
            int weight = e.getValue();
            weightedSum += score * weight;
            totalWeight += weight;
        }
        return totalWeight == 0 ? 0 : weightedSum / totalWeight;
    }

    // ── Deal Breakers ─────────────────────────────────────────
    private boolean checkDealBreakers(TechInterviewSession session) {
        Map<String, TechInterviewSession.DSAAttempt> attempts = session.getDsaAttempts();
        if (attempts == null || attempts.isEmpty()) return false;
        long allFailed = attempts.values().stream().filter(a -> a.getScore() < 20).count();
        return allFailed == attempts.size() && !attempts.isEmpty();
    }

    // ── Hiring Decision ───────────────────────────────────────
    private TechInterviewReport.HiringDecision scoreToDecision(int score) {
        if (score >= 85) return TechInterviewReport.HiringDecision.STRONG_HIRE;
        if (score >= 70) return TechInterviewReport.HiringDecision.HIRE;
        if (score >= 55) return TechInterviewReport.HiringDecision.BORDERLINE;
        if (score >= 40) return TechInterviewReport.HiringDecision.NO_HIRE;
        return TechInterviewReport.HiringDecision.STRONG_NO_HIRE;
    }

    private String decisionReason(TechInterviewReport.HiringDecision d, Map<String, Integer> scores) {
        return switch (d) {
            case STRONG_HIRE -> "Excellent across all categories. Strong DSA and CS fundamentals.";
            case HIRE -> "Good performance. Some minor gaps but overall competent.";
            case BORDERLINE -> "Moderate performance. Needs mentorship in key areas.";
            case NO_HIRE -> "Significant gaps in critical areas. Not ready for this role.";
            case STRONG_NO_HIRE -> "Fundamental CS gaps. Cannot proceed.";
        };
    }

    // ── Radar Data ────────────────────────────────────────────
    private TechInterviewReport.RadarData buildRadarData(Map<String, Integer> scores) {
        TechInterviewReport.RadarData r = new TechInterviewReport.RadarData();
        r.setDsaScore(scores.getOrDefault("DSA", 0));
        r.setCsTheoryScore(scores.getOrDefault("CS Theory", 0));
        r.setSqlScore(scores.getOrDefault("SQL", 0));
        r.setSystemDesignScore(scores.getOrDefault("System Design", 0));
        r.setCommunicationScore(scores.getOrDefault("Communication", 0));
        r.setProjectKnowledgeScore(scores.getOrDefault("Project Knowledge", 0));
        return r;
    }

    // ── Round Summaries ───────────────────────────────────────
    private List<TechInterviewReport.RoundSummary> buildRoundSummaries(TechInterviewSession session) {
        List<TechInterviewReport.RoundSummary> summaries = new ArrayList<>();
        for (TechInterviewSession.RoundState rs : session.getRoundStates()) {
            TechInterviewReport.RoundSummary s = new TechInterviewReport.RoundSummary();
            s.setRoundId(rs.getRoundId());
            s.setRoundName(rs.getRoundId());
            s.setScore(rs.getScore());
            s.setElapsedMinutes(rs.getElapsedMinutes());
            s.setSummary(rs.getSummary() != null ? rs.getSummary() : "Round completed.");
            summaries.add(s);
        }
        return summaries;
    }

    // ── DSA Reviews ───────────────────────────────────────────
    private List<TechInterviewReport.DSAReview> buildDsaReviews(TechInterviewSession session) {
        List<TechInterviewReport.DSAReview> reviews = new ArrayList<>();
        if (session.getDsaAttempts() == null) return reviews;
        for (var entry : session.getDsaAttempts().entrySet()) {
            String pid = entry.getKey();
            TechInterviewSession.DSAAttempt attempt = entry.getValue();
            DSAProblem fullProblem = dsaProblemService.getProblemFull(pid);

            TechInterviewReport.DSAReview review = new TechInterviewReport.DSAReview();
            review.setProblemId(pid);
            review.setCandidateCode(attempt.getFinalCode());
            review.setLanguage(attempt.getLanguage());
            review.setTestCasesPassed(attempt.getTestCasesPassed());
            review.setTotalTestCases(attempt.getTotalTestCases());
            review.setAllPassed(attempt.isAllPassed());
            review.setApproachQuality(attempt.getApproachQuality());
            review.setTimeComplexityAnswer(attempt.getTimeComplexityAnswer());
            review.setSpaceComplexityAnswer(attempt.getSpaceComplexityAnswer());
            review.setHintsUsed(attempt.getHintsUsed());
            review.setScore(attempt.getScore());
            review.setWhatMissed(attempt.getMissedPoints());

            if (fullProblem != null) {
                review.setProblemTitle(fullProblem.getTitle());
                review.setLeetcodeUrl(fullProblem.getLeetcodeUrl());
                review.setDifficulty(fullProblem.getDifficulty());
                review.setLeetcodeId(fullProblem.getLeetcodeId());
                if (fullProblem.getOptimalSolution() != null) {
                    review.setOptimalApproach(fullProblem.getOptimalSolution().getApproach());
                    review.setOptimalTimeComplexity(fullProblem.getOptimalSolution().getTimeComplexity());
                    review.setOptimalSpaceComplexity(fullProblem.getOptimalSolution().getSpaceComplexity());
                    review.setModelSolution(fullProblem.getOptimalSolution().getCode());
                }
            }
            reviews.add(review);
        }
        return reviews;
    }

    // ── SQL Reviews ───────────────────────────────────────────
    private List<TechInterviewReport.SQLReview> buildSqlReviews(TechInterviewSession session) {
        List<TechInterviewReport.SQLReview> reviews = new ArrayList<>();
        if (session.getSqlAttempts() == null) return reviews;
        for (var attempt : session.getSqlAttempts()) {
            TechInterviewReport.SQLReview r = new TechInterviewReport.SQLReview();
            r.setProblemId(attempt.getProblemId());
            r.setCandidateQuery(attempt.getFinalQuery());
            r.setCorrect(attempt.isCorrect());
            r.setScore(attempt.getScore());

            // question/correctQuery/feedback were declared on the model but
            // never populated — the report showed a query and a score with
            // no question context and no reference answer to compare against.
            SQLProblem problemDef = sqlExecutionService.getProblem(attempt.getProblemId());
            if (problemDef != null) {
                r.setQuestion(problemDef.getQuestion());
                r.setCorrectQuery(problemDef.getExpectedQuery());
            }
            r.setFeedback(attempt.isCorrect()
                    ? "Query returned the correct result."
                    : "Query ran but didn't return the expected result — compare against the reference query.");
            reviews.add(r);
        }
        return reviews;
    }

    // ── Company Readiness ─────────────────────────────────────
    private List<TechInterviewReport.CompanyReadiness> buildCompanyReadiness(
            int overall, Map<String, Integer> scores, InterviewPlanConfig config) {
        List<TechInterviewReport.CompanyReadiness> list = new ArrayList<>();
        int dsaScore = scores.getOrDefault("DSA", 0);
        int sdScore  = scores.getOrDefault("System Design", 0);

        String[][] companies = {
            {"Google",    String.valueOf(Math.min(100, (int)(overall * 0.8 + dsaScore * 0.2))), "Google values exceptional DSA and system design."},
            {"Amazon",    String.valueOf(Math.min(100, (int)(overall * 0.85 + 15))),             "Amazon focuses on leadership principles + solid DSA."},
            {"Microsoft", String.valueOf(Math.min(100, (int)(overall * 0.9))),                   "Microsoft values well-rounded engineering skills."},
            {"Adobe",     String.valueOf(Math.min(100, (int)(overall * 0.95))),                  "Adobe focuses on coding + OOP design."},
            {"Startup",   String.valueOf(Math.min(100, (int)(overall + 10))),                    "Startups value practical skills and speed."}
        };

        for (String[] c : companies) {
            TechInterviewReport.CompanyReadiness cr = new TechInterviewReport.CompanyReadiness();
            cr.setCompany(c[0]);
            cr.setReadinessPercent(Math.min(100, Integer.parseInt(c[1])));
            cr.setAssessment(c[2]);
            list.add(cr);
        }
        return list;
    }

    private List<String> buildFocusAreas(Map<String, Integer> scores) {
        return scores.entrySet().stream()
                .filter(e -> e.getValue() < 60)
                .sorted(Map.Entry.comparingByValue())
                .map(e -> e.getKey())
                .limit(3)
                .toList();
    }

    // ── Groq Enrichment ───────────────────────────────────────
    private void enrichWithGroq(TechInterviewReport report, TechInterviewSession session) {
        try {
            String prompt = """
Based on this technical interview session, generate:
1. Top 5 specific strengths with evidence from the transcript
2. Top 5 specific weaknesses with actionable fixes
3. A personalized 30-day study plan (week1, week2, week3, week4)
4. LeetCode lists to complete, topics to revise, projects to build, resource links

Session summary:
- Role: %s, Level: %s, Duration: %d min
- Overall score: %d
- Category scores: %s
- Number of turns: %d
- DSA problems attempted: %d

Return JSON:
{
  "strengths": [{"strength":"string","evidence":"string","roundName":"string"}],
  "weaknesses": [{"weakness":"string","evidence":"string","fix":"string","resources":"string"}],
  "studyPlan": {"week1":"string","week2":"string","week3":"string","week4":"string",
    "leetcodeListsToComplete":["string"],"topicsToRevise":["string"],
    "projectsToBuild":["string"],"resourceLinks":["string"]}
}
""".formatted(
                    report.getInterviewType(), report.getRoleLevel(),
                    report.getInterviewDurationMinutes(), report.getOverallScore(),
                    report.getScoreByCategory(), session.getTurns().size(),
                    session.getDsaAttempts().size()
            );

            String content = callGroqWithFallback(prompt);
            if (content == null) {
                throw new RuntimeException("All Groq models/attempts and the OpenRouter fallback are exhausted for report enrichment");
            }

            var enriched = objectMapper.readTree(content);

            if (enriched.has("strengths")) {
                report.setTopStrengths(objectMapper.readValue(
                        enriched.get("strengths").toString(),
                        objectMapper.getTypeFactory().constructCollectionType(
                                List.class, TechInterviewReport.StrengthItem.class)));
            }
            if (enriched.has("weaknesses")) {
                report.setTopWeaknesses(objectMapper.readValue(
                        enriched.get("weaknesses").toString(),
                        objectMapper.getTypeFactory().constructCollectionType(
                                List.class, TechInterviewReport.WeaknessItem.class)));
            }
            if (enriched.has("studyPlan")) {
                report.setStudyPlan(objectMapper.treeToValue(
                        enriched.get("studyPlan"), TechInterviewReport.StudyPlan.class));
            }
        } catch (Exception e) {
            log.warn("Groq enrichment failed, using defaults: {}", e.getMessage());
            report.setTopStrengths(List.of());
            report.setTopWeaknesses(List.of());
            TechInterviewReport.StudyPlan sp = new TechInterviewReport.StudyPlan();
            sp.setWeek1("Review weak areas identified in the interview.");
            sp.setWeek2("Practice DSA problems on LeetCode (easy → medium).");
            sp.setWeek3("Build a small project demonstrating core skills.");
            sp.setWeek4("Do 2-3 mock interviews and apply to target companies.");
            sp.setLeetcodeListsToComplete(List.of("NeetCode 150", "Blind 75"));
            sp.setResourceLinks(List.of("https://neetcode.io", "https://leetcode.com"));
            report.setStudyPlan(sp);
        }
    }

    // This used to be a single inline Groq call with no retry and no
    // fallback model — the ONLY thing standing between a real, evidence-based
    // report (strengths/weaknesses/study plan) and generic placeholder text
    // ("Review weak areas...", "NeetCode 150") was one transient network blip
    // or rate limit, on a call that only ever fires once per interview.
    // Mirrors the retry/fallback pattern already used in AIInterviewerService
    // and GroqATSService.
    private static final List<String> EVAL_MODELS_TO_TRY = List.of(MODEL, "llama-3.1-8b-instant");

    // Returns the extracted message content (not the raw API envelope) so
    // both the Groq path and the OpenRouter fallback path hand the caller the
    // same shape.
    private String callGroqWithFallback(String prompt) {
        for (String modelName : EVAL_MODELS_TO_TRY) {
            for (int attempt = 1; attempt <= 2; attempt++) {
                try {
                    Map<String, Object> body = Map.of(
                            "model", modelName,
                            "temperature", 0.5,
                            "max_tokens", 2048,
                            "response_format", Map.of("type", "json_object"),
                            "messages", List.of(Map.of("role", "user", "content", prompt))
                    );
                    String raw = webClientBuilder.build()
                            .post().uri(GROQ_URL)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + groqApiKey)
                            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                            .bodyValue(body)
                            .retrieve()
                            .bodyToMono(String.class)
                            .timeout(java.time.Duration.ofSeconds(30))
                            .block();
                    if (raw != null && !raw.isBlank()) {
                        JsonNode root = objectMapper.readTree(raw);
                        String content = root.path("choices").get(0).path("message").path("content").asText();
                        if (content != null && !content.isBlank()) return content;
                    }
                } catch (Exception e) {
                    log.warn("Report enrichment Groq call failed with model {} attempt {}/2: {}",
                            modelName, attempt, e.getMessage());
                    if (attempt < 2) {
                        try { Thread.sleep(700); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); return null; }
                    }
                }
            }
        }

        log.warn("All Groq models failed for report enrichment — trying OpenRouter as last resort");
        return openRouterFallbackService.complete(
                "You are a technical interview report generator. Return ONLY valid JSON matching the schema requested by the user. No markdown, no code fences, no explanation.",
                prompt, 2048);
    }
}
