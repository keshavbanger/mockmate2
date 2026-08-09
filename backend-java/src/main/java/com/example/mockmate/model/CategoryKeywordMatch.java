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
public class CategoryKeywordMatch {

    /** Category name e.g. "Backend Frameworks" */
    private String category;

    /** Count of matched keywords in this category */
    private int matchedCount;

    /** Total keywords in this category that appear in JD */
    private int totalInJD;

    /** Coverage percentage: (matchedCount / totalInJD) * 100 */
    private int coveragePercent;

    /** Critical / Important / Nice-to-have */
    private String importance;

    /** Keywords from JD that exist in resume */
    private List<String> matchedKeywords;

    /** Keywords from JD that are missing from resume */
    private List<String> missingKeywords;
}
