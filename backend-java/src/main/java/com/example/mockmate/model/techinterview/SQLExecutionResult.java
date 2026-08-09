package com.example.mockmate.model.techinterview;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
public class SQLExecutionResult {
    private boolean success;
    private List<String> columns;
    private List<List<Object>> rows;
    private int rowCount;
    private String error;
    private long executionTimeMs;
    // Same is-prefix Jackson issue as elsewhere: without this, it serializes as
    // "correct" but SQLEditorPanel.jsx reads sqlResult.isCorrect, so a genuinely
    // correct query always showed "Executed — Check result" instead of "Correct!".
    @JsonProperty("isCorrect")
    private boolean isCorrect;
    private String feedback;
}
