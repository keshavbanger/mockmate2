package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ATSValidationResult {
    private int          atsScore;
    private List<String> criticalFails;
    private List<String> majorFails;
    private List<String> minorWarnings;
    private List<String> passes;
}
