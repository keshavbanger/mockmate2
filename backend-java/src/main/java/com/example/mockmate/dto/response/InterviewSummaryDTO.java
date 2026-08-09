package com.example.mockmate.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterviewSummaryDTO {
    private String id;
    private LocalDateTime createdAt;
    private String role;
    private String company;
    private String companyId;
    private String interviewType;
    private Integer overallScore;
    private Integer fillerWordCount;
    private Integer averageWpm;
}
