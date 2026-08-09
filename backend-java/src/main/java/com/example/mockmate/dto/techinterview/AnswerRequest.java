package com.example.mockmate.dto.techinterview;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class AnswerRequest {
    private String answerText;
    private int turnId;
    private CodeSubmission codeSubmission;
    private SQLSubmission sqlSubmission;
    private ComplexityAnswer complexityAnswer;
    private String whiteboardSnapshot;

    @Data @NoArgsConstructor
    public static class CodeSubmission {
        private String code;
        private String language;
        private String problemId;
        // Same Jackson is-prefix stripping bug found in DSAProblem.TestCase and
        // CodeExecutionResult.TestResult: without this, Jackson expects JSON key
        // "submit" (not "isSubmit"), so the frontend's literal isSubmit:true
        // payload threw UnrecognizedPropertyException on EVERY code/SQL
        // submission, at the @RequestBody deserialization stage — before the
        // controller method ever ran. That's what the "System Warning /
        // something went wrong connecting to the AI interviewer" message
        // actually was: a 500 from a JSON parse failure, not an AI/Groq issue.
        @JsonProperty("isSubmit")
        private boolean isSubmit; // true = submit, false = run
        private Object executionResult; // pre-executed result from frontend
    }

    @Data @NoArgsConstructor
    public static class SQLSubmission {
        private String query;
        private String problemId;
        private Object result;
    }

    @Data @NoArgsConstructor
    public static class ComplexityAnswer {
        private String time;
        private String space;
    }
}
