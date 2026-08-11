package com.example.mockmate.service;

import com.example.mockmate.model.ATSReport;
import jakarta.annotation.PreDestroy;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class ATSCompareService {

    private final ATSAnalyzerService atsAnalyzerService;

    // The two analyze() calls below are fully independent (different files,
    // same jdText) but each blocks on a Groq call for several seconds — used
    // to run back-to-back, so a slow/erroring Groq call on file A delayed
    // even starting file B. A dedicated executor (not the shared
    // ForkJoinPool.commonPool(), see ReportGeneratorService for the same
    // reasoning) lets them run concurrently without risking unrelated app
    // code being starved by these long blocking calls.
    private final ExecutorService compareExecutor =
            Executors.newCachedThreadPool(namedThreadFactory("ats-compare"));

    @PreDestroy
    public void shutdown() {
        compareExecutor.shutdown();
    }

    private static java.util.concurrent.ThreadFactory namedThreadFactory(String prefix) {
        AtomicInteger counter = new AtomicInteger(1);
        return runnable -> {
            Thread t = new Thread(runnable, prefix + "-" + counter.getAndIncrement());
            t.setDaemon(true);
            return t;
        };
    }

    // ── Result DTO ─────────────────────────────────────────────────────────────────
    @Data
    @Builder
    public static class ATSCompareResult {
        private ATSReport    reportA;
        private ATSReport    reportB;
        private String       winner;          // "A" | "B" | "tie"
        private List<String> keyDifferences;
    }

    // ── Main compare flow ──────────────────────────────────────────────────────────
    public ATSCompareResult compare(MultipartFile fileA,
                                    MultipartFile fileB,
                                    String jdText,
                                    String userId) {

        log.info("[ATSCompare] Comparing two resumes for userId={}", userId);

        CompletableFuture<ATSReport> futureA =
                CompletableFuture.supplyAsync(() -> atsAnalyzerService.analyze(fileA, jdText, userId), compareExecutor);
        CompletableFuture<ATSReport> futureB =
                CompletableFuture.supplyAsync(() -> atsAnalyzerService.analyze(fileB, jdText, userId), compareExecutor);
        CompletableFuture.allOf(futureA, futureB).join();

        ATSReport reportA = futureA.join();
        ATSReport reportB = futureB.join();

        String       winner         = determineWinner(reportA, reportB);
        List<String> keyDifferences = buildKeyDifferences(reportA, reportB);

        log.info("[ATSCompare] scoreA={} scoreB={} winner={}",
                reportA.getFinalScore(), reportB.getFinalScore(), winner);

        return ATSCompareResult.builder()
                .reportA(reportA)
                .reportB(reportB)
                .winner(winner)
                .keyDifferences(keyDifferences)
                .build();
    }

    // ── Winner logic ───────────────────────────────────────────────────────────────
    private String determineWinner(ATSReport a, ATSReport b) {
        int diff = a.getFinalScore() - b.getFinalScore();
        if (diff > 2)  return "A";
        if (diff < -2) return "B";
        return "tie";
    }

    // ── Key difference builder ─────────────────────────────────────────────────────
    private List<String> buildKeyDifferences(ATSReport a, ATSReport b) {
        List<String> diffs = new ArrayList<>();

        // Overall score
        int scoreDiff = a.getFinalScore() - b.getFinalScore();
        if (Math.abs(scoreDiff) > 2) {
            diffs.add(String.format("Resume %s scores %d points higher overall (%d vs %d)",
                    scoreDiff > 0 ? "A" : "B",
                    Math.abs(scoreDiff),
                    a.getFinalScore(), b.getFinalScore()));
        }

        // Keyword overlap
        int kwDiff = a.getKeywordOverlapScore() - b.getKeywordOverlapScore();
        if (Math.abs(kwDiff) >= 10) {
            diffs.add(String.format("Resume %s has stronger keyword alignment (%d vs %d)",
                    kwDiff > 0 ? "A" : "B",
                    a.getKeywordOverlapScore(), b.getKeywordOverlapScore()));
        }

        // Section health
        int secDiff = a.getSectionScore() - b.getSectionScore();
        if (Math.abs(secDiff) >= 10) {
            diffs.add(String.format("Resume %s has more complete section structure (%d vs %d)",
                    secDiff > 0 ? "A" : "B",
                    a.getSectionScore(), b.getSectionScore()));
        }

        // Quantification
        int quantDiff = a.getQuantificationScore() - b.getQuantificationScore();
        if (Math.abs(quantDiff) >= 10) {
            diffs.add(String.format("Resume %s uses more quantified metrics (%d vs %d)",
                    quantDiff > 0 ? "A" : "B",
                    a.getQuantificationScore(), b.getQuantificationScore()));
        }

        // Formatting
        int fmtDiff = a.getFormattingScore() - b.getFormattingScore();
        if (Math.abs(fmtDiff) >= 15) {
            diffs.add(String.format("Resume %s has fewer ATS formatting risks (%d vs %d)",
                    fmtDiff > 0 ? "A" : "B",
                    a.getFormattingScore(), b.getFormattingScore()));
        }

        // Semantic match (AI)
        if (a.isAiAnalysisAvailable() && b.isAiAnalysisAvailable()) {
            int semDiff = a.getSemanticScore() - b.getSemanticScore();
            if (Math.abs(semDiff) >= 10) {
                diffs.add(String.format("Resume %s scores higher on semantic relevance (%d vs %d)",
                        semDiff > 0 ? "A" : "B",
                        a.getSemanticScore(), b.getSemanticScore()));
            }
        }

        // Role alignment (AI)
        if (a.isAiAnalysisAvailable() && b.isAiAnalysisAvailable()) {
            int roleDiff = a.getRoleAlignmentScore() - b.getRoleAlignmentScore();
            if (Math.abs(roleDiff) >= 10) {
                diffs.add(String.format("Resume %s aligns better with the target role (%d vs %d)",
                        roleDiff > 0 ? "A" : "B",
                        a.getRoleAlignmentScore(), b.getRoleAlignmentScore()));
            }
        }

        if (diffs.isEmpty()) {
            diffs.add("Both resumes perform similarly across all dimensions — the difference is negligible.");
        }

        return diffs;
    }
}
