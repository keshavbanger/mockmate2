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
public class EnhancedExecutiveSummary {

    private String candidateName;
    private String targetRole;

    /** 1–5 stars */
    private int overallQuality;

    /** 0–100 */
    private int atsReadinessPercent;

    /** High / Medium / Low */
    private String recruiterConfidence;

    /** 0–100 — estimated probability a recruiter reads the whole resume */
    private int estimatedInterviewProbability;

    /** 0–100 — estimated probability this resume clears an ATS filter */
    private int estimatedATSPassProbability;

    /** Max 3, specific, evidence-based strengths */
    private List<String> topStrengths;

    /** Max 3, specific, evidence-based weaknesses */
    private List<String> topWeaknesses;

    /** 3-4 sentence evidence-based paragraph from Groq */
    private String paragraphSummary;
}
