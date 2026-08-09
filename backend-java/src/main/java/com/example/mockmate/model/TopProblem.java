package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopProblem {
    private int    rank;
    private String problem;
    private String recruiterThought;
    private String impact;
    private String fix;
    private String timeToFix;
    private int    atsPointsGained;
}
