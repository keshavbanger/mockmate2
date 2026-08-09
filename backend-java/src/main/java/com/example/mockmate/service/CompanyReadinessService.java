package com.example.mockmate.service;

import com.example.mockmate.model.ATSReport;
import com.example.mockmate.model.CompanyFit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Computes company-specific readiness scores deterministically.
 * No Groq calls.
 */
@Slf4j
@Service
public class CompanyReadinessService {

    public List<CompanyFit> computeCompanyFit(ATSReport report, String resumeText) {
        if (report == null) return List.of();

        int finalScore = report.getFinalScore();
        String text    = resumeText != null ? resumeText.toLowerCase() : "";

        // ── Bonus/Penalty signals ─────────────────────────────────────────────
        boolean hasHackathon  = text.contains("hackathon") || text.contains("1st") || text.contains("rank");
        boolean hasGithub     = text.contains("github.com/");
        boolean hasProjects   = text.contains("project");
        boolean hasInternship = text.contains("internship") || text.contains("intern");
        boolean lowCgpa       = text.matches("(?s).*(cgpa|gpa)[^\\d]*[0-5]\\.[0-9].*");

        int hackBonus     = hasHackathon  ? 10 : 0;
        int githubBonus   = hasGithub     ? 5  : 0;
        int projectPenalty= hasProjects   ? 0  : -10;
        int internBonus   = hasInternship ? 5  : 0;
        int cgpaPenalty   = lowCgpa       ? -15 : 0;

        List<CompanyFit> fits = new ArrayList<>();

        // ── Tier 1 — Top Indian Product Companies ─────────────────────────────
        String[] tier1 = { "Flipkart", "Zepto", "CRED", "Razorpay", "Juspay",
                           "Meesho", "PhonePe", "Swiggy", "Zomato", "Groww" };
        for (String company : tier1) {
            int base = Math.max(0, finalScore - 20);
            int fit  = clamp(base + hackBonus + githubBonus + projectPenalty + internBonus + cgpaPenalty);
            fits.add(CompanyFit.builder()
                .companyName(company)
                .tier("Tier1")
                .fitPercent(fit)
                .reason(buildReason(fit, "Tier 1 product company", finalScore))
                .gaps(buildGaps(fit, hasGithub, hasProjects, hasInternship, report.getMissingKeywords()))
                .build());
        }

        // ── Tier 1 — MNC India Offices ────────────────────────────────────────
        String[] tier1Mnc = { "Google India", "Microsoft India", "Amazon India", "Adobe India", "Atlassian India" };
        for (String company : tier1Mnc) {
            int base = Math.max(0, finalScore - 20);
            int fit  = clamp(base + hackBonus + githubBonus + projectPenalty + internBonus + cgpaPenalty);
            fits.add(CompanyFit.builder()
                .companyName(company)
                .tier("Tier1")
                .fitPercent(fit)
                .reason(buildReason(fit, "MNC India office", finalScore))
                .gaps(buildGaps(fit, hasGithub, hasProjects, hasInternship, report.getMissingKeywords()))
                .build());
        }

        // ── Tier 2 — Mid-size Product Companies ──────────────────────────────
        String[] tier2 = { "Dream11", "BrowserStack", "Freshworks", "Postman", "Oracle India" };
        for (String company : tier2) {
            int base = Math.max(0, finalScore - 10);
            int fit  = clamp(base + hackBonus + githubBonus + projectPenalty + internBonus);
            fits.add(CompanyFit.builder()
                .companyName(company)
                .tier("Tier2")
                .fitPercent(fit)
                .reason(buildReason(fit, "Tier 2 product company", finalScore))
                .gaps(buildGaps(fit, hasGithub, hasProjects, hasInternship, report.getMissingKeywords()))
                .build());
        }

        // ── Service Companies ─────────────────────────────────────────────────
        String[] service = { "TCS", "Infosys", "Wipro", "HCL", "Capgemini", "Cognizant", "Accenture India" };
        for (String company : service) {
            int fit = clamp(Math.min(100, finalScore + 10) + internBonus);
            fits.add(CompanyFit.builder()
                .companyName(company)
                .tier("Service")
                .fitPercent(fit)
                .reason(buildReason(fit, "IT service company", finalScore))
                .gaps(buildGaps(fit, hasGithub, hasProjects, hasInternship, report.getMissingKeywords()))
                .build());
        }

        log.info("[CompanyReadiness] Computed fit for {} companies, baseScore={}", fits.size(), finalScore);
        return fits;
    }

    private String buildReason(int fit, String tier, int baseScore) {
        if (fit >= 80) return "Resume score of " + baseScore + " meets " + tier + " minimum bar with strong signals.";
        if (fit >= 60) return "Moderate fit for " + tier + ". Closing keyword gaps will significantly increase chances.";
        if (fit >= 40) return "Below average fit for " + tier + ". Significant improvements needed before applying.";
        return "Score of " + baseScore + " is below the minimum bar for most " + tier + " openings.";
    }

    private List<String> buildGaps(int fit, boolean hasGithub, boolean hasProjects,
                                   boolean hasInternship, List<String> missingKeywords) {
        List<String> gaps = new ArrayList<>();
        if (!hasGithub)     gaps.add("Add GitHub profile link to resume header");
        if (!hasProjects)   gaps.add("Add at least 2 technical projects with tech stack");
        if (!hasInternship) gaps.add("Internship experience would significantly improve fit");
        if (missingKeywords != null && !missingKeywords.isEmpty()) {
            int limit = Math.min(3, missingKeywords.size());
            gaps.add("Missing keywords: " + String.join(", ", missingKeywords.subList(0, limit)));
        }
        if (fit < 50) gaps.add("Improve overall ATS score to 70+ before targeting this company");
        return gaps;
    }

    private int clamp(int val) {
        return Math.max(0, Math.min(100, val));
    }
}
