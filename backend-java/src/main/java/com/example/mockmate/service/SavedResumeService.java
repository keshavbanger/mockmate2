package com.example.mockmate.service;

import com.example.mockmate.dto.response.ResumeParsedResponse;
import com.example.mockmate.model.SavedResume;
import com.example.mockmate.repository.SavedResumeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.NoSuchElementException;

/**
 * Central store for "the user's saved resume(s)" — uploaded once via any
 * feature (Mock Interview, Technical Interview Lab, ATS Checker, Resume
 * Builder import), reusable from all of them instead of re-uploading the
 * same file per feature. See SavedResumeController for the REST surface.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SavedResumeService {

    private final SavedResumeRepository savedResumeRepository;
    private final ResumeTextExtractor resumeTextExtractor;
    private final ResumeParserService resumeParserService;

    public SavedResume upload(String userId, MultipartFile file, String label, boolean setAsDefault) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Please upload a file");
        }
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "resume";
        String lower = filename.toLowerCase();
        String fileType = lower.endsWith(".docx") ? "docx" : lower.endsWith(".pdf") ? "pdf" : null;
        if (fileType == null) {
            throw new IllegalArgumentException("Only PDF and DOCX files are supported");
        }

        String rawText = resumeTextExtractor.extract(file);

        ResumeParsedResponse parsedProfile = null;
        try {
            parsedProfile = resumeParserService.parseResumeFromText(rawText);
        } catch (Exception e) {
            // Structured parsing is a bonus (personalization elsewhere reads
            // it), rawText is the load-bearing piece every feature actually
            // needs — a Groq hiccup here shouldn't block saving the resume.
            log.warn("Structured parsing failed while saving resume for user {}: {}", userId, e.getMessage());
        }

        boolean isFirstResume = savedResumeRepository.countByUserId(userId) == 0;
        if (setAsDefault || isFirstResume) {
            clearExistingDefault(userId);
        }

        SavedResume resume = SavedResume.builder()
                .userId(userId)
                .label(label != null && !label.isBlank() ? label.trim() : stripExtension(filename))
                .fileName(filename)
                .fileType(fileType)
                .rawText(rawText)
                .parsedProfile(parsedProfile)
                .isDefault(setAsDefault || isFirstResume)
                .build();

        return savedResumeRepository.save(resume);
    }

    /** Lightweight list for pickers — callers needing rawText/parsedProfile should use get(). */
    public List<SavedResume> list(String userId) {
        return savedResumeRepository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    public SavedResume get(String userId, String resumeId) {
        return savedResumeRepository.findByIdAndUserId(resumeId, userId)
                .orElseThrow(() -> new NoSuchElementException("Saved resume not found"));
    }

    public SavedResume rename(String userId, String resumeId, String newLabel) {
        SavedResume resume = get(userId, resumeId);
        if (newLabel != null && !newLabel.isBlank()) {
            resume.setLabel(newLabel.trim());
        }
        return savedResumeRepository.save(resume);
    }

    public SavedResume setDefault(String userId, String resumeId) {
        SavedResume resume = get(userId, resumeId);
        clearExistingDefault(userId);
        resume.setDefault(true);
        return savedResumeRepository.save(resume);
    }

    public void delete(String userId, String resumeId) {
        SavedResume resume = get(userId, resumeId);
        savedResumeRepository.delete(resume);
    }

    private void clearExistingDefault(String userId) {
        savedResumeRepository.findByUserIdAndIsDefaultTrue(userId).ifPresent(existing -> {
            existing.setDefault(false);
            savedResumeRepository.save(existing);
        });
    }

    private String stripExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }
}
