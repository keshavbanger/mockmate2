package com.example.mockmate.controller;

import com.example.mockmate.dto.response.InterviewSummaryDTO;
import com.example.mockmate.model.Interview;
import com.example.mockmate.model.User;
import com.example.mockmate.repository.InterviewRepository;
import com.example.mockmate.service.InterviewHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/interviews")
@RequiredArgsConstructor
public class InterviewHistoryController {

    private final InterviewHistoryService interviewHistoryService;
    private final InterviewRepository interviewRepository;

    @GetMapping("/history")
    public ResponseEntity<List<InterviewSummaryDTO>> getHistory(
            @RequestParam(required = false) String userId,
            @AuthenticationPrincipal User user) {
        String activeUserId = (user != null) ? user.getId() : userId;
        if (activeUserId == null) {
            return ResponseEntity.badRequest().build();
        }
        List<InterviewSummaryDTO> history = interviewHistoryService.getInterviewHistory(activeUserId);
        return ResponseEntity.ok(history);
    }

    // Full report detail — previously only available while the session's
    // 2h SessionStoreService cache was still alive (see InterviewController.
    // generateReport). This row's fullReportJson is now durable, so this
    // works any time after the interview completed, not just briefly after.
    @GetMapping("/{id}")
    public ResponseEntity<?> getDetail(@PathVariable String id, @AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Authentication required"));
        }
        Interview interview = interviewRepository.findById(id).orElse(null);
        if (interview == null) {
            return ResponseEntity.notFound().build();
        }
        if (!user.getId().equals(interview.getUserId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "You do not have access to this interview"));
        }
        if (interview.getFullReportJson() == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(interview.getFullReportJson());
    }
}
