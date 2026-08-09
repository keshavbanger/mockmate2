package com.example.mockmate.model.techinterview;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class CodeExecutionResult {
    private boolean success;
    private int testCasesPassed;
    private int totalTestCases;
    private boolean allPassed;
    private String stdout;
    private String stderr;
    private long executionTimeMs;
    private long memoryUsedKb;
    private String compilationError;
    private TestResult[] results;
    private String pistonError; // API-level error
    // True for console/custom-input runs — these have no expected output to
    // grade against, so the frontend should show raw output only, no
    // pass/fail verdict badge. Deliberately named without an "is" prefix
    // (unlike TestResult.isHidden below) so Lombok's isCustomRun() getter and
    // Jackson's stripped JSON property name ("customRun") actually agree —
    // see the isHidden comment for the bug this pattern avoids.
    private boolean customRun;

    @Data
    @NoArgsConstructor
    public static class TestResult {
        private boolean passed;
        private String input;
        private String expectedOutput;
        private String actualOutput;
        private String description;
        // Same Jackson is-prefix stripping issue as DSAProblem.TestCase — without
        // this, the field serializes as "hidden" but the frontend reads
        // r.isHidden, so the "(Hidden)" test-case label never actually worked.
        @JsonProperty("isHidden")
        private boolean isHidden;
        /** Set when Piston's compile stage failed — distinct from a runtime failure */
        private String compileError;
    }
}
