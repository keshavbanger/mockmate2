package com.example.mockmate.service;

import com.example.mockmate.model.ATSReport;
import com.example.mockmate.model.ImprovementScenario;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Computes deterministic "what-if" improvement scenarios.
 * No Groq calls.
 */
@Slf4j
@Service
public class ImprovementSimulatorService {

    public List<ImprovementScenario> computeScenarios(ATSReport report, String resumeText) {
        if (report == null) return List.of();

        int baseScore = report.getFinalScore();
        String text   = resumeText != null ? resumeText.toLowerCase() : "";

        List<ImprovementScenario> scenarios = new ArrayList<>();

        // ── Scenario 1: Add GitHub link ──────────────────────────────────────
        boolean hasGithub = text.contains("github.com/");
        if (!hasGithub) {
            scenarios.add(ImprovementScenario.builder()
                .scenarioName("Add GitHub Profile Link")
                .currentScore(baseScore)
                .projectedScore(clamp(baseScore + 8))
                .scoreGain(8)
                .fix("Add your GitHub URL (github.com/yourusername) to the resume header next to your email and phone.")
                .effort("5 minutes")
                .confidence(95)
                .build());
        }

        // ── Scenario 2: Add LinkedIn link ────────────────────────────────────
        boolean hasLinkedin = text.contains("linkedin.com/in/");
        if (!hasLinkedin) {
            scenarios.add(ImprovementScenario.builder()
                .scenarioName("Add LinkedIn Profile Link")
                .currentScore(baseScore)
                .projectedScore(clamp(baseScore + 3))
                .scoreGain(3)
                .fix("Add your LinkedIn URL (linkedin.com/in/yourname) to the resume header.")
                .effort("5 minutes")
                .confidence(90)
                .build());
        }

        // ── Scenario 3: Add missing critical keywords ─────────────────────────
        List<String> missing = report.getMissingKeywords() != null ? report.getMissingKeywords() : List.of();
        if (!missing.isEmpty()) {
            int gain = Math.min(20, missing.size() * 3);
            String keywordList = String.join(", ", missing.subList(0, Math.min(5, missing.size())));
            scenarios.add(ImprovementScenario.builder()
                .scenarioName("Add Missing Keywords")
                .currentScore(baseScore)
                .projectedScore(clamp(baseScore + gain))
                .scoreGain(gain)
                .fix("Add these keywords to your Skills section: " + keywordList + ".")
                .effort("15 minutes")
                .confidence(88)
                .build());
        }

        // ── Scenario 4: Improve bullet quantification ─────────────────────────
        if (report.getQuantificationScore() < 60) {
            scenarios.add(ImprovementScenario.builder()
                .scenarioName("Add Metrics to Bullets")
                .currentScore(baseScore)
                .projectedScore(clamp(baseScore + 8))
                .scoreGain(8)
                .fix("Add a number or percentage to at least 3 experience/project bullets. Example: 'Led a team' → 'Led a team of 5 developers'.")
                .effort("30 minutes")
                .confidence(85)
                .build());
        }

        // ── Scenario 5: Fix bullet action verbs ──────────────────────────────
        if (report.getActionVerbScore() < 60) {
            scenarios.add(ImprovementScenario.builder()
                .scenarioName("Strengthen Bullet Action Verbs")
                .currentScore(baseScore)
                .projectedScore(clamp(baseScore + 5))
                .scoreGain(5)
                .fix("Start each experience bullet with a strong past-tense verb: Built, Engineered, Designed, Implemented, Optimized.")
                .effort("20 minutes")
                .confidence(80)
                .build());
        }

        // ── Scenario 6: Add tech stack to projects ────────────────────────────
        boolean hasTechInProjects = text.contains("built using") || text.contains("tech stack") || text.contains("technologies used");
        if (!hasTechInProjects) {
            scenarios.add(ImprovementScenario.builder()
                .scenarioName("Add Tech Stack to Projects")
                .currentScore(baseScore)
                .projectedScore(clamp(baseScore + 5))
                .scoreGain(5)
                .fix("Add a 'Tech: Spring Boot, React, MySQL' line under each project description.")
                .effort("15 minutes")
                .confidence(82)
                .build());
        }

        // ── Scenario 7: Add dates to all experience entries ───────────────────
        boolean hasDates = text.matches("(?s).*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\\d{4}).*");
        if (!hasDates) {
            scenarios.add(ImprovementScenario.builder()
                .scenarioName("Add Dates to Experience Entries")
                .currentScore(baseScore)
                .projectedScore(clamp(baseScore + 5))
                .scoreGain(5)
                .fix("Add month/year start and end dates to every internship and work experience entry. Example: 'May 2023 – Aug 2023'.")
                .effort("10 minutes")
                .confidence(92)
                .build());
        }

        // Sort by score gain descending
        scenarios.sort(Comparator.comparingInt(ImprovementScenario::getScoreGain).reversed());

        // Compute cumulative "apply all" score
        int cumulativeGain = scenarios.stream().mapToInt(ImprovementScenario::getScoreGain).sum();
        log.info("[ImprovementSimulator] baseScore={} cumulativeGain={} projectedMax={}",
            baseScore, cumulativeGain, clamp(baseScore + cumulativeGain));

        return scenarios;
    }

    private int clamp(int score) {
        return Math.max(0, Math.min(100, score));
    }
}
