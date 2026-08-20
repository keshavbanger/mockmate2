package com.example.mockmate.aiengine;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A dynamically discovered candidate-specific interview topic — never a
 * hardcoded name (no "Java"/"Spring Boot"/"SQL" anywhere in code). Seeded at
 * start() from the candidate's own resume_data.skills/jobTitles, and
 * appended to as answers surface new areas (source=CANDIDATE_ANSWER). See
 * spec §22-23.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InterviewArea {
    private String area;
    private String source;     // RESUME | JOB_DESCRIPTION | CANDIDATE_ANSWER
    private String importance; // HIGH | MEDIUM | LOW
    private String status;     // NOT_EXPLORED | PARTIALLY_EXPLORED | EXPLORED | NOT_ANSWERED
}
