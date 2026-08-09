package com.example.mockmate.service;

import com.example.mockmate.model.ATSReport;
import com.example.mockmate.model.AtsAnalysis;
import com.example.mockmate.model.HonestResumeAssessment;
import com.example.mockmate.repository.AtsAnalysisRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ATSAnalyzerService {

    private final ResumeTextExtractor resumeTextExtractor;
    private final ATSScoringService   atsScoringService;
    private final GroqATSService      groqATSService;
    private final ATSReportBuilder    atsReportBuilder;
    private final ATSDownloadService  atsDownloadService;
    private final ObjectMapper        objectMapper;
    private final AtsAnalysisRepository atsAnalysisRepository;

    static final String ATS_DIR = "reports/ats";

    // ── Main orchestration ─────────────────────────────────────────────────────────
    public ATSReport analyze(MultipartFile file, String jdText, String userId) {
        log.info("[ATS] Starting analysis userId={} file={}", userId, file.getOriginalFilename());

        // Step 1: Extract resume text
        String resumeText = resumeTextExtractor.extract(file);
        if (resumeText.isBlank()) {
            log.warn("[ATS] Extraction returned empty — file may be unsupported or empty");
        }

        // Step 2: Deterministic scoring (no API cost)
        ATSScoringService.ScoringResult scoring = atsScoringService.score(resumeText, jdText);

        // Step 3: JD-calibrated AI assessment (gracefully degrades if key missing or API fails)
        HonestResumeAssessment assessment = groqATSService.analyze(resumeText, jdText, scoring);

        // Step 4: Build final report
        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "resume";
        ATSReport report = atsReportBuilder.build(userId, fileName, resumeText, scoring, assessment);

        // Step 5: Persist to disk
        saveReport(report);

        // Step 6: Save raw text for Resume Studio (needed for DOCX generation)
        atsDownloadService.saveRawText(report.getReportId(), resumeText);
        
        // Step 7: Log to Database
        if (!"anonymous".equals(userId)) {
            AtsAnalysis analysis = AtsAnalysis.builder()
                    .userId(userId)
                    .reportId(report.getReportId())
                    .resumeFileName(fileName)
                    .finalScore(report.getFinalScore())
                    .verdict(report.getVerdict())
                    .build();
            atsAnalysisRepository.save(analysis);
        }

        log.info("[ATS] Report generated reportId={} score={} aiAvailable={}",
                report.getReportId(), report.getFinalScore(), report.isAiAnalysisAvailable());
        return report;
    }

    // ── Fetch by report ID ─────────────────────────────────────────────────────────
    public Optional<ATSReport> getReport(String reportId) {
        File file = reportFile(reportId);
        if (!file.exists()) return Optional.empty();
        try {
            return Optional.of(objectMapper.readValue(file, ATSReport.class));
        } catch (IOException e) {
            log.error("[ATS] Failed to read report file: {}", file.getPath(), e);
            return Optional.empty();
        }
    }

    // ── History for a user ─────────────────────────────────────────────────────────
    public List<ATSReport> getHistory(String userId) {
        File dir = new File(ATS_DIR);
        if (!dir.exists()) return List.of();

        List<ATSReport> results   = new ArrayList<>();
        File[]          jsonFiles = dir.listFiles((d, name) -> name.endsWith(".json"));
        if (jsonFiles == null) return List.of();

        for (File f : jsonFiles) {
            try {
                ATSReport r = objectMapper.readValue(f, ATSReport.class);
                if (userId.equals(r.getUserId())) results.add(r);
            } catch (IOException e) {
                log.warn("[ATS] Skipping unreadable report file: {}", f.getName());
            }
        }

        results.sort(Comparator.comparing(ATSReport::getTimestamp).reversed());
        return results;
    }

    // ── Disk persistence ───────────────────────────────────────────────────────────
    void saveReport(ATSReport report) {
        try {
            new File(ATS_DIR).mkdirs();
            objectMapper.writerWithDefaultPrettyPrinter()
                        .writeValue(reportFile(report.getReportId()), report);
        } catch (IOException e) {
            log.error("[ATS] Failed to save report to disk", e);
        }
    }

    File reportFile(String reportId) {
        return new File(ATS_DIR + "/" + reportId + ".json");
    }
}
