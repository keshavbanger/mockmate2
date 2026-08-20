package com.example.mockmate.aiengine;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Classifies each incoming candidate message as ANSWER / REPEAT_REQUEST /
 * CLARIFICATION_REQUEST before InterviewEngineService decides what to do
 * with it. Tavus's live conversational model handled "can you repeat that?"
 * and mid-interview candidate questions natively as part of normal
 * conversation — this engine isn't continuously "live" in that sense, so
 * that behavior has to be reproduced explicitly here.
 *
 * Two-tier: a cheap regex fast path for the common, unambiguous cases, and
 * a single LLM call only for genuinely ambiguous short/question-shaped
 * messages that didn't match either regex list. Defaults to ANSWER on any
 * uncertainty — never silently drops a real answer.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TurnClassifierService {

    private final LlmProvider llmProvider;

    private static final List<Pattern> REPEAT_PATTERNS = List.of(
            "repeat", "say that again", "say it again", "come again",
            "didn'?t catch that", "did not catch that", "one more time",
            "what was the question", "pardon", "can you repeat",
            "could you repeat", "please repeat", "i missed that"
    ).stream().map(p -> Pattern.compile(p, Pattern.CASE_INSENSITIVE)).toList();

    private static final List<Pattern> CLARIFICATION_PATTERNS = List.of(
            "what do you mean", "what does that mean", "can you clarify",
            "could you clarify", "can you explain the question", "explain what you mean",
            "i don'?t understand the question", "i do not understand the question",
            "what exactly are you asking", "not sure what you'?re asking",
            "can you elaborate on the question"
    ).stream().map(p -> Pattern.compile(p, Pattern.CASE_INSENSITIVE)).toList();

    private static final String CLASSIFY_SYSTEM_PROMPT = """
            You are classifying a single candidate message from a job interview.
            Decide if it is:
            - ANSWER: a genuine attempt to answer the interview question
            - CLARIFICATION: the candidate is asking what the question means, or for more context, instead of answering it
            Reply with exactly one word: ANSWER or CLARIFICATION. Nothing else.
            """;

    public TurnType classify(String message) {
        if (message == null || message.isBlank()) {
            return TurnType.ANSWER;
        }
        String trimmed = message.trim();

        for (Pattern p : REPEAT_PATTERNS) {
            if (p.matcher(trimmed).find()) {
                return TurnType.REPEAT_REQUEST;
            }
        }
        for (Pattern p : CLARIFICATION_PATTERNS) {
            if (p.matcher(trimmed).find()) {
                return TurnType.CLARIFICATION_REQUEST;
            }
        }

        // Only messages that are short AND question-shaped are ambiguous
        // enough to warrant an LLM call — a normal answer is neither.
        int wordCount = trimmed.split("\\s+").length;
        boolean looksLikeQuestion = trimmed.endsWith("?")
                || Pattern.compile("^(what|how|why|could|can|do|does|is|are)\\b", Pattern.CASE_INSENSITIVE)
                        .matcher(trimmed).find();
        if (wordCount > 12 || !looksLikeQuestion) {
            return TurnType.ANSWER;
        }

        try {
            String result = llmProvider.generateResponse(CLASSIFY_SYSTEM_PROMPT, "", trimmed);
            if (result != null && result.trim().toUpperCase().startsWith("CLARIFICATION")) {
                return TurnType.CLARIFICATION_REQUEST;
            }
        } catch (Exception e) {
            log.warn("[TurnClassifierService] Classification call failed, defaulting to ANSWER: {}", e.getMessage());
        }
        return TurnType.ANSWER;
    }
}
