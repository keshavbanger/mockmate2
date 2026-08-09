package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ATSScoreResult {
    private int          overallScore;
    private int          keywordScore;
    private int          sectionScore;
    private int          formattingScore;
    private List<String> missingKeywords;
    private List<String> quickFixes;
}
