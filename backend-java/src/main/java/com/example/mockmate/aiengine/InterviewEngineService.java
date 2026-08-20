package com.example.mockmate.aiengine;

import com.example.mockmate.service.SessionStoreService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static com.example.mockmate.service.ReportGeneratorService.castMap;
import static com.example.mockmate.service.ReportGeneratorService.castMapList;
import static com.example.mockmate.service.ReportGeneratorService.castStringList;

/**
 * Orchestrates the AI Interview Engine (beta, no Tavus) — adaptive redesign.
 *
 * Old behavior: one LLM call per turn, told "generate the next of 7
 * hardcoded questions." New behavior: the candidate's answer is evaluated
 * and an interview strategy decided (FOLLOW_UP / MOVE_TO_NEW_AREA /
 * DEEPER_NEW_AREA / END) before a single next question is generated for
 * whatever area that decision points at. No fixed question count, no
 * hardcoded topic names — areas are seeded from the candidate's own parsed
 * resume (skills/job titles) and grow as JD content and the candidate's own
 * answers surface new ones.
 *
 * Reuses the existing SessionStoreService (the same schemaless, JSON-file-
 * backed session map the Tavus flow and Technical Interview Lab both use).
 * Turns keep the same {role, text, question_index, question_text,
 * turn_type} shape ReportGeneratorService.buildAnswerMap already expects,
 * and — critically — this service still writes the session's "questions"
 * key (a flat, ever-growing list of every question actually asked, intro
 * included) because ReportGeneratorService.generateEnhancedReport reads
 * that exact key directly; renaming it would have silently emptied every
 * report generated through this engine.
 *
 * REPEAT_REQUEST/CLARIFICATION_REQUEST candidate turns are saved with role
 * "candidate_meta" (not "candidate") specifically so buildAnswerMap's
 * exact-match role check skips them — they stay in the raw transcript for
 * completeness but can never be merged into a scored answer, and (per this
 * redesign) never touch follow-up counts or area status either.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewEngineService {

    private final LlmProvider llmProvider;
    private final TurnClassifierService turnClassifierService;
    private final SessionStoreService sessionStoreService;
    private final ObjectMapper objectMapper;

    private static final int MAX_REPEATS_PER_QUESTION = 3;
    private static final int MAX_FOLLOW_UPS_PER_AREA = 2;
    // Raised from 5 — a real ~25-45 min interview shouldn't be considered
    // "possibly done" after just 5 primary questions. This is a floor, not
    // a target: the model is guided (see buildEvaluateSystemPrompt) to end
    // based on genuine coverage/depth, not a count.
    private static final int MIN_PRIMARY_QUESTIONS_BEFORE_END = 8;
    private static final double MIN_DURATION_FRACTION_BEFORE_END = 0.5;
    private static final int MAX_SAFETY_TURNS = 60; // bug/infinite-loop guard only, per spec §20
    private static final int DEFAULT_DURATION_MINUTES = 25;
    private static final int MAX_SEEDED_AREAS = 15;

    // Sustained non-engagement (B2) — distinct from both the single-answer
    // refusal rule and area starvation. Counted GLOBALLY across the whole
    // interview, not per area.
    private static final int NON_ANSWER_THRESHOLD = 3;
    private static final int POST_CHECK_NON_ANSWER_THRESHOLD = 3;

    /** Status for an interview abandoned mid-way because the candidate never engaged — deliberately NOT "completed". */
    public static final String STATUS_NO_ENGAGEMENT = "ended_due_to_no_engagement";

    /** Neutral area label used when no candidate-specific area is left to explore (A4). */
    private static final String AREA_GENERAL = "general";

    private static final String FALLBACK_INTRO_QUESTION = "Please introduce yourself and share a brief overview of your background.";
    private static final String CLOSING_MESSAGE = "That concludes the interview. Excellent work! Please click End Interview to generate your performance report.";
    private static final String ENGAGEMENT_CHECK_MESSAGE = "It looks like the last few answers may not have come through — there might be a microphone or connection issue on your end. Are you still there, and would you like to continue the interview?";
    private static final String NO_ENGAGEMENT_CLOSING = "We'll stop here for now — the answers don't seem to be coming through. Please check your microphone and feel free to start a new interview when you're ready.";

    private static final List<Pattern> REFUSAL_PATTERNS = List.of(
            "i don'?t know", "i do not know", "not sure", "no idea",
            "skip (this|that|it)", "pass on (this|that)", "no comment",
            "can'?t answer", "cannot answer", "no answer"
    ).stream().map(p -> Pattern.compile(p, Pattern.CASE_INSENSITIVE)).toList();

    // ── Start ────────────────────────────────────────────────────────────

    /**
     * @param config interviewType/difficulty/language/jobDescription/durationMinutes, written to the
     *               session here. This endpoint is the SINGLE entry point for interview configuration —
     *               the beta flow deliberately no longer calls /api/generate-questions first, so there is
     *               exactly one code path from /start through /message to completion (B1.2). That old call
     *               seeded a throwaway one-element "questions" list that start() immediately overwrote.
     */
    public Map<String, Object> start(String sessionId, Map<String, Object> session, Map<String, Object> config) {
        if (!llmProvider.isAvailable()) {
            return errorResult("AI_PROVIDER_UNAVAILABLE", "The AI interviewer is temporarily unavailable.");
        }

        if (config != null) {
            putIfPresent(session, config, "interviewType", "interview_type");
            putIfPresent(session, config, "difficulty", "difficulty");
            putIfPresent(session, config, "language", "language");
            putIfPresent(session, config, "jobDescription", "job_description");
        }
        Integer durationMinutes = (config != null && config.get("durationMinutes") instanceof Number n)
                ? n.intValue() : null;

        Map<String, Object> resumeData = castMap(session.get("resume_data"));

        // Areas seeded ONLY from this candidate's own parsed resume — no
        // hardcoded topic names anywhere. JD (if present) is not pre-parsed
        // into areas; it's passed as raw context to the evaluate/generate
        // calls so the model reasons about JD-vs-resume gaps live (spec §25).
        List<Map<String, Object>> interviewAreas = new ArrayList<>();
        for (String s : castStringList(resumeData.get("skills"))) {
            if (s != null && !s.isBlank()) addAreaIfAbsent(interviewAreas, s.trim(), "RESUME", "HIGH");
        }
        for (String t : castStringList(resumeData.get("jobTitles"))) {
            if (t != null && !t.isBlank()) addAreaIfAbsent(interviewAreas, t.trim(), "RESUME", "MEDIUM");
        }
        if (interviewAreas.size() > MAX_SEEDED_AREAS) {
            interviewAreas = new ArrayList<>(interviewAreas.subList(0, MAX_SEEDED_AREAS));
        }

        String greeting = buildPersonalizedIntro(resumeData);

        List<Map<String, Object>> turns = new ArrayList<>();
        turns.add(aiTurn(greeting, "AI_MESSAGE"));

        List<String> questions = new ArrayList<>();
        questions.add(greeting);

        int effectiveDuration = (durationMinutes != null && durationMinutes > 0) ? durationMinutes : DEFAULT_DURATION_MINUTES;
        long now = System.currentTimeMillis();

        session.put("engine", "groq-beta-adaptive");
        session.put("interview_areas", interviewAreas);
        session.put("current_area", "introduction");
        session.put("current_question_type", "PRIMARY");
        session.put("follow_up_count_current_area", 0);
        session.put("primary_questions_asked", 1); // the personalized intro counts as the first primary question
        session.put("interview_duration_minutes", effectiveDuration);
        session.put("interview_started_at", now);
        // Deliberately NOT seeded with a null placeholder — SessionStoreService
        // copies session data into a ConcurrentHashMap, which rejects null
        // values outright, so a `put(key, null)` here throws NPE and takes down
        // every single /start call. Absent-until-first-evaluation is correct
        // anyway; readers use getOrDefault.
        session.put("fallback_used_count", 0);
        session.put("consecutive_non_answer_count", 0);
        session.put("engagement_check_issued", false);
        session.put("questions", questions); // existing key — ReportGeneratorService.generateEnhancedReport reads this directly
        session.put("turns", turns);
        session.put("last_ai_message", greeting);
        session.put("repeat_count_current_question", 0);
        // ReportGeneratorService.generateEnhancedReport computes duration from
        // start_time/end_time (seconds) — the old fixed-question engine never
        // set start_time either, which silently produced a wrong/huge
        // duration in every report generated through this engine; fixing it
        // here while touching this code.
        session.put("start_time", now / 1000.0);
        session.put("status", "active");
        sessionStoreService.saveSession(sessionId, session);

        log.info("[AI Engine] Interview started: sessionId={} seededAreas={} durationMin={}", sessionId, interviewAreas.size(), effectiveDuration);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("response", greeting);
        result.put("questionsAsked", 1);
        result.put("area", "introduction");
        result.put("questionType", "PRIMARY");
        result.put("turnType", "AI_MESSAGE");
        result.put("status", "active");
        return result;
    }

    // ── Message handling ────────────────────────────────────────────────

    public Map<String, Object> handleMessage(String sessionId, Map<String, Object> session, String message) {
        List<Map<String, Object>> turns = new ArrayList<>(castMapList(session.getOrDefault("turns", new ArrayList<>())));
        List<String> questions = new ArrayList<>(castStringList(session.getOrDefault("questions", new ArrayList<>())));
        List<Map<String, Object>> interviewAreas = new ArrayList<>(castMapList(session.getOrDefault("interview_areas", new ArrayList<>())));
        String currentArea = (String) session.getOrDefault("current_area", "introduction");
        int followUpCount = ((Number) session.getOrDefault("follow_up_count_current_area", 0)).intValue();
        int primaryQuestionsAsked = ((Number) session.getOrDefault("primary_questions_asked", 0)).intValue();
        int durationMinutes = ((Number) session.getOrDefault("interview_duration_minutes", DEFAULT_DURATION_MINUTES)).intValue();
        long startedAt = ((Number) session.getOrDefault("interview_started_at", System.currentTimeMillis())).longValue();
        int fallbackUsedCount = ((Number) session.getOrDefault("fallback_used_count", 0)).intValue();

        TurnType turnType = turnClassifierService.classify(message);
        log.info("[AI Engine] sessionId={} turnType={} currentArea={} followUpCount={} primaryQuestionsAsked={}",
                sessionId, turnType, currentArea, followUpCount, primaryQuestionsAsked);

        int questionIndexBeingAnswered = Math.max(0, questions.size() - 1);
        Map<String, Object> result;

        switch (turnType) {
            case REPEAT_REQUEST -> {
                turns.add(candidateMetaTurn(message, "REPEAT_REQUEST", questionIndexBeingAnswered));
                int repeatCount = ((Number) session.getOrDefault("repeat_count_current_question", 0)).intValue() + 1;

                String response;
                if (repeatCount > MAX_REPEATS_PER_QUESTION) {
                    log.info("[AI Engine] Repeat abuse guard triggered: sessionId={} repeatCount={}", sessionId, repeatCount);
                    String lastQuestion = (String) session.getOrDefault("last_ai_message", "");
                    String rephrased = llmProvider.generateResponse(
                            "Rephrase the following interview question in different words, keeping the same meaning. Reply with ONLY the rephrased question.",
                            "", lastQuestion);
                    response = "Let's move forward — I'll rephrase this one: "
                            + (rephrased != null && !rephrased.isBlank() ? rephrased : lastQuestion);
                    repeatCount = 0;
                } else {
                    response = (String) session.getOrDefault("last_ai_message", "");
                }
                turns.add(aiTurn(response, "AI_MESSAGE"));
                session.put("last_ai_message", response);
                session.put("repeat_count_current_question", repeatCount);

                result = engineResult(true, response, questions.size(), "REPEAT_REQUEST", "active", currentArea,
                        (String) session.get("current_question_type"));
            }
            case CLARIFICATION_REQUEST -> {
                turns.add(candidateMetaTurn(message, "CLARIFICATION_REQUEST", questionIndexBeingAnswered));

                String lastQuestion = (String) session.getOrDefault("last_ai_message", "");
                String clarification = llmProvider.generateResponse(
                        buildClarificationSystemPrompt(session), "",
                        "Current question: " + lastQuestion + "\n\nCandidate's clarification request: " + message);
                String response = (clarification != null && !clarification.isBlank())
                        ? clarification
                        : "Sure — to clarify: " + lastQuestion;
                turns.add(aiTurn(response, "AI_MESSAGE"));
                session.put("last_ai_message", response);

                result = engineResult(true, response, questions.size(), "CLARIFICATION_REQUEST", "active", currentArea,
                        (String) session.get("current_question_type"));
            }
            default -> result = handleAnswer(sessionId, session, message, turns, questions, interviewAreas,
                    currentArea, followUpCount, primaryQuestionsAsked, durationMinutes, startedAt, fallbackUsedCount,
                    questionIndexBeingAnswered);
        }

        session.put("turns", turns);
        sessionStoreService.saveSession(sessionId, session);
        return result;
    }

    private Map<String, Object> handleAnswer(String sessionId, Map<String, Object> session, String message,
            List<Map<String, Object>> turns, List<String> questions, List<Map<String, Object>> interviewAreas,
            String currentArea, int followUpCount, int primaryQuestionsAsked, int durationMinutes, long startedAt,
            int fallbackUsedCount, int questionIndexBeingAnswered) {

        Map<String, Object> candidateTurn = new HashMap<>();
        candidateTurn.put("role", "candidate");
        candidateTurn.put("text", message);
        candidateTurn.put("question_index", questionIndexBeingAnswered);
        candidateTurn.put("question_text", (String) session.getOrDefault("last_ai_message", ""));
        candidateTurn.put("turn_type", "ANSWER");
        candidateTurn.put("timestamp_ms", System.currentTimeMillis());
        turns.add(candidateTurn);

        // ── Evaluate (skipping the LLM entirely for refusal/empty answers — A2) ──
        int consecutiveNonAnswers = ((Number) session.getOrDefault("consecutive_non_answer_count", 0)).intValue();
        boolean engagementCheckIssued = Boolean.TRUE.equals(session.get("engagement_check_issued"));

        AnswerEvaluation evaluation;
        if (isNonAnswer(message)) {
            consecutiveNonAnswers++;
            evaluation = new AnswerEvaluation();
            evaluation.setAnswerQuality("NOT_ANSWERED");
            evaluation.setRecommendedAction("MOVE_TO_NEW_AREA");
            evaluation.setReason("Candidate did not provide a substantive answer.");
            markAreaStatus(interviewAreas, currentArea, "NOT_ANSWERED");
        } else {
            evaluation = evaluateAndStrategize(session, interviewAreas, currentArea, followUpCount,
                    (String) session.getOrDefault("last_ai_message", ""), message, primaryQuestionsAsked,
                    durationMinutes, startedAt);
            // The LLM evaluator can also independently judge an answer to be
            // no real attempt (e.g. off-topic rambling the deterministic
            // check below can't catch) — that counts toward disengagement too.
            if ("NOT_ANSWERED".equalsIgnoreCase(evaluation.getAnswerQuality())) {
                consecutiveNonAnswers++;
                markAreaStatus(interviewAreas, currentArea, "NOT_ANSWERED");
            } else {
                consecutiveNonAnswers = 0; // any genuine attempt, even a weak one, resets the streak
            }
            if (evaluation.getNewAreaDiscovered() != null && !evaluation.getNewAreaDiscovered().isBlank()) {
                addAreaIfAbsent(interviewAreas, evaluation.getNewAreaDiscovered().trim(), "CANDIDATE_ANSWER", "MEDIUM");
            }
        }
        session.put("consecutive_non_answer_count", consecutiveNonAnswers);
        session.put("last_answer_evaluation", evaluationToMap(evaluation));

        // ── Sustained non-engagement (B2) — checked BEFORE area selection so a
        // disengaged candidate gets a check-in, never a new (harder) question.
        int nonAnswerLimit = engagementCheckIssued ? POST_CHECK_NON_ANSWER_THRESHOLD : NON_ANSWER_THRESHOLD;
        if (consecutiveNonAnswers >= nonAnswerLimit) {
            if (!engagementCheckIssued) {
                log.info("[AI Engine] Sustained non-engagement ({} consecutive) — issuing ENGAGEMENT_CHECK. sessionId={}",
                        consecutiveNonAnswers, sessionId);
                turns.add(aiTurn(ENGAGEMENT_CHECK_MESSAGE, "ENGAGEMENT_CHECK"));
                session.put("engagement_check_issued", true);
                session.put("consecutive_non_answer_count", 0); // give them a clean slate to re-engage
                session.put("last_ai_message", ENGAGEMENT_CHECK_MESSAGE);
                session.put("interview_areas", interviewAreas);
                // Deliberately NOT added to `questions` and NOT counted as a
                // primary/follow-up — it isn't an interview question.
                return engineResult(true, ENGAGEMENT_CHECK_MESSAGE, questions.size(), "ENGAGEMENT_CHECK", "active",
                        currentArea, "ENGAGEMENT_CHECK");
            }
            logEndDecision(sessionId, "SUSTAINED_NON_ENGAGEMENT", primaryQuestionsAsked, elapsedMinutes(startedAt));
            turns.add(aiTurn(NO_ENGAGEMENT_CLOSING, "AI_MESSAGE"));
            session.put("last_ai_message", NO_ENGAGEMENT_CLOSING);
            session.put("status", STATUS_NO_ENGAGEMENT);
            session.put("interview_areas", interviewAreas);
            session.put("questions", questions);
            return engineResult(true, NO_ENGAGEMENT_CLOSING, questions.size(), "ANSWER", STATUS_NO_ENGAGEMENT,
                    currentArea, "CLOSING");
        }

        String decision = evaluation.getRecommendedAction();
        if (decision == null) decision = "MOVE_TO_NEW_AREA";

        // ── Deterministic overrides, in order (never trust the LLM's raw decision alone) ──
        if ("FOLLOW_UP".equals(decision) && followUpCount >= MAX_FOLLOW_UPS_PER_AREA) {
            log.info("[AI Engine] Follow-up cap reached for area '{}' (sessionId={}) — forcing MOVE_TO_NEW_AREA", currentArea, sessionId);
            decision = "MOVE_TO_NEW_AREA";
        }

        long elapsedMinutes = elapsedMinutes(startedAt);
        int viableOtherAreas = countViableAreas(interviewAreas, currentArea);
        String endReason = null; // set by whichever condition actually terminates the interview
        boolean thinContext = viableOtherAreas == 0 && primaryQuestionsAsked >= 3;

        if ("END".equals(decision) && primaryQuestionsAsked < MIN_PRIMARY_QUESTIONS_BEFORE_END
                && elapsedMinutes < durationMinutes * MIN_DURATION_FRACTION_BEFORE_END && !thinContext) {
            log.info("[AI Engine] END requested too early (primary={}, elapsedMin={}, sessionId={}) — forcing MOVE_TO_NEW_AREA",
                    primaryQuestionsAsked, elapsedMinutes, sessionId);
            decision = "MOVE_TO_NEW_AREA";
        }

        if ("MOVE_TO_NEW_AREA".equals(decision) && viableOtherAreas == 0) {
            // The seed area list (skills/job titles from the resume — see
            // start()) is finite, typically 7-12 entries, and every
            // MOVE_TO_NEW_AREA permanently retires one. Running out of that
            // list is NOT the same as running out of things worth asking —
            // a real interviewer keeps going (different angle on a known
            // skill, a general competency for the role, something from the
            // JD). Ask the model for one more area before ever considering
            // this a reason to end; only fall back to the floor-gated end
            // below if that proposal itself fails outright.
            String proposedArea = proposeNewArea(session, interviewAreas);
            if (proposedArea != null && !proposedArea.isBlank()) {
                log.info("[AI Engine] Area pool exhausted — proposed new area '{}'. sessionId={}", proposedArea, sessionId);
                addAreaIfAbsent(interviewAreas, proposedArea, "GENERATED", "MEDIUM");
                viableOtherAreas = 1;
            } else if (primaryQuestionsAsked >= MIN_PRIMARY_QUESTIONS_BEFORE_END
                    || elapsedMinutes >= durationMinutes * MIN_DURATION_FRACTION_BEFORE_END) {
                session.put("ended_early_thin_context", true);
                decision = "END";
                endReason = "AREA_STARVATION";
            }
            // else: neither a new area nor the floor — fall through to
            // generateNextQuestion() with targetArea=null, which uses the
            // interview-type-appropriate fallback rather than ending.
        }

        long totalTurns = turns.size();
        if (totalTurns > MAX_SAFETY_TURNS) {
            log.warn("[AI Engine] Safety cap of {} turns exceeded (sessionId={}) — forcing END", MAX_SAFETY_TURNS, sessionId);
            decision = "END";
            endReason = "MAX_SAFETY_TURNS";
        }

        if ("END".equals(decision)) {
            if (endReason == null) endReason = "MODEL_DECISION";
            logEndDecision(sessionId, endReason, primaryQuestionsAsked, elapsedMinutes);
            markAreaStatus(interviewAreas, currentArea, "EXPLORED");
            turns.add(aiTurn(CLOSING_MESSAGE, "AI_MESSAGE"));
            session.put("last_ai_message", CLOSING_MESSAGE);
            session.put("status", "completed");
            session.put("end_reason", endReason);
            session.put("interview_areas", interviewAreas);
            session.put("questions", questions);
            return engineResult(true, CLOSING_MESSAGE, questions.size(), "ANSWER", "completed", currentArea, "CLOSING");
        }

        boolean isFollowUp = "FOLLOW_UP".equals(decision) || "DEEPER_NEW_AREA".equals(decision);
        String targetArea;
        if (isFollowUp) {
            targetArea = currentArea;
            followUpCount++;
            markAreaStatus(interviewAreas, currentArea, "PARTIALLY_EXPLORED");
        } else {
            markAreaStatus(interviewAreas, currentArea, "EXPLORED");
            targetArea = pickNextArea(interviewAreas, currentArea);
            followUpCount = 0;
            primaryQuestionsAsked++;
        }

        GeneratedQuestion generated = generateNextQuestion(session, targetArea, isFollowUp, message, evaluation,
                questions, consecutiveNonAnswers);
        String nextQuestion = resolveQuestionText(session, generated, questions, targetArea, fallbackUsedCount);
        if (generated == null || generated.getQuestion() == null
                || isDuplicateQuestion(generated.getQuestion(), questions)
                || !nextQuestion.equals(generated.getQuestion())) {
            // resolveQuestionText already regenerated/fell back — only bump
            // the fallback counter when we actually ended up using a canned
            // fallback line (i.e. nothing usable came back at all).
            if (generated == null || generated.getQuestion() == null || generated.getQuestion().isBlank()) {
                fallbackUsedCount++;
            }
        }

        questions.add(nextQuestion);
        turns.add(aiTurn(nextQuestion, "AI_MESSAGE"));
        if (targetArea != null) {
            markAreaStatus(interviewAreas, targetArea, "PARTIALLY_EXPLORED");
        }

        // targetArea is legitimately null on the area-starvation path (A4) —
        // but a null value cannot be stored (ConcurrentHashMap, see start()),
        // so it's recorded under a neutral label instead.
        session.put("current_area", targetArea != null ? targetArea : AREA_GENERAL);
        session.put("current_question_type", isFollowUp ? "FOLLOW_UP" : "PRIMARY");
        session.put("follow_up_count_current_area", followUpCount);
        session.put("primary_questions_asked", primaryQuestionsAsked);
        session.put("questions", questions);
        session.put("interview_areas", interviewAreas);
        session.put("last_ai_message", nextQuestion);
        session.put("fallback_used_count", fallbackUsedCount);

        return engineResult(true, nextQuestion, questions.size(), "ANSWER", "active", targetArea,
                isFollowUp ? "FOLLOW_UP" : "PRIMARY");
    }

    public Map<String, Object> end(String sessionId, Map<String, Object> session) {
        session.put("status", "completed");
        session.put("end_time", System.currentTimeMillis() / 1000.0);
        sessionStoreService.saveSession(sessionId, session);
        log.info("[AI Engine] Interview ended: sessionId={}", sessionId);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("session_id", sessionId);
        result.put("status", "completed");
        return result;
    }

    // ── Structured LLM calls ────────────────────────────────────────────

    private AnswerEvaluation evaluateAndStrategize(Map<String, Object> session, List<Map<String, Object>> interviewAreas,
            String currentArea, int followUpCount, String lastQuestion, String candidateAnswer,
            int primaryQuestionsAsked, int durationMinutes, long startedAt) {
        String systemPrompt = buildEvaluateSystemPrompt(session, interviewAreas, currentArea, followUpCount,
                primaryQuestionsAsked, durationMinutes, startedAt);
        String userPrompt = """
                Last question asked: %s

                Candidate's answer: %s

                Evaluate this answer and decide the interview strategy. Return ONLY the JSON object described in the system prompt.
                """.formatted(lastQuestion, candidateAnswer);

        String raw = llmProvider.generateJson(systemPrompt, userPrompt, 700);
        AnswerEvaluation evaluation = parseEvaluation(raw);
        if (evaluation == null) {
            String retryPrompt = userPrompt + "\n\nYour previous response was not valid JSON matching the required schema. Return ONLY a valid JSON object, nothing else.";
            raw = llmProvider.generateJson(systemPrompt, retryPrompt, 700);
            evaluation = parseEvaluation(raw);
        }
        if (evaluation == null) {
            log.warn("[AI Engine] Evaluate+strategize call failed/malformed twice — defaulting to MOVE_TO_NEW_AREA");
            evaluation = new AnswerEvaluation();
            evaluation.setAnswerQuality("MEDIUM");
            evaluation.setRecommendedAction("MOVE_TO_NEW_AREA");
            evaluation.setReason("Evaluation unavailable — defaulting to moving the interview forward.");
        }
        return evaluation;
    }

    private AnswerEvaluation parseEvaluation(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            AnswerEvaluation e = objectMapper.readValue(raw, AnswerEvaluation.class);
            if (e.getRecommendedAction() == null) return null;
            String action = e.getRecommendedAction().trim().toUpperCase();
            if (!Set.of("FOLLOW_UP", "MOVE_TO_NEW_AREA", "DEEPER_NEW_AREA", "END").contains(action)) return null;
            e.setRecommendedAction(action);
            return e;
        } catch (Exception ex) {
            log.warn("[AI Engine] Failed to parse evaluation JSON: {}", ex.getMessage());
            return null;
        }
    }

    private GeneratedQuestion generateNextQuestion(Map<String, Object> session, String targetArea, boolean isFollowUp,
            String candidateLastAnswer, AnswerEvaluation evaluation, List<String> questionsAsked, int consecutiveNonAnswers) {
        if (targetArea == null) {
            return null; // area-starvation path — resolveQuestionText() handles the fallback
        }
        String systemPrompt = buildQuestionGenSystemPrompt(session, targetArea, isFollowUp, evaluation, questionsAsked,
                consecutiveNonAnswers);
        String userPrompt = """
                Candidate's last answer: %s

                What is the single best next question to ask this candidate right now? Return ONLY the JSON object described in the system prompt.
                """.formatted(candidateLastAnswer);

        String raw = llmProvider.generateJson(systemPrompt, userPrompt, 400);
        GeneratedQuestion q = parseGeneratedQuestion(raw);
        if (q == null || isDuplicateQuestion(q.getQuestion(), questionsAsked)) {
            String avoidNote = q != null ? "\n\nThat question was too similar to one already asked (\"" + q.getQuestion() + "\") — generate a genuinely different question." : "\n\nYour previous response was not valid JSON. Return ONLY a valid JSON object.";
            raw = llmProvider.generateJson(systemPrompt, userPrompt + avoidNote, 400);
            GeneratedQuestion retry = parseGeneratedQuestion(raw);
            if (retry != null && !isDuplicateQuestion(retry.getQuestion(), questionsAsked)) {
                q = retry;
            } else if (q == null) {
                q = retry;
            }
        }
        return q;
    }

    private GeneratedQuestion parseGeneratedQuestion(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            GeneratedQuestion q = objectMapper.readValue(raw, GeneratedQuestion.class);
            if (q.getQuestion() == null || q.getQuestion().isBlank()) return null;
            return q;
        } catch (Exception e) {
            log.warn("[AI Engine] Failed to parse generated question JSON: {}", e.getMessage());
            return null;
        }
    }

    /** Resolves the final question text: the generated one if usable, otherwise a context-aware fallback (never a raw duplicate). */
    private String resolveQuestionText(Map<String, Object> session, GeneratedQuestion generated, List<String> questionsAsked,
            String targetArea, int fallbackUsedCount) {
        if (generated != null && generated.getQuestion() != null && !generated.getQuestion().isBlank()
                && !isDuplicateQuestion(generated.getQuestion(), questionsAsked)) {
            return generated.getQuestion();
        }
        return buildContextAwareFallback(session, targetArea, fallbackUsedCount);
    }

    // Called only when the seed area pool (resume skills/job titles) has
    // run dry — see the area-starvation handling in handleAnswer(). Keeps
    // the interview genuinely open-ended instead of bottlenecked by a
    // finite pre-seeded list; a real interviewer doesn't run out of
    // questions just because they've covered every line on the resume once.
    private String proposeNewArea(Map<String, Object> session, List<Map<String, Object>> interviewAreas) {
        Map<String, Object> resumeData = castMap(session.get("resume_data"));
        String skills = String.join(", ", castStringList(resumeData.get("skills")));
        String titles = String.join(", ", castStringList(resumeData.get("jobTitles")));
        String interviewType = (String) session.getOrDefault("interview_type", "Technical");
        String difficulty = (String) session.getOrDefault("difficulty", "Mid");
        String jd = (String) session.get("job_description");
        String alreadyCovered = interviewAreas.stream()
                .map(a -> String.valueOf(a.get("area")))
                .collect(Collectors.joining(", "));

        String systemPrompt = """
                You are an expert interviewer. Every pre-identified topic area for this candidate has
                already been covered. Propose ONE new, genuinely relevant area to explore next — this
                can be a different angle on a skill already discussed (e.g. testing, performance,
                debugging, design patterns, deployment, collaboration/behavioral aspects), a general
                competency expected for this track and difficulty, or something from the job
                description not yet covered. Do not propose an area already covered. Reply with ONLY
                the area name, 1-4 words, no punctuation, no explanation.
                """;
        String userPrompt = """
                Candidate skills: %s
                Job titles: %s
                %s
                Track: %s | Difficulty: %s
                Already covered: %s
                """.formatted(skills, titles,
                (jd != null && !jd.isBlank()) ? "Job description:\n" + truncate(jd, 800) : "No job description provided.",
                interviewType, difficulty,
                alreadyCovered.isEmpty() ? "(none)" : alreadyCovered);

        String result = llmProvider.generateResponse(systemPrompt, "", userPrompt);
        if (result == null || result.isBlank()) return null;
        String area = result.trim().replaceAll("[\"'.]", "");
        return area.length() > 60 ? area.substring(0, 60) : area; // guard against a non-conforming rambling reply
    }

    private String buildPersonalizedIntro(Map<String, Object> resumeData) {
        String name = (String) resumeData.getOrDefault("name", "there");
        List<String> skills = castStringList(resumeData.get("skills"));
        List<String> jobTitles = castStringList(resumeData.get("jobTitles"));
        if (skills.isEmpty() && jobTitles.isEmpty()) {
            return "Hello " + name + "! Welcome to your mock interview. I'm your MockMate AI interviewer. Let's begin — " + FALLBACK_INTRO_QUESTION;
        }
        String systemPrompt = """
                You are an AI interviewer opening a mock interview. Write a short, warm, personalized
                opening (2-3 sentences) that references the candidate's actual resume background, then
                asks them to briefly walk through their background. Do not invent experience beyond
                what's given. Output ONLY the opening text, no labels, no markdown, no quotes.
                """;
        String userPrompt = "Candidate name: %s\nSkills: %s\nJob titles: %s".formatted(
                name, String.join(", ", skills), String.join(", ", jobTitles));
        String result = llmProvider.generateResponse(systemPrompt, "", userPrompt);
        if (result == null || result.isBlank()) {
            return "Hello " + name + "! Welcome to your mock interview. I'm your MockMate AI interviewer. Let's begin — " + FALLBACK_INTRO_QUESTION;
        }
        return result.trim();
    }

    // ── Prompt builders ─────────────────────────────────────────────────

    private String buildEvaluateSystemPrompt(Map<String, Object> session, List<Map<String, Object>> interviewAreas,
            String currentArea, int followUpCount, int primaryQuestionsAsked, int durationMinutes, long startedAt) {
        String interviewType = (String) session.getOrDefault("interview_type", "Technical");
        String difficulty = (String) session.getOrDefault("difficulty", "Mid");
        String jd = (String) session.get("job_description");
        long elapsedMin = (System.currentTimeMillis() - startedAt) / 60000;

        return """
                You are an expert interviewer evaluating a candidate's answer to decide what to do next.
                Do not reveal this evaluation to the candidate — it is for internal interview control only.

                INTERVIEW CONTEXT:
                Track: %s | Difficulty: %s | Elapsed: %d of ~%d target minutes | Primary questions asked so far: %d
                %s
                Current area being discussed: %s | Follow-ups already used on this area: %d (max 2 — never recommend FOLLOW_UP if this is already 2)

                Known candidate-relevant areas (discovered from resume/JD/conversation so far):
                %s

                Evaluate the candidate's most recent answer for: relevance, depth, technical correctness,
                specificity, and whether important information is missing. Interpret the criteria
                appropriately for the KIND of question asked — a project question should weigh the
                candidate's actual contribution/decisions/challenges; a conceptual question should weigh
                correctness/understanding/examples; a behavioral question should weigh situation/action/
                reasoning/outcome.

                Then decide ONE strategy action:
                - FOLLOW_UP: the answer was weak or incomplete in an important way worth probing once more on the SAME area
                - MOVE_TO_NEW_AREA: the answer was sufficient — move to a different relevant area
                - DEEPER_NEW_AREA: the answer revealed a genuinely interesting new angle worth one question
                - END: reserve this for when you have genuinely covered substantial ground across MANY
                  distinct areas with real depth — a thorough interview normally runs much longer than a
                  handful of questions. Do not recommend END just because the last few answers went fine;
                  that is exactly when there is still more useful ground to cover. Prefer MOVE_TO_NEW_AREA
                  or DEEPER_NEW_AREA unless you are confident nothing more would meaningfully add to the
                  assessment.

                Return ONLY this JSON object, no markdown, no other text:
                {
                  "answerQuality": "STRONG|MEDIUM|WEAK|NOT_ANSWERED",
                  "relevance": "HIGH|MEDIUM|LOW",
                  "depth": "HIGH|MEDIUM|LOW",
                  "technicalCorrectness": "HIGH|MEDIUM|LOW",
                  "specificity": "HIGH|MEDIUM|LOW",
                  "missingInformation": ["string"],
                  "newAreaDiscovered": "a new topic this answer itself surfaced that isn't already in the known areas list, or null",
                  "recommendedAction": "FOLLOW_UP|MOVE_TO_NEW_AREA|DEEPER_NEW_AREA|END",
                  "reason": "one sentence, internal only"
                }
                """.formatted(
                interviewType, difficulty, elapsedMin, durationMinutes, primaryQuestionsAsked,
                (jd != null && !jd.isBlank())
                        ? "Job description provided — weigh JD-relevant areas too:\n" + truncate(jd, 1200)
                        : "No job description provided — base relevance on resume + interview type only.",
                currentArea, followUpCount,
                summarizeAreas(interviewAreas)
        );
    }

    private String buildQuestionGenSystemPrompt(Map<String, Object> session, String targetArea, boolean isFollowUp,
            AnswerEvaluation evaluation, List<String> questionsAsked, int consecutiveNonAnswers) {
        Map<String, Object> resumeData = castMap(session.get("resume_data"));
        String name = (String) resumeData.getOrDefault("name", "the candidate");
        String skills = String.join(", ", castStringList(resumeData.get("skills")));
        String titles = String.join(", ", castStringList(resumeData.get("jobTitles")));
        String companies = String.join(", ", castStringList(resumeData.get("companies")));
        String interviewType = (String) session.getOrDefault("interview_type", "Technical");
        String difficulty = (String) session.getOrDefault("difficulty", "Mid");
        String language = (String) session.getOrDefault("language", "English");
        String jd = (String) session.get("job_description");

        List<String> missing = (evaluation != null && evaluation.getMissingInformation() != null) ? evaluation.getMissingInformation() : List.of();
        String followUpContext = isFollowUp && !missing.isEmpty()
                ? "The candidate's last answer was missing: " + String.join(", ", missing) + "."
                : "";

        // Never escalate on the back of an unanswered question (spec §27) —
        // a real failed run walked a silent candidate from a basic project
        // question up through multi-tenancy and microservices refactoring
        // with zero evidence of competence at any step.
        String engagementNote = consecutiveNonAnswers > 0
                ? "\nIMPORTANT: the candidate's last answer showed no real engagement. Do NOT increase difficulty or "
                + "pick a more advanced topic than the configured baseline. Ask a simpler, more concrete, easier-to-"
                + "answer question, and keep it short.\n"
                : "";

        int recentCount = Math.min(6, questionsAsked.size());
        String recentQuestions = questionsAsked.isEmpty() ? "(none yet)"
                : String.join("\n", questionsAsked.subList(questionsAsked.size() - recentCount, questionsAsked.size()));

        return """
                You are an expert interviewer generating exactly ONE next question for %s.

                CANDIDATE: Skills: %s | Titles: %s | Companies: %s
                %s
                CONFIGURATION: %s track, %s difficulty, respond in %s.

                TARGET AREA FOR THIS QUESTION: %s (%s)
                %s
                %s
                Recently asked questions — do NOT repeat or closely rephrase any of these:
                %s

                RULES:
                - Return EXACTLY ONE question, never multiple.
                - Reference the candidate's actual resume/JD content where relevant — never invent experience they never claimed.
                - Keep it concise, natural, spoken-style, professional — sounds like a human who actually read the resume.
                - Start with a short (max 1 sentence) natural acknowledgment of the candidate's last answer, using varied phrasing ("That makes sense.", "Got it.", "I see.", "That's helpful.", "Understood.") — never "Excellent answer!" and never over-praise every response.
                - Do not reveal scores, evaluation, or internal reasoning.
                - Do not prefix with "Question N" or any counter.

                Return ONLY this JSON object, no markdown, no other text:
                {
                  "question": "the full question text including the short acknowledgment",
                  "area": "%s",
                  "questionType": "%s"
                }
                """.formatted(
                name, skills, titles, companies,
                (jd != null && !jd.isBlank()) ? "JOB DESCRIPTION:\n" + truncate(jd, 1200) : "No job description provided.",
                interviewType, difficulty, language,
                targetArea, isFollowUp ? "follow-up on the current area" : "new area to explore",
                followUpContext,
                engagementNote,
                recentQuestions,
                targetArea,
                isFollowUp ? "FOLLOW_UP" : "PRIMARY"
        );
    }

    private String buildClarificationSystemPrompt(Map<String, Object> session) {
        String interviewType = (String) session.getOrDefault("interview_type", "Technical");
        return """
                You are an AI interviewer. The candidate just asked for clarification about the
                current question instead of answering it. Given the current question and the
                candidate's clarification request, give a brief 1-2 sentence clarification, then
                restate the original question unchanged at the end. Do not treat this as an answer.
                Do not introduce a new question. Track: %s.
                """.formatted(interviewType);
    }

    // ── Area / fallback / repetition helpers ────────────────────────────

    private void addAreaIfAbsent(List<Map<String, Object>> areas, String areaName, String source, String importance) {
        boolean exists = areas.stream().anyMatch(a -> areaName.equalsIgnoreCase(String.valueOf(a.get("area"))));
        if (exists) return;
        Map<String, Object> area = new HashMap<>();
        area.put("area", areaName);
        area.put("source", source);
        area.put("importance", importance);
        area.put("status", "NOT_EXPLORED");
        areas.add(area);
    }

    private void markAreaStatus(List<Map<String, Object>> areas, String areaName, String status) {
        if (areaName == null) return;
        for (Map<String, Object> a : areas) {
            if (areaName.equals(a.get("area"))) {
                a.put("status", status);
                return;
            }
        }
    }

    private int countViableAreas(List<Map<String, Object>> areas, String excludeArea) {
        return (int) areas.stream()
                .filter(a -> !Objects.equals(a.get("area"), excludeArea))
                .filter(a -> {
                    String status = (String) a.get("status");
                    return status == null || "NOT_EXPLORED".equals(status) || "PARTIALLY_EXPLORED".equals(status);
                })
                .count();
    }

    private String pickNextArea(List<Map<String, Object>> areas, String excludeArea) {
        Comparator<Map<String, Object>> byImportance = Comparator.comparingInt(a -> importanceRank((String) a.get("importance")));
        Optional<Map<String, Object>> notExplored = areas.stream()
                .filter(a -> !Objects.equals(a.get("area"), excludeArea))
                .filter(a -> "NOT_EXPLORED".equals(a.get("status")))
                .max(byImportance);
        if (notExplored.isPresent()) return (String) notExplored.get().get("area");

        Optional<Map<String, Object>> partial = areas.stream()
                .filter(a -> !Objects.equals(a.get("area"), excludeArea))
                .filter(a -> "PARTIALLY_EXPLORED".equals(a.get("status")))
                .max(byImportance);
        return partial.map(m -> (String) m.get("area")).orElse(null);
    }

    private int importanceRank(String importance) {
        if ("HIGH".equalsIgnoreCase(importance)) return 2;
        if ("MEDIUM".equalsIgnoreCase(importance)) return 1;
        return 0;
    }

    private String summarizeAreas(List<Map<String, Object>> areas) {
        if (areas.isEmpty()) return "(none identified yet)";
        return areas.stream()
                .map(a -> "- " + a.get("area") + " [" + a.get("status") + "]")
                .collect(Collectors.joining("\n"));
    }

    // Non-answers never trigger a follow-up (addendum A2) and feed the
    // sustained-disengagement counter (B2).
    //
    // The earlier version of this method only matched explicit verbal
    // refusals ("I don't know"), which a real failed run proved far too
    // narrow: answers of ".", "Música", "Hello," and "Kampung Kampung"
    // (speech-to-text noise on a dead mic) all sailed through as genuine
    // answers and got progressively harder questions in response. The two
    // checks below are what actually catch that class of input.
    private boolean isNonAnswer(String message) {
        if (message == null || message.isBlank()) return true;
        String trimmed = message.trim();

        // 1. No real content at all — ".", "...", "-", stray punctuation.
        String alphanumericOnly = trimmed.replaceAll("[^\\p{L}\\p{N}]", "");
        if (alphanumericOnly.length() < 2) return true;

        // 2. A spoken answer to an interview question is essentially never
        // one or two words. This is the check that catches STT artifacts and
        // bare greetings that carry no attempt at an answer.
        int wordCount = trimmed.split("\\s+").length;
        if (wordCount <= 2) return true;

        // 3. Explicit refusal, but only when short — "not sure, but here's
        // how I'd approach it..." is a genuine attempt, not a refusal.
        if (wordCount > 8) return false;
        for (Pattern p : REFUSAL_PATTERNS) {
            if (p.matcher(trimmed).find()) return true;
        }
        return false;
    }

    private long elapsedMinutes(long startedAt) {
        return (System.currentTimeMillis() - startedAt) / 60000;
    }

    // Every interview termination logs exactly which condition fired, so a
    // premature/unexpected ending can be diagnosed from logs alone instead
    // of being guessed at (B1.3).
    private void logEndDecision(String sessionId, String reason, int primaryQuestionsAsked, long elapsedMin) {
        log.info("[AI Engine] INTERVIEW END — reason={} sessionId={} primaryQuestionsAsked={} elapsedMin={}",
                reason, sessionId, primaryQuestionsAsked, elapsedMin);
    }

    private void putIfPresent(Map<String, Object> session, Map<String, Object> config, String configKey, String sessionKey) {
        Object value = config.get(configKey);
        if (value instanceof String s && !s.isBlank()) {
            session.put(sessionKey, s);
        }
    }

    private boolean isDuplicateQuestion(String question, List<String> questionsAsked) {
        if (question == null) return false;
        String norm = normalize(question);
        return questionsAsked.stream().anyMatch(q -> normalize(q).equals(norm));
    }

    private String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase().replaceAll("[^a-z0-9 ]", "").replaceAll("\\s+", " ").trim();
    }

    // Context-aware, not one universal sentence (spec §36) — alternates
    // phrasing so back-to-back fallback usage in the same session isn't
    // verbatim identical either.
    private String buildContextAwareFallback(Map<String, Object> session, String area, int fallbackUsedCount) {
        String interviewType = (String) session.getOrDefault("interview_type", "Technical");
        if (area != null && !area.isBlank() && !"introduction".equalsIgnoreCase(area)) {
            return fallbackUsedCount == 0
                    ? "Could you tell me more about your experience with " + area + "?"
                    : "Let's talk about " + area + " a bit more — what's been the most challenging part of working with it?";
        }
        return "Could you walk me through a " + interviewType.toLowerCase() + " problem you found particularly challenging and how you approached it?";
    }

    private String truncate(String text, int maxLen) {
        if (text == null) return "";
        return text.length() > maxLen ? text.substring(0, maxLen) + "..." : text;
    }

    // ── Turn/result helpers ─────────────────────────────────────────────

    private Map<String, Object> aiTurn(String text, String turnType) {
        Map<String, Object> turn = new HashMap<>();
        turn.put("role", "interviewer");
        turn.put("text", text);
        turn.put("turn_type", turnType);
        turn.put("timestamp_ms", System.currentTimeMillis());
        return turn;
    }

    private Map<String, Object> candidateMetaTurn(String text, String turnType, int questionIndex) {
        Map<String, Object> turn = new HashMap<>();
        turn.put("role", "candidate_meta");
        turn.put("text", text);
        turn.put("turn_type", turnType);
        turn.put("question_index", questionIndex);
        turn.put("timestamp_ms", System.currentTimeMillis());
        return turn;
    }

    private Map<String, Object> evaluationToMap(AnswerEvaluation e) {
        return objectMapper.convertValue(e, new TypeReference<>() {});
    }

    private Map<String, Object> engineResult(boolean success, String response, int questionsAsked, String turnType,
            String status, String area, String questionType) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("response", response);
        result.put("questionsAsked", questionsAsked);
        result.put("turnType", turnType);
        result.put("status", status);
        if (area != null) result.put("area", area);
        if (questionType != null) result.put("questionType", questionType);
        return result;
    }

    private Map<String, Object> errorResult(String error, String message) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        result.put("error", error);
        result.put("message", message);
        return result;
    }
}
