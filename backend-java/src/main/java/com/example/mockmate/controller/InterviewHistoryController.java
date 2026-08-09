package com.example.mockmate.controller;

import com.example.mockmate.dto.response.InterviewSummaryDTO;
import com.example.mockmate.model.User;
import com.example.mockmate.service.InterviewHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/interviews")
@RequiredArgsConstructor
public class InterviewHistoryController {

    private final InterviewHistoryService interviewHistoryService;

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
}
