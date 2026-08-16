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
    private final com.example.mockmate.service.DashboardInsightsService dashboardInsightsService;

    // ── GET /insights — the redesigned Dashboard's data source: a
    // synthesized readiness score, prioritized "what to work on next"
    // items, and a practice streak, built from data already computed at
    // report-generation time. See DashboardInsightsService.
    @GetMapping("/insights")
    public ResponseEntity<?> getInsights(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(dashboardInsightsService.buildInsights(user));
    }

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
        // AtsAnalysis.userId is the caller's JWT EMAIL (see ATSController/
        // ATSAnalyzerService — AtsReportAccessGuard resolves ownership from
        // the token's email, not the account UUID, since ATS also supports
        // anonymous scans). Interview.userId, by contrast, really is the UUID
        // (set from user.getId() in InterviewController.startInterview) — so
        // this one query must use a different identity than the one above it,
        // which is exactly why it always returned nothing for any logged-in
        // user: it was querying rows keyed by email using a UUID.
        List<AtsAnalysis> atsReports = atsAnalysisRepository.findByUserIdOrderByCreatedAtDesc(user.getEmail());
        
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

    // ── GET /profile — full account view: profile info + complete session/
    // resume history (unlike /summary, which caps lists at 5 for the
    // dashboard's quick-glance widgets). Backs the dedicated Profile page.
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String userId = user.getId();

        List<InterviewSummaryDTO> interviews = interviewHistoryService.getInterviewHistory(userId);
        // AtsAnalysis.userId is the caller's JWT EMAIL (see ATSController/
        // ATSAnalyzerService — AtsReportAccessGuard resolves ownership from
        // the token's email, not the account UUID, since ATS also supports
        // anonymous scans). Interview.userId, by contrast, really is the UUID
        // (set from user.getId() in InterviewController.startInterview) — so
        // this one query must use a different identity than the one above it,
        // which is exactly why it always returned nothing for any logged-in
        // user: it was querying rows keyed by email using a UUID.
        List<AtsAnalysis> atsReports = atsAnalysisRepository.findByUserIdOrderByCreatedAtDesc(user.getEmail());

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", user.getId());
        profile.put("fullName", user.getFullName());
        profile.put("email", user.getEmail());
        profile.put("avatarUrl", user.getAvatarUrl());
        profile.put("memberSince", user.getCreatedAt() != null ? user.getCreatedAt().toString() : null);

        List<Map<String, Object>> interviewList = interviews.stream()
                .map(i -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", i.getId());
                    map.put("date", i.getCreatedAt().toString());
                    map.put("role", i.getRole());
                    map.put("company", i.getCompany());
                    map.put("interviewType", i.getInterviewType());
                    map.put("score", i.getOverallScore() != null ? i.getOverallScore() : 0);
                    map.put("fillerWordCount", i.getFillerWordCount());
                    map.put("averageWpm", i.getAverageWpm());
                    return map;
                })
                .collect(Collectors.toList());

        List<Map<String, Object>> resumeList = atsReports.stream()
                .map(r -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("reportId", r.getReportId());
                    map.put("date", r.getCreatedAt().toString());
                    map.put("fileName", r.getResumeFileName());
                    map.put("score", r.getFinalScore());
                    map.put("verdict", r.getVerdict());
                    return map;
                })
                .collect(Collectors.toList());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("profile", profile);
        body.put("interviews", interviewList);
        body.put("resumes", resumeList);
        // "Last session" — whichever of the two histories is most recent,
        // since a user's last activity could be either an interview or a
        // resume scan.
        body.put("lastInterview", interviewList.isEmpty() ? null : interviewList.get(0));
        body.put("lastResume", resumeList.isEmpty() ? null : resumeList.get(0));

        return ResponseEntity.ok(body);
    }
}
