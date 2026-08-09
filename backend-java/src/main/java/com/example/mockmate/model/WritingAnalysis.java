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
public class WritingAnalysis {

    /** 0–100 grammar quality score */
    private int grammarScore;

    /** 0–100 professional tone score */
    private int professionalToneScore;

    /** 0–100 action verb usage score */
    private int actionVerbScore;

    /** 0–100 readability score */
    private int readabilityScore;

    /** Overused buzzwords found in resume */
    private List<String> buzzwordOveruse;

    /** Passive voice instances: "was developed" → "developed" */
    private List<PassiveVoiceInstance> passiveVoiceInstances;

    /** Good / Verbose / Too brief */
    private String conciseness;

    /** Grammar errors with corrections */
    private List<GrammarError> grammarErrors;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PassiveVoiceInstance {
        private String original;
        private String suggested;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GrammarError {
        private String original;
        private String correction;
        private String rule;
    }
}
