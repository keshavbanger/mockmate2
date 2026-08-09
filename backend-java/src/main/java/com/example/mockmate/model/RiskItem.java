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
public class RiskItem {

    /** CRITICAL / HIGH / MEDIUM / LOW */
    private String severity;

    /** Which section this applies to */
    private String section;

    /** One-line issue title */
    private String issue;

    /** Actionable fix */
    private String fix;

    /** Estimated reduction in ATS score if unfixed */
    private int atsImpact;

    /** How much a human recruiter cares: 1–10 */
    private int recruiterImpact;

    /** Time estimate to fix: "10 mins" / "1 hour" / "1 day" */
    private String fixEffort;

    /** AI confidence in this finding: 0–100 */
    private int confidenceScore;

    /** Exact quotes from the resume that support this finding */
    private List<String> evidence;
}
