package com.example.mockmate.model.techinterview;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class InterviewPlanConfig {
    private String roleLevel;         // INTERN | FRESHER | SDE_1 | SDE_2 | SDE_3
    private String interviewType;     // BACKEND | FRONTEND | FULLSTACK | DATA_SCIENCE | DEVOPS | MOBILE | ML_ENGINEER
    private String companyStyle;      // GOOGLE | AMAZON | MICROSOFT | ADOBE | ATLASSIAN | STARTUP | GENERIC
    private int durationMinutes;      // 30 | 45 | 60 | 90
    private String preferredLanguage; // java | python | cpp | javascript | go
    private String resumeText;        // extracted from uploaded file
    private String jdText;            // pasted JD
    private boolean startDirectlyToDsa; // Skip intro and jump straight to DSA coding round
}
