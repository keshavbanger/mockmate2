package com.example.mockmate.controller;

import com.example.mockmate.dto.response.InterviewSummaryDTO;
import com.example.mockmate.model.AtsAnalysis;
import com.example.mockmate.model.User;
import com.example.mockmate.repository.AtsAnalysisRepository;
import com.example.mockmate.service.InterviewHistoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final InterviewHistoryService interviewHistoryService;
    private final AtsAnalysisRepository atsAnalysisRepository;

    @GetMapping("/summary")
    public ResponseEntity<?> getDashboardSummary(@AuthenticationPrincipal User user) {
        // Previously trusted a client-supplied ?userId= query param outright
        // (the Authorization header was accepted but never actually used) —
        // any authenticated user could view any other user's full dashboard
        // just by changing the param. Always derive it from the token instead.
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String userId = user.getId();

        List<InterviewSummaryDTO> interviews = interviewHistoryService.getInterviewHistory(userId);
        List<AtsAnalysis> atsReports = atsAnalysisRepository.findByUserIdOrderByCreatedAtDesc(userId);
        
        int interviewsCompleted = interviews.size();
        
        double averageScore = interviews.stream()
                .filter(i -> i.getOverallScore() != null)
                .mapToInt(InterviewSummaryDTO::getOverallScore)
                .average()
                .orElse(0.0);
                
        int atsResumesScanned = atsReports.size();
        
        List<Map<String, Object>> recentInterviews = interviews.stream()
                .limit(5)
                .map(i -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", i.getId());
                    map.put("date", i.getCreatedAt().toString());
                    map.put("role", i.getRole());
                    map.put("score", i.getOverallScore() != null ? i.getOverallScore() : 0);
                    return map;
                })
                .collect(Collectors.toList());
                
        List<Map<String, Object>> recentAtsScans = atsReports.stream()
                .limit(5)
                .map(r -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", r.getReportId());
                    map.put("date", r.getCreatedAt().toString());
                    map.put("score", r.getFinalScore());
                    return map;
                })
                .collect(Collectors.toList());
                
        List<Map<String, Object>> scoreTrend = interviews.stream()
                .filter(i -> i.getOverallScore() != null)
                .sorted(Comparator.comparing(InterviewSummaryDTO::getCreatedAt))
                .map(i -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("date", i.getCreatedAt().toString());
                    map.put("score", i.getOverallScore());
                    return map;
                })
                .collect(Collectors.toList());

        Map<String, Object> summary = new HashMap<>();
        summary.put("interviewsCompleted", interviewsCompleted);
        summary.put("averageScore", averageScore);
        summary.put("atsResumesScanned", atsResumesScanned);
        summary.put("recentInterviews", recentInterviews);
        summary.put("recentAtsScans", recentAtsScans);
        summary.put("scoreTrend", scoreTrend);
        
        return ResponseEntity.ok(summary);
    }
}
