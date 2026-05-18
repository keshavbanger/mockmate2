package com.example.mockmate.controller;

import com.example.mockmate.service.QuestionGeneratorService;
import com.example.mockmate.service.SessionStoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionGeneratorService questionGeneratorService;
    private final SessionStoreService sessionStoreService;

    @PostMapping("/generate-questions")
    public ResponseEntity<?> generateQuestions(@RequestBody Map<String, Object> request) {
        String sessionId = (String) request.get("session_id");
        String interviewType = (String) request.getOrDefault("interview_type", "Technical");
        String difficulty = (String) request.getOrDefault("difficulty", "Mid");
        String language = (String) request.getOrDefault("language", "English");

        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }

        Map<String, Object> resumeMap = (Map<String, Object>) session.get("resume_data");
        if (resumeMap == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "No resume data found in session"));
        }

        try {
            com.example.mockmate.dto.response.ResumeParsedResponse resumeData = com.example.mockmate.dto.response.ResumeParsedResponse.builder()
                    .name((String) resumeMap.get("name"))
                    .skills((List<String>) resumeMap.get("skills"))
                    .jobTitles((List<String>) resumeMap.get("jobTitles"))
                    .companies((List<String>) resumeMap.get("companies"))
                    .education((List<String>) resumeMap.get("education"))
                    .totalExperienceYears(((Number) resumeMap.getOrDefault("totalExperienceYears", 0)).doubleValue())
                    .build();

            List<String> questions = questionGeneratorService.generateQuestions(
                    resumeData,
                    interviewType,
                    difficulty,
                    language
            );

            sessionStoreService.updateSession(sessionId, "interview_type", interviewType);
            sessionStoreService.updateSession(sessionId, "difficulty", difficulty);
            sessionStoreService.updateSession(sessionId, "language", language);
            sessionStoreService.updateSession(sessionId, "questions", questions);

            return ResponseEntity.ok(Map.of("questions", questions));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("detail", "Failed to generate questions: " + e.getMessage()));
        }
    }
}
