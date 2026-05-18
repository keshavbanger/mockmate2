package com.example.mockmate.controller;

import com.example.mockmate.dto.response.ResumeParsedResponse;
import com.example.mockmate.service.ResumeParserService;
import com.example.mockmate.service.SessionStoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import lombok.extern.slf4j.Slf4j;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeParserService resumeParserService;
    private final SessionStoreService sessionStoreService;

    @PostMapping("/parse-resume")
    public ResponseEntity<?> uploadResume(
            @RequestParam("file") MultipartFile file,
            @RequestParam("session_id") String sessionId) {
        
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Please upload a file"));
        }
        
        if (file.getContentType() == null || !file.getContentType().equals("application/pdf")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only PDF files are supported"));
        }

        try {
            byte[] pdfBytes = file.getBytes();
            ResumeParsedResponse parsedData = resumeParserService.parseResumeWithGemini(pdfBytes);
            
            // Convert to Map to save in session
            Map<String, Object> session = sessionStoreService.getSession(sessionId);
            if (session == null) {
                log.info("Session {} not found. Creating new session on the fly.", sessionId);
                session = new java.util.HashMap<>();
                session.put("status", "initialized");
                session.put("created_at", System.currentTimeMillis() / 1000.0);
                sessionStoreService.saveSession(sessionId, session);
            }
            
            Map<String, Object> resumeMap = new java.util.HashMap<>();
            resumeMap.put("name", parsedData.getName() != null ? parsedData.getName() : "");
            resumeMap.put("email", parsedData.getEmail() != null ? parsedData.getEmail() : "");
            resumeMap.put("skills", parsedData.getSkills() != null ? parsedData.getSkills() : new java.util.ArrayList<>());
            resumeMap.put("jobTitles", parsedData.getJobTitles() != null ? parsedData.getJobTitles() : new java.util.ArrayList<>());
            resumeMap.put("companies", parsedData.getCompanies() != null ? parsedData.getCompanies() : new java.util.ArrayList<>());
            resumeMap.put("education", parsedData.getEducation() != null ? parsedData.getEducation() : new java.util.ArrayList<>());
            resumeMap.put("totalExperienceYears", parsedData.getTotalExperienceYears());
            resumeMap.put("total_experience_years", parsedData.getTotalExperienceYears());
            
            sessionStoreService.updateSession(sessionId, "resume_data", resumeMap);
            
            return ResponseEntity.ok(Map.of("resume_data", resumeMap));
        } catch (Exception e) {
            log.error("Resume parsing error: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("detail", "Failed to parse resume: " + e.getMessage()));
        }
    }
}
