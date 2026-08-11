package com.example.mockmate.service;

import com.example.mockmate.model.techinterview.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechInterviewStateService {

    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, TechInterviewSession> sessionCache = new ConcurrentHashMap<>();
    private static final String BASE_DIR = "data/sessions/technical";

    public TechInterviewSession createSession(String userId, InterviewPlan plan) {
        TechInterviewSession session = new TechInterviewSession();
        session.setSessionId(UUID.randomUUID().toString());
        session.setUserId(userId);
        session.setPlanId(plan.getPlanId());
        session.setPlan(plan);
        session.setCurrentRoundIndex(0);
        session.setInterviewState(TechInterviewSession.InterviewState.ON_TRACK);
        session.setStartedAt(System.currentTimeMillis() / 1000);
        session.setLastActivityAt(System.currentTimeMillis() / 1000);
        session.setTurns(new ArrayList<>());
        session.setDsaAttempts(new HashMap<>());
        session.setSqlAttempts(new ArrayList<>());
        session.setEnded(false);

        List<TechInterviewSession.RoundState> roundStates = new ArrayList<>();
        if (plan != null && plan.getInterviewPlan() != null && plan.getInterviewPlan().getRounds() != null) {
            for (var round : plan.getInterviewPlan().getRounds()) {
                TechInterviewSession.RoundState rs = new TechInterviewSession.RoundState();
                rs.setRoundId(round.getRoundId() != null ? round.getRoundId() : "round_" + roundStates.size());
                rs.setStarted(false);
                rs.setCompleted(false);
                rs.setTopicsCovered(new ArrayList<>());
                roundStates.add(rs);
            }
        }
        session.setRoundStates(roundStates);

        TechInterviewSession.CandidatePerformance perf = new TechInterviewSession.CandidatePerformance();
        perf.setOverallTrend("CONSISTENT");
        perf.setRunningAverageScore(0);
        perf.setWeaknesses(new ArrayList<>());
        perf.setStrengths(new ArrayList<>());
        perf.setLastThreeAnswers(new ArrayList<>());
        session.setCandidatePerformance(perf);

        sessionCache.put(session.getSessionId(), session);
        persistSession(session);
        log.info("Created tech session: {}", session.getSessionId());
        return session;
    }

    public TechInterviewSession getSession(String sessionId) {
        TechInterviewSession s = sessionCache.get(sessionId);
        if (s == null) {
            s = loadFromDisk(sessionId);
            if (s != null) sessionCache.put(sessionId, s);
        }
        return s;
    }

    public void addTurn(String sessionId, TechInterviewSession.InterviewTurn turn) {
        TechInterviewSession s = getSession(sessionId);
        if (s == null) return;
        s.getTurns().add(turn);
        s.setLastActivityAt(System.currentTimeMillis() / 1000);
        updatePerformance(s, turn);
        trackCurrentRoundProgress(s);
        trackTopicCovered(s, turn);
        persistSession(s);
    }

    // currentRound.topicsCovered was initialized to an empty list at plan
    // generation and never appended to anywhere afterward, so topicsRemaining
    // (topics minus topicsCovered) always showed the FULL topic list no
    // matter how many questions had actually been asked — the model had no
    // signal of what it already covered beyond the raw last-5-exchange
    // window, which is a big part of why it kept circling back to the same
    // topics. Append the topic actually assessed on each turn.
    private void trackTopicCovered(TechInterviewSession s, TechInterviewSession.InterviewTurn turn) {
        String topic = turn.getTopicAssessed();
        if (topic == null || topic.isBlank()) return;
        if (s.getPlan() == null || s.getPlan().getInterviewPlan() == null || s.getPlan().getInterviewPlan().getRounds() == null) return;
        int ri = s.getCurrentRoundIndex();
        List<InterviewRound> rounds = s.getPlan().getInterviewPlan().getRounds();
        if (ri < 0 || ri >= rounds.size()) return;
        InterviewRound round = rounds.get(ri);
        if (round.getTopicsCovered() == null) round.setTopicsCovered(new ArrayList<>());
        String trimmed = topic.trim();
        boolean alreadyCovered = round.getTopicsCovered().stream().anyMatch(t -> t.equalsIgnoreCase(trimmed));
        if (!alreadyCovered) round.getTopicsCovered().add(trimmed);
    }

    // AIInterviewerService reads questionsAsked/elapsedMinutes off the current
    // round to decide when to force progression (e.g. its Introduction-round
    // hard cap at 3 questions) — but those fields live on the round objects
    // inside the STATIC interview plan, which is generated once up front and
    // never mutated again. Every hard cap relying on them was reading numbers
    // that literally never changed for the entire interview, so it could
    // never fire. RoundState is the actual per-session, per-round tracker;
    // this keeps its questionsAsked/elapsedMinutes live so those checks have
    // real numbers to act on.
    private void trackCurrentRoundProgress(TechInterviewSession s) {
        int ri = s.getCurrentRoundIndex();
        if (s.getRoundStates() == null || ri < 0 || ri >= s.getRoundStates().size()) return;
        TechInterviewSession.RoundState rs = s.getRoundStates().get(ri);
        long now = System.currentTimeMillis() / 1000;
        if (!rs.isStarted()) {
            rs.setStarted(true);
            rs.setStartedAt(now);
        }
        rs.setQuestionsAsked(rs.getQuestionsAsked() + 1);
        if (rs.getStartedAt() > 0) {
            rs.setElapsedMinutes((int) ((now - rs.getStartedAt()) / 60));
        }
    }

    public void updateDsaAttempt(String sessionId, TechInterviewSession.DSAAttempt attempt) {
        TechInterviewSession s = getSession(sessionId);
        if (s == null) return;
        if (s.getDsaAttempts() == null) s.setDsaAttempts(new HashMap<>());
        s.getDsaAttempts().put(attempt.getProblemId(), attempt);
        persistSession(s);
    }

    // SQLAttempt is stored as a List (not a Map like DSA), keyed by problemId,
    // since TechInterviewSession.sqlAttempts was already declared that way.
    // Previously there was no method to write into it at all — sqlAttempts
    // stayed permanently empty from createSession() onward, so SQL round
    // performance never reached scoring or the final report.
    public void updateSqlAttempt(String sessionId, TechInterviewSession.SQLAttempt attempt) {
        TechInterviewSession s = getSession(sessionId);
        if (s == null) return;
        if (s.getSqlAttempts() == null) s.setSqlAttempts(new ArrayList<>());
        List<TechInterviewSession.SQLAttempt> attempts = s.getSqlAttempts();
        attempts.removeIf(a -> attempt.getProblemId().equals(a.getProblemId()));
        attempts.add(attempt);
        persistSession(s);
    }

    public void setActiveDsaProblem(String sessionId, String problemId) {
        TechInterviewSession s = getSession(sessionId);
        if (s == null || problemId == null) return;
        s.setActiveDsaProblemId(problemId);

        // InterviewRound.currentDsaIndex is read by AIInterviewerService to
        // build the DSA context for the round's currently-active problem,
        // but nothing ever wrote to it — any round configured with 2+ DSA
        // problems permanently stuck on index 0, so a candidate could never
        // actually be moved to a round's second problem even though the
        // plan called for it. Keep it in sync with whichever problem in the
        // current round is now active.
        if (s.getPlan() != null && s.getPlan().getInterviewPlan() != null) {
            List<InterviewRound> rounds = s.getPlan().getInterviewPlan().getRounds();
            int ri = s.getCurrentRoundIndex();
            if (rounds != null && ri >= 0 && ri < rounds.size()) {
                InterviewRound round = rounds.get(ri);
                if (round.getDsaProblems() != null) {
                    for (int i = 0; i < round.getDsaProblems().size(); i++) {
                        InterviewRound.DSAProblemRef ref = round.getDsaProblems().get(i);
                        if (ref != null && problemId.equals(ref.getProblemId())) {
                            round.setCurrentDsaIndex(i);
                            break;
                        }
                    }
                }
            }
        }
        persistSession(s);
    }

    // The AI prompt has always defined a GIVE_HINT action and instructs the
    // model to use it sparingly ("ONE hint maximum per problem"), and the
    // score formula and report both already account for hintsUsed — but
    // nothing ever called this, so hintsUsed was permanently stuck at 0 no
    // matter how many hints were actually given, silently inflating every
    // candidate's DSA score.
    public void recordHint(String sessionId) {
        TechInterviewSession s = getSession(sessionId);
        if (s == null || s.getActiveDsaProblemId() == null) return;
        if (s.getDsaAttempts() == null) s.setDsaAttempts(new HashMap<>());
        String pid = s.getActiveDsaProblemId();
        TechInterviewSession.DSAAttempt attempt = s.getDsaAttempts()
                .computeIfAbsent(pid, k -> {
                    TechInterviewSession.DSAAttempt a = new TechInterviewSession.DSAAttempt();
                    a.setProblemId(pid);
                    return a;
                });
        attempt.setHintsUsed(attempt.getHintsUsed() + 1);
        persistSession(s);
    }

    public void advanceToNextRound(String sessionId) {
        TechInterviewSession s = getSession(sessionId);
        if (s == null) return;
        int ri = s.getCurrentRoundIndex();
        if (ri < s.getRoundStates().size()) s.getRoundStates().get(ri).setCompleted(true);
        s.setCurrentRoundIndex(ri + 1);
        int total = s.getPlan().getInterviewPlan().getRounds().size();
        if (s.getCurrentRoundIndex() >= total) {
            s.setEnded(true);
            s.setInterviewState(TechInterviewSession.InterviewState.ENDED);
        }
        persistSession(s);
    }

    public void saveWhiteboard(String sessionId, String snapshot) {
        TechInterviewSession s = getSession(sessionId);
        if (s == null) return;
        s.setWhiteboardSnapshot(snapshot);
        persistSession(s);
    }

    public void endSession(String sessionId) {
        TechInterviewSession s = getSession(sessionId);
        if (s == null) return;
        s.setEnded(true);
        s.setInterviewState(TechInterviewSession.InterviewState.ENDED);
        persistSession(s);
    }

    private void updatePerformance(TechInterviewSession session, TechInterviewSession.InterviewTurn turn) {
        TechInterviewSession.CandidatePerformance perf = session.getCandidatePerformance();
        if (perf == null) return;

        // A SYSTEM_ERROR turn (both Groq and the OpenRouter fallback failed)
        // is recorded with score=0/quality=WEAK purely as a placeholder so
        // the turn history stays complete — it was never folded into
        // running/final scoring here before this comment either... except
        // it was: this method used to average over ALL turns unconditionally,
        // so a transient third-party outage measurably lowered the running
        // average and (via InterviewEvaluationService reading the same
        // turns) the final report, penalizing the candidate for an infra
        // failure that was never actually evaluating their answer.
        if ("SYSTEM_ERROR".equals(turn.getAction())) return;

        TechInterviewSession.CandidatePerformance.AnswerQuality aq =
                new TechInterviewSession.CandidatePerformance.AnswerQuality();
        aq.setQuality(turn.getQuality() != null ? turn.getQuality() : "ADEQUATE");
        aq.setScore(turn.getScore());
        aq.setTopic(turn.getTopicAssessed());

        List<TechInterviewSession.CandidatePerformance.AnswerQuality> last3 = perf.getLastThreeAnswers();
        if (last3.size() >= 3) last3.remove(0);
        last3.add(aq);

        List<TechInterviewSession.InterviewTurn> allTurns = session.getTurns();
        List<TechInterviewSession.InterviewTurn> scorable = allTurns.stream()
                .filter(t -> !"SYSTEM_ERROR".equals(t.getAction()))
                .toList();
        if (!scorable.isEmpty()) {
            double avg = scorable.stream().mapToInt(TechInterviewSession.InterviewTurn::getScore).average().orElse(0);
            perf.setRunningAverageScore((int) avg);
        }
    }

    private void persistSession(TechInterviewSession session) {
        try {
            File dir = new File(BASE_DIR + "/" + session.getSessionId());
            dir.mkdirs();
            objectMapper.writeValue(new File(dir, "state.json"), session);
        } catch (Exception e) {
            log.error("Failed to persist tech session {}", session.getSessionId(), e);
        }
    }

    private TechInterviewSession loadFromDisk(String sessionId) {
        try {
            File file = new File(BASE_DIR + "/" + sessionId + "/state.json");
            if (file.exists()) return objectMapper.readValue(file, TechInterviewSession.class);
        } catch (Exception e) {
            log.error("Failed to load tech session {} from disk", sessionId, e);
        }
        return null;
    }
}
