package com.example.mockmate.controller;

import com.example.mockmate.dto.response.ResumeParsedResponse;
import com.example.mockmate.model.SavedResume;
import com.example.mockmate.service.ResumeParserService;
import com.example.mockmate.service.ResumeTextExtractor;
import com.example.mockmate.service.SavedResumeService;
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
import java.util.NoSuchElementException;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeParserService resumeParserService;
    private final SessionStoreService sessionStoreService;
    private final SavedResumeService savedResumeService;
    private final ResumeTextExtractor resumeTextExtractor;

    @PostMapping("/parse-resume")
    public ResponseEntity<?> uploadResume(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam("session_id") String sessionId,
            // Reuse a previously saved resume instead of re-uploading — see
            // SavedResumeController. When present, `file` is ignored.
            @RequestParam(value = "savedResumeId", required = false) String savedResumeId,
            @RequestParam(value = "saveAsResume", required = false, defaultValue = "false") boolean saveAsResume,
            @RequestParam(value = "label", required = false) String label,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.example.mockmate.model.User user) {

        boolean usingSavedResume = savedResumeId != null && !savedResumeId.isBlank();
        if (!usingSavedResume) {
            if (file == null || file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("detail", "Please upload a file"));
            }
            // Was PDF-only via content-type sniffing — ResumeSourcePicker
            // (the shared upload widget every page uses) has accepted PDF
            // and DOCX for a while, so any DOCX upload was silently 400ing
            // here even though the picker's own UI advertised DOCX support.
            // ResumeTextExtractor below already handles both; every other
            // resume-upload endpoint (Technical Interview Lab, Resume
            // Builder, ATS, saved resumes) already goes through it — this
            // was the one path still on the old PDF-only extractor.
            String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
            if (!filename.endsWith(".pdf") && !filename.endsWith(".docx")) {
                return ResponseEntity.badRequest().body(Map.of("detail", "Only PDF and DOCX files are supported"));
            }
        } else if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("detail", "Authentication required to use a saved resume"));
        }

        try {
            ResumeParsedResponse parsedData;
            if (usingSavedResume) {
                SavedResume saved = savedResumeService.get(user.getId(), savedResumeId);
                parsedData = saved.getParsedProfile() != null
                        ? saved.getParsedProfile()
                        : resumeParserService.parseResumeFromText(saved.getRawText());
            } else {
                String extractedText = resumeTextExtractor.extract(file);
                if (extractedText.isBlank()) {
                    return ResponseEntity.badRequest().body(Map.of("detail",
                            "Couldn't read any text from that file — it may be a scanned image or corrupted."));
                }
                parsedData = resumeParserService.parseResumeFromText(extractedText);
                if (saveAsResume && user != null) {
                    try {
                        savedResumeService.upload(user.getId(), file, label, false);
                    } catch (Exception e) {
                        log.warn("Failed to save resume for reuse (user {}): {}", user.getId(), e.getMessage());
                    }
                }
            }

            // Convert to Map to save in session
            Map<String, Object> session = sessionStoreService.getSession(sessionId);
            if (session == null) {
                log.info("Session {} not found. Creating new session on the fly.", sessionId);
                session = new java.util.HashMap<>();
                session.put("status", "initialized");
                session.put("created_at", System.currentTimeMillis() / 1000.0);
            } else {
                // Unlike SessionController.createSession, this endpoint can hit an
                // EXISTING session — don't let it silently reassign ownership away
                // from whoever already owns it (see SessionController.getSession's
                // ownership check for the same pattern on the read path).
                Object existingOwner = session.get("user_id");
                if (existingOwner != null && (user == null || !existingOwner.equals(user.getId()))) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("detail", "You do not have access to this session"));
                }
            }
            if (user != null) {
                session.put("user_id", user.getId());
            }
            sessionStoreService.saveSession(sessionId, session);
            
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
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("detail", e.getMessage()));
        } catch (Exception e) {
            log.error("Resume parsing error: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("detail", "Failed to parse resume: " + e.getMessage()));
        }
    }
}
