package com.example.mockmate.model.techinterview;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DSAProblem {

    private String id;             // e.g. "lc-001"
    private int leetcodeId;
    private String leetcodeUrl;
    private String title;
    private String difficulty;     // EASY | MEDIUM | HARD
    private List<String> topics;   // e.g. ["array", "hash-map"]
    private List<String> companies;
    private String frequency;      // VERY_HIGH | HIGH | MEDIUM | LOW

    private int neetcodeListNumber; // 0 if not in NeetCode 150

    private String description;
    private List<Example> examples;
    private List<String> constraints;
    private List<String> hints;

    private StarterCode starterCode;
    private List<TestCase> testCases;
    private OptimalSolution optimalSolution;
    private BruteForce bruteForce;

    private ProblemSignature signature;
    private List<String> followUpQuestions;
    private String interviewerNotes;
    private RoleRelevance roleRelevance;

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ProblemSignature {
        private String functionName;
        private List<Parameter> parameters;
        private String returnType;

        @Data
        @NoArgsConstructor
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class Parameter {
            private String name;
            private String type;
        }
    }

    // ── Nested classes ─────────────────────────────────────────

    @Data
    @NoArgsConstructor
    public static class Example {
        private String input;
        private String output;
        private String explanation;
    }

    @Data
    @NoArgsConstructor
    public static class StarterCode {
        private String java;
        private String python;
        private String cpp;
        private String javascript;
        private String go;
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TestCase {
        private String input;
        private String expectedOutput;
        // Lombok generates the getter for this field as isHidden(), and
        // Jackson's default bean-naming strips the "is" prefix from boolean
        // getters, so it infers the JSON property name as "hidden" — not
        // "isHidden". Every problem JSON file on disk uses "isHidden" (matching
        // the field name literally), so without this explicit override every
        // single test case in every DSA problem file failed to deserialize,
        // which silently emptied the entire problem bank on every startup.
        @JsonProperty("isHidden")
        private boolean isHidden;
        private String description;
    }

    @Data
    @NoArgsConstructor
    public static class OptimalSolution {
        private String approach;
        private String timeComplexity;
        private String spaceComplexity;
        private Map<String, String> code;  // language → solution
    }

    @Data
    @NoArgsConstructor
    public static class BruteForce {
        private String timeComplexity;
        private String spaceComplexity;
        private boolean acceptable;
    }

    @Data
    @NoArgsConstructor
    public static class RoleRelevance {
        private String backend;
        private String frontend;
        private String fullstack;
        private String dataScience;
        private String devops;
    }

    /** Returns a copy safe to send to candidate (no solution, no hidden tests) */
    public DSAProblem toPublicView() {
        DSAProblem pub = new DSAProblem();
        pub.setId(this.id);
        pub.setLeetcodeId(this.leetcodeId);
        pub.setLeetcodeUrl(this.leetcodeUrl);
        pub.setTitle(this.title);
        pub.setDifficulty(this.difficulty);
        pub.setTopics(this.topics);
        pub.setCompanies(this.companies);
        pub.setFrequency(this.frequency);
        pub.setDescription(this.description);
        pub.setExamples(this.examples);
        pub.setConstraints(this.constraints);
        // hints withheld — given by AI during interview
        pub.setStarterCode(this.starterCode);
        // only public test cases
        if (this.testCases != null) {
            pub.setTestCases(this.testCases.stream()
                    .filter(tc -> !tc.isHidden())
                    .toList());
        }
        pub.setFollowUpQuestions(this.followUpQuestions);
        // optimalSolution withheld until after interview
        pub.setBruteForce(this.bruteForce);
        pub.setSignature(this.signature);
        pub.setRoleRelevance(this.roleRelevance);
        pub.setNeetcodeListNumber(this.neetcodeListNumber);
        return pub;
    }
}
