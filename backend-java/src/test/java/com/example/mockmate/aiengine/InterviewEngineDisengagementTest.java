package com.example.mockmate.aiengine;

import com.example.mockmate.service.SessionStoreService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Covers the sustained-non-engagement handling (B2) using a stubbed
 * LlmProvider, so the decision logic is verified deterministically without
 * live Groq calls.
 *
 * TEST 25 below is a literal replay of a real failed run: the candidate
 * answered the introduction, then sent ".", "Música", "Hello,", ".", "." and
 * "Kampung Kampung" — and the old engine walked them through 7 increasingly
 * difficult questions and produced a "completed" report scoring 8/10.
 */
class InterviewEngineDisengagementTest {

    private InterviewEngineService engine;
    private SessionStoreService sessionStore;
    private StubLlmProvider llm;

    /** Answers every structured call with schema-valid JSON; never says END on its own. */
    private static class StubLlmProvider implements LlmProvider {
        String nextAnswerQuality = "MEDIUM";
        String nextAction = "MOVE_TO_NEW_AREA";

        @Override
        public String generateResponse(String systemPrompt, String conversationContext, String userMessage) {
            if (systemPrompt.contains("Propose ONE new")) {
                return "System Design"; // plausible, non-conforming-with-seed-list area name
            }
            return "Hello! Thanks for joining — could you walk me through your background?";
        }

        @Override
        public String generateJson(String systemPrompt, String userPrompt, int maxTokens) {
            if (systemPrompt.contains("recommendedAction")) {
                return """
                        {"answerQuality":"%s","relevance":"MEDIUM","depth":"MEDIUM","technicalCorrectness":"MEDIUM",
                         "specificity":"MEDIUM","missingInformation":[],"newAreaDiscovered":null,
                         "recommendedAction":"%s","reason":"stub"}
                        """.formatted(nextAnswerQuality, nextAction);
            }
            return "{\"question\":\"Stub question " + System.nanoTime() + "?\",\"area\":\"stub\",\"questionType\":\"PRIMARY\"}";
        }
    }

    @BeforeEach
    void setUp() {
        ObjectMapper mapper = new ObjectMapper();
        sessionStore = new SessionStoreService(mapper);
        llm = new StubLlmProvider();
        engine = new InterviewEngineService(llm, new TurnClassifierService(llm), sessionStore, mapper);
    }

    private Map<String, Object> newSession(String sessionId) {
        Map<String, Object> session = new HashMap<>();
        Map<String, Object> resume = new HashMap<>();
        resume.put("name", "Keshav");
        resume.put("skills", List.of("Java", "Spring Boot", "MySQL", "React", "Hibernate", "REST"));
        resume.put("jobTitles", List.of("Backend Developer"));
        session.put("resume_data", resume);
        sessionStore.saveSession(sessionId, session);
        engine.start(sessionId, session, Map.of("interviewType", "Technical", "difficulty", "Mid", "durationMinutes", 25));
        return sessionStore.getSession(sessionId);
    }

    private Map<String, Object> send(String sessionId, String message) {
        return engine.handleMessage(sessionId, sessionStore.getSession(sessionId), message);
    }

    @Test
    @DisplayName("TEST 21: three consecutive non-answers trigger an engagement check, not a harder question")
    void threeNonAnswersTriggerEngagementCheck() {
        String sid = "t21";
        newSession(sid);
        send(sid, "I'm a final year student with backend experience in Java and Spring Boot projects.");

        send(sid, ".");
        send(sid, "Música");
        Map<String, Object> third = send(sid, "Hello,");

        assertEquals("ENGAGEMENT_CHECK", third.get("turnType"),
                "3rd consecutive non-answer must produce an engagement check, not another interview question");
        assertEquals("active", third.get("status"));
        assertTrue(String.valueOf(third.get("response")).toLowerCase().contains("microphone"),
                "check-in should name the likely cause (mic/connection), got: " + third.get("response"));
    }

    @Test
    @DisplayName("TEST 23: a genuine attempt after a non-answer resets the streak")
    void genuineAnswerResetsStreak() {
        String sid = "t23";
        newSession(sid);
        send(sid, "I built an expense tracking app using Spring Boot and PostgreSQL last semester.");

        send(sid, ".");
        send(sid, "I used JWT tokens for authentication and stored them in local storage.");
        Map<String, Object> afterReset = send(sid, ".");

        assertNotEquals("ENGAGEMENT_CHECK", afterReset.get("turnType"),
                "a genuine answer in between must reset consecutive_non_answer_count");
        assertEquals(0, ((Number) sessionStore.getSession(sid).get("consecutive_non_answer_count")).intValue() - 1,
                "counter should have restarted from the genuine answer, standing at 1 after one new non-answer");
    }

