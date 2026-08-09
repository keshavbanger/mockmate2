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
public class ConsistencyCheckResult {

    /** 0–100 overall consistency score */
    private int consistencyScore;

    /** Number of checks that passed */
    private int passedChecks;

    /** Total checks performed */
    private int totalChecks;

    private List<ConsistencyCheck> checks;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConsistencyCheck {
        /** Short name of the check */
        private String checkName;

        /** PASS or FAIL */
        private String status;

        /** Detailed description of the finding */
        private String detail;

        /** Specific examples from the resume (only on FAIL) */
        private List<String> examples;
    }
}
