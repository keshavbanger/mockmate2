package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImprovementScenario {

    /** Human-readable scenario name */
    private String scenarioName;

    /** Current score before applying this fix */
    private int currentScore;

    /** Projected score after applying this fix */
    private int projectedScore;

    /** Exact score gain */
    private int scoreGain;

    /** Specific fix instruction */
    private String fix;

    /** Time to implement: "5 minutes", "15 minutes", etc. */
    private String effort;

    /** Confidence in this projection: 0–100 */
    private int confidence;
}
