package com.example.mockmate.controller;

import com.example.mockmate.config.CompanyPromptConfig;
import com.example.mockmate.service.QuestionGeneratorService;
import com.example.mockmate.service.SessionStoreService;
import static com.example.mockmate.service.ReportGeneratorService.castMap;
import static com.example.mockmate.service.ReportGeneratorService.castStringList;
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

    @SuppressWarnings("unchecked")
    @PostMapping("/generate-questions")
    public ResponseEntity<?> generateQuestions(
            @RequestBody Map<String, Object> request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.example.mockmate.model.User user) {
        String sessionId      = (String) request.get("session_id");
        String interviewType  = (String) request.getOrDefault("interview_type", "Technical");
        String difficulty     = (String) request.getOrDefault("difficulty", "Mid");
        String language       = (String) request.getOrDefault("language", "English");
        String jobDescription = (String) request.getOrDefault("job_description", null);
        String companyId      = (String) request.getOrDefault("company_id", "general");

        // Normalise
        if (companyId == null || companyId.isBlank()) companyId = "general";

        Map<String, Object> session = sessionStoreService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Session not found"));
        }
        if (user != null) {
            session.put("user_id", user.getId());
            sessionStoreService.saveSession(sessionId, session);
        }

        Map<String, Object> resumeMap = castMap(session.get("resume_data"));
        if (resumeMap.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("detail", "No resume data found in session"));
        }

        try {
            com.example.mockmate.dto.response.ResumeParsedResponse resumeData =
                    com.example.mockmate.dto.response.ResumeParsedResponse.builder()
                            .name((String) resumeMap.get("name"))
                            .skills(castStringList(resumeMap.get("skills")))
                            .jobTitles(castStringList(resumeMap.get("jobTitles")))
                            .companies(castStringList(resumeMap.get("companies")))
                            .education(castStringList(resumeMap.get("education")))
                            .totalExperienceYears(((Number) resumeMap.getOrDefault("totalExperienceYears", 0)).doubleValue())
                            .build();

            Boolean noAvatar = (Boolean) request.get("no_avatar");
            List<String> questions;
            Map<String, Object> extras = null;
            if (Boolean.TRUE.equals(noAvatar)) {
                questions = List.of("Please introduce yourself and share a brief overview of your background.");
            } else {
                QuestionGeneratorService.Result result = questionGeneratorService.generateQuestions(
                        resumeData, interviewType, difficulty, language, jobDescription, companyId);
                questions = result.questions();
                extras = result.extras();
            }

            // ── Persist base session data ────────────────────────────────────
            sessionStoreService.updateSession(sessionId, "no_avatar", Boolean.TRUE.equals(noAvatar));
            sessionStoreService.updateSession(sessionId, "interview_type", interviewType);
            sessionStoreService.updateSession(sessionId, "difficulty",     difficulty);
            sessionStoreService.updateSession(sessionId, "language",       language);
            sessionStoreService.updateSession(sessionId, "questions",      questions);
            sessionStoreService.updateSession(sessionId, "company_id",     companyId);
            sessionStoreService.updateSession(sessionId, "company_display",
                    CompanyPromptConfig.getDisplayName(companyId));

            if (jobDescription != null && !jobDescription.isBlank()) {
                sessionStoreService.updateSession(sessionId, "job_description", jobDescription);
            }

            // ── Persist rich extras from the service (unified path only) ─────
            if (extras != null) {
                Object skillGaps    = extras.get("skillGaps");
                Object matchedSkills = extras.get("matchedSkills");
                Object richQuestions = extras.get("richQuestions");
                Object interviewStyle = extras.get("interviewStyle");

                if (skillGaps     != null) sessionStoreService.updateSession(sessionId, "skill_gaps",      skillGaps);
                if (matchedSkills != null) sessionStoreService.updateSession(sessionId, "matched_skills",  matchedSkills);
                if (richQuestions != null) sessionStoreService.updateSession(sessionId, "rich_questions",  richQuestions);
                if (interviewStyle != null) sessionStoreService.updateSession(sessionId, "interview_style", interviewStyle);
            }

            return ResponseEntity.ok(Map.of("questions", questions));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("detail", "Failed to generate questions: " + e.getMessage()));
        }
    }
}
