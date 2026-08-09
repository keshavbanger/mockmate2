package com.example.mockmate.service;

import com.example.mockmate.dto.response.InterviewSummaryDTO;
import com.example.mockmate.model.Interview;
import com.example.mockmate.repository.InterviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InterviewHistoryService {

    private final InterviewRepository interviewRepository;

    public List<InterviewSummaryDTO> getInterviewHistory(String userId) {
        List<Interview> interviews = interviewRepository.findByUserIdOrderByCreatedAtDesc(userId);
        
        return interviews.stream().map(interview -> 
            InterviewSummaryDTO.builder()
                .id(interview.getId())
                .createdAt(interview.getCreatedAt())
                .role(interview.getRole())
                .company(interview.getCompany())
                .companyId(interview.getCompanyId())
                .interviewType(interview.getInterviewType())
                .overallScore(interview.getOverallScore())
                .fillerWordCount(interview.getFillerWordCount())
                .averageWpm(interview.getAverageWpm())
                .build()
        ).collect(Collectors.toList());
    }
}
