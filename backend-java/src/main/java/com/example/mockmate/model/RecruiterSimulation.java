package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecruiterSimulation {

    /** What the recruiter thinks in the first 6 seconds */
    private String firstImpression;

    /** Section or achievement that will grab positive attention */
    private String mostImpressiveSection;

    /** Section or issue that creates hesitation */
    private String weakestSection;

    /** High / Medium / Low */
    private String likelihoodToContinueReading;

    /** "6 seconds" / "30 seconds" */
    private String estimatedReadingTime;

    /** Max 3 recruiter concerns */
    private List<String> topConcerns;

    /** Things that might cause immediate skip */
    private List<String> redFlags;

    /** Things that make the recruiter interested */
    private List<String> positiveSignals;

    /** 3–5 interview questions a recruiter would ask based on resume */
    private List<LikelyQuestion> likelyQuestions;

    // ── Hard-truth recruiter read-through timeline ──────────────────────────
    /** Realistic total seconds spent reading before a decision (15-45 typical) */
    private int totalReadSeconds;

    /** Second-by-second walk through what the recruiter actually looks at */
    private List<TimelineStep> timeline;

    /** "shortlist" | "maybe" | "reject" */
    private String finalDecision;

    /** Specific reason for the decision — must reflect the combination of
     *  signals (content quality, CGPA, project depth), never a single
     *  missing item in isolation. */
    private String decisionReason;

    /** Specific changes that would flip rejection to shortlist */
    private List<String> whatWouldChangeDecision;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LikelyQuestion {
        /** Why this question would be asked (cites resume text) */
        private String reason;
        /** The actual interview question */
        private String question;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimelineStep {
        private String seconds;  // "0-5 seconds"
        private String action;   // what the recruiter looks at
        private String thought;  // exact recruiter thought
        private String verdict;  // "continue" | "concern" | "reject"
    }
}