    @Test
    @DisplayName("TEST 25: replay of the real failed transcript ends as no-engagement, not a scored 7-question interview")
    void replayOfFailedTranscriptEndsAsNoEngagement() {
        String sid = "t25";
        newSession(sid);
        send(sid, "Good morning, my name is Keshav. Currently I am studying BTech from Acropolis Group of Institution.");

        // The exact six non-answers from the failed run, in order.
        List<String> garbage = List.of(".", "Música", "Hello,", ".", ".", "Kampung Kampung");
        Map<String, Object> last = null;
        boolean sawEngagementCheck = false;
        for (String g : garbage) {
            last = send(sid, g);
            if ("ENGAGEMENT_CHECK".equals(last.get("turnType"))) sawEngagementCheck = true;
            if (InterviewEngineService.STATUS_NO_ENGAGEMENT.equals(last.get("status"))) break;
        }

        assertTrue(sawEngagementCheck, "engine should have checked in before giving up");

        Map<String, Object> session = sessionStore.getSession(sid);
        assertEquals(InterviewEngineService.STATUS_NO_ENGAGEMENT, session.get("status"),
                "a candidate who never engaged must NOT produce a 'completed' interview");
        assertNotEquals("completed", session.get("status"));

        int questionsAsked = ((List<?>) session.get("questions")).size();
        assertTrue(questionsAsked < 7,
                "should stop well before the old 7-question ceiling, but asked " + questionsAsked);
    }

    @Test
    @DisplayName("BUGFIX: exhausting the seed area pool proposes a new area instead of ending the interview")
    void exhaustingSeedAreasProposesNewAreaInsteadOfEnding() {
        String sid = "area-starvation";
        Map<String, Object> session = new HashMap<>();
        Map<String, Object> resume = new HashMap<>();
        resume.put("name", "Test Candidate");
        // 10 seed areas — enough that exhausting them pushes
        // primaryQuestionsAsked past the 8-question floor, which is exactly
        // the combination that used to force an early END.
        resume.put("skills", List.of("Skill1", "Skill2", "Skill3", "Skill4", "Skill5",
                "Skill6", "Skill7", "Skill8", "Skill9", "Skill10"));
        resume.put("jobTitles", List.of());
        session.put("resume_data", resume);
        sessionStore.saveSession(sid, session);
        engine.start(sid, session, Map.of("interviewType", "Technical", "difficulty", "Mid", "durationMinutes", 25));

        llm.nextAction = "MOVE_TO_NEW_AREA";
        // 10 seed areas can satisfy exactly 10 MOVE_TO_NEW_AREA picks (one
        // per turn) without ever truly running dry — the pool only actually
        // empties on the 11th pick. Run past that point.
        Map<String, Object> lastResult = null;
        for (int i = 0; i < 12; i++) {
            lastResult = send(sid, "This is a genuine, substantive answer with real technical detail about turn " + i + ".");
            if ("completed".equals(lastResult.get("status"))) break;
        }

        Map<String, Object> finalSession = sessionStore.getSession(sid);
        assertEquals("active", finalSession.get("status"),
                "exhausting the seed area list must not end the interview once past the floor — got end_reason=" + finalSession.get("end_reason"));
        assertNull(finalSession.get("end_reason"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> areas = (List<Map<String, Object>>) finalSession.get("interview_areas");
        boolean hasGeneratedArea = areas.stream().anyMatch(a -> "GENERATED".equals(a.get("source")));
        assertTrue(hasGeneratedArea, "a new area should have been proposed once the 10 seed areas were exhausted");

        int primaryAsked = ((Number) finalSession.get("primary_questions_asked")).intValue();
        assertTrue(primaryAsked > 8, "test setup should have pushed well past the 8-question floor, got " + primaryAsked);
    }

    @Test
    @DisplayName("TEST 24: no difficulty escalation while the candidate is disengaged")
    void noEscalationWhileDisengaged() {
        String sid = "t24";
        newSession(sid);
        send(sid, "I have worked on a few Java projects during my degree, mostly backend services.");

        final boolean[] sawNoEscalationInstruction = {false};
        InterviewEngineService probeEngine = new InterviewEngineService(new StubLlmProvider() {
            @Override
            public String generateJson(String systemPrompt, String userPrompt, int maxTokens) {
                if (!systemPrompt.contains("recommendedAction")
                        && systemPrompt.contains("Do NOT increase difficulty")) {
                    sawNoEscalationInstruction[0] = true;
                }
                return super.generateJson(systemPrompt, userPrompt, maxTokens);
            }
        }, new TurnClassifierService(llm), sessionStore, new ObjectMapper());

        probeEngine.handleMessage(sid, sessionStore.getSession(sid), ".");

        assertTrue(sawNoEscalationInstruction[0],
                "question generation after a non-answer must instruct the model not to escalate difficulty");
    }
}
