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
        String resumeText = resumeTextExtractor.extract(file);
        if (resumeText.isBlank()) {
            log.warn("[ATS] Extraction returned empty — file may be unsupported or empty");
        }
        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "resume";
        return analyzeText(resumeText, fileName, jdText, userId);
    }

    // Split out so a saved resume (already-extracted text, no MultipartFile
    // to re-extract from) can go through the exact same scoring/persistence
    // pipeline instead of duplicating it — see SavedResumeService/
    // ATSController's savedResumeId handling.
    public ATSReport analyzeText(String resumeText, String fileName, String jdText, String userId) {
        // Step 2: Deterministic scoring (no API cost)
        ATSScoringService.ScoringResult scoring = atsScoringService.score(resumeText, jdText);

        // Step 3: JD-calibrated AI assessment (gracefully degrades if key missing or API fails)
        HonestResumeAssessment assessment = groqATSService.analyze(resumeText, jdText, scoring);

        // Step 4: Build final report
        ATSReport report = atsReportBuilder.build(userId, fileName, resumeText, scoring, assessment);

        // Step 5: Persist to disk — kept for ATSDownloadService's separate
        // DOCX-generation pipeline, which reads these files directly and is
        // out of scope here; report RETRIEVAL below no longer depends on it.
        saveReport(report);

        // Step 6: Save raw text for Resume Studio (needed for DOCX generation)
        atsDownloadService.saveRawText(report.getReportId(), resumeText);

        // Step 7: Log to Database — reportJson is now the primary, durable
        // copy of the full report; the disk file above is a secondary
        // artifact for the download pipeline only.
        if (!"anonymous".equals(userId)) {
            AtsAnalysis analysis = AtsAnalysis.builder()
                    .userId(userId)
                    .reportId(report.getReportId())
                    .resumeFileName(fileName)
                    .finalScore(report.getFinalScore())
                    .verdict(report.getVerdict())
                    .reportJson(report)
                    .build();
            atsAnalysisRepository.save(analysis);
        }

        log.info("[ATS] Report generated reportId={} score={} aiAvailable={}",
                report.getReportId(), report.getFinalScore(), report.isAiAnalysisAvailable());
        return report;
    }

    // ── Fetch by report ID ─────────────────────────────────────────────────────────
    // DB row (durable, survives redeploy/ephemeral-disk restarts) is now the
    // primary source; disk is only consulted for reports created before this
    // migration (a DB row exists with no reportJson yet, or no DB row at all
    // for anonymous-user reports, which were never logged to the DB).
    public Optional<ATSReport> getReport(String reportId) {
        Optional<AtsAnalysis> row = atsAnalysisRepository.findByReportId(reportId);
        if (row.isPresent() && row.get().getReportJson() != null) {
            return Optional.of(row.get().getReportJson());
        }
        return readFromDisk(reportId);
    }

    // ── History for a user ─────────────────────────────────────────────────────────
    // Previously scanned every file in reports/ats/ on every request — slow,
    // unpaginated, and lost on any ephemeral-disk restart. Now queries the DB
    // rows directly, falling back to disk per-row only for legacy analyses
    // saved before reportJson existed.
    public List<ATSReport> getHistory(String userId) {
        List<AtsAnalysis> rows = atsAnalysisRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<ATSReport> results = new ArrayList<>();
        for (AtsAnalysis row : rows) {
            if (row.getReportJson() != null) {
                results.add(row.getReportJson());
            } else {
                readFromDisk(row.getReportId()).ifPresent(results::add);
            }
        }
        return results;
    }

    private Optional<ATSReport> readFromDisk(String reportId) {
        File file = reportFile(reportId);
        if (!file.exists()) return Optional.empty();
        try {
            return Optional.of(objectMapper.readValue(file, ATSReport.class));
        } catch (IOException e) {
            log.error("[ATS] Failed to read report file: {}", file.getPath(), e);
            return Optional.empty();
        }
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
