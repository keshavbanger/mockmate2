package com.example.mockmate.service;

import com.example.mockmate.model.AtsAnalysis;
import com.example.mockmate.model.ATSReport;
import com.example.mockmate.model.CategoryKeywordMatch;
import com.example.mockmate.model.Interview;
import com.example.mockmate.model.User;
import com.example.mockmate.model.techinterview.TechInterviewReport;
import com.example.mockmate.model.techinterview.TechInterviewReportEntity;
import com.example.mockmate.repository.AtsAnalysisRepository;
import com.example.mockmate.repository.InterviewRepository;
import com.example.mockmate.repository.TechInterviewReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Aggregates data already computed at report-generation time (study plans,
 * company-readiness percentages, category weights, ATS keyword-gap ranking)
 * into a single "what to work on next" view — the redesigned Dashboard's
 * whole reason to exist, since raw activity lists already live on Profile
 * and the three history pages.
 *
 * The three source tables use three DIFFERENT identity schemes — this is
 * not an oversight, it mirrors real bugs already found and fixed this
 * session (see DashboardController's earlier fix): TechInterviewReportEntity
 * and Interview are keyed by the account UUID; AtsAnalysis is keyed by the
 * caller's JWT email (AtsReportAccessGuard's convention, since ATS also
 * supports anonymous scans). Every lookup below uses the identity that
 * actually matches how that row was written, not user.getId() uniformly.
 */
@Service
@RequiredArgsConstructor
public class DashboardInsightsService {

    private static final List<String> COMPANY_READINESS_ORDER = List.of("GOOGLE", "AMAZON", "MICROSOFT", "ADOBE", "STARTUP");
    private static final Set<String> IMPORTANCE_RANK_ORDER = new LinkedHashSet<>(List.of("Critical", "Important", "Nice-to-have"));

    private final TechInterviewReportRepository techInterviewReportRepository;
    private final AtsAnalysisRepository atsAnalysisRepository;
    private final InterviewRepository interviewRepository;

    public Map<String, Object> buildInsights(User user) {
        List<TechInterviewReportEntity> techHistory = techInterviewReportRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        List<AtsAnalysis> atsHistory = atsAnalysisRepository.findByUserIdOrderByCreatedAtDesc(user.getEmail());
        List<Interview> interviewHistory = interviewRepository.findByUserIdOrderByCreatedAtDesc(user.getId());

        TechInterviewReportEntity latestTechEntity = firstOrNull(techHistory);
        AtsAnalysis latestAts = firstOrNull(atsHistory);
        Interview latestInterview = firstOrNull(interviewHistory);

        TechInterviewReport techReport = latestTechEntity != null ? latestTechEntity.getReportJson() : null;
        ATSReport atsReport = latestAts != null ? latestAts.getReportJson() : null;

        boolean hasActivity = techReport != null || atsReport != null || latestInterview != null;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hasActivity", hasActivity);
        if (!hasActivity) return result;

        result.put("readiness", buildReadiness(user, techReport, atsReport, latestInterview));
        result.put("focusItems", buildFocusItems(user, techReport, atsReport, latestInterview));
        result.put("streak", buildStreak(techHistory, atsHistory, interviewHistory));
        return result;
    }

    // ── Readiness ────────────────────────────────────────────────
    // Target company: prefer the user's persisted preference (a deliberate
    // setting, editable anytime from Profile) over whatever companyStyle
    // happened to be picked in their last completed session — a session
    // choice is an accident of what they clicked last time, not necessarily
    // still their goal.
    private Map<String, Object> buildReadiness(User user, TechInterviewReport techReport, ATSReport atsReport, Interview latestInterview) {
        Map<String, Object> readiness = new LinkedHashMap<>();

        String targetCompanyStyle = (user.getPrefCompanyStyle() != null && !user.getPrefCompanyStyle().isBlank())
                ? user.getPrefCompanyStyle()
                : (techReport != null ? techReport.getCompanyStyle() : null);

        if (techReport != null && targetCompanyStyle != null && techReport.getCompanyReadiness() != null) {
            String target = targetCompanyStyle.trim().toUpperCase();
            Optional<TechInterviewReport.CompanyReadiness> match = techReport.getCompanyReadiness().stream()
                    .filter(cr -> cr.getCompany() != null && cr.getCompany().trim().toUpperCase().replace(" ", "").equals(target))
                    .findFirst();
            if (match.isPresent()) {
                readiness.put("type", "company");
                readiness.put("company", match.get().getCompany());
                readiness.put("percent", match.get().getReadinessPercent());
                readiness.put("label", match.get().getCompany() + "-style: " + match.get().getReadinessPercent() + "% ready");
                readiness.put("breakdown", scoreBreakdown(techReport, atsReport, latestInterview));
                return readiness;
            }
        }

        // Fallback: blended average of whichever scores actually exist.
        List<Integer> scores = new ArrayList<>();
        if (atsReport != null) scores.add(atsReport.getFinalScore());
        if (techReport != null) scores.add(techReport.getOverallScore());
        if (latestInterview != null && latestInterview.getOverallScore() != null) scores.add(latestInterview.getOverallScore());
        int blended = scores.isEmpty() ? 0 : (int) Math.round(scores.stream().mapToInt(Integer::intValue).average().orElse(0));

        readiness.put("type", "blended");
        readiness.put("company", null);
        readiness.put("percent", blended);
        readiness.put("label", blended + "% Ready");
        readiness.put("breakdown", scoreBreakdown(techReport, atsReport, latestInterview));
        return readiness;
    }

    private Map<String, Object> scoreBreakdown(TechInterviewReport techReport, ATSReport atsReport, Interview latestInterview) {
        Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("ats", atsReport != null ? atsReport.getFinalScore() : null);
        breakdown.put("techInterview", techReport != null ? techReport.getOverallScore() : null);
        breakdown.put("mockInterview", latestInterview != null ? latestInterview.getOverallScore() : null);
        return breakdown;
    }

    // ── Focus items ──────────────────────────────────────────────
    private List<Map<String, Object>> buildFocusItems(User user, TechInterviewReport techReport, ATSReport atsReport, Interview latestInterview) {
        List<Map<String, Object>> items = new ArrayList<>();

        // 1. Weighted weakness — the category costing the most weighted
        // points, not just the lowest raw score.
        if (techReport != null && techReport.getScoreByCategory() != null && techReport.getCategoryWeights() != null) {
            String worstCategory = null;
            double worstImpact = -1;
            int worstWeight = 0;
            for (Map.Entry<String, Integer> entry : techReport.getScoreByCategory().entrySet()) {
                Integer weight = techReport.getCategoryWeights().get(entry.getKey());
                if (weight == null) continue;
                double impact = weight * (100 - entry.getValue()) / 100.0;
                if (impact > worstImpact) {
                    worstImpact = impact;
                    worstCategory = entry.getKey();
                    worstWeight = weight;
                }
            }
            if (worstCategory != null && worstImpact > 0) {
                items.add(focusItem("WEIGHTED_WEAKNESS", "critical",
                        worstCategory + " is dragging your score down the most",
                        worstCategory + " is " + worstWeight + "% of your weighting for this role and it's your weakest category — the single highest-leverage thing to fix.",
                        "Recurring weakness", "Technical Interview scoring",
                        "Practice " + worstCategory, "/tech-interview/setup"));
            }
        }

        // 2. ATS gap — the highest-importance category with the worst coverage.
        if (atsReport != null && atsReport.getCategoryKeywords() != null && !atsReport.getCategoryKeywords().isEmpty()) {
            List<CategoryKeywordMatch> gaps = atsReport.getCategoryKeywords().stream()
                    .filter(c -> c.getCoveragePercent() < 100 && c.getMissingKeywords() != null && !c.getMissingKeywords().isEmpty())
                    .sorted(Comparator
                            .comparing((CategoryKeywordMatch c) -> importanceRank(c.getImportance()))
                            .thenComparing(CategoryKeywordMatch::getCoveragePercent))
                    .toList();
            if (!gaps.isEmpty()) {
                CategoryKeywordMatch worst = gaps.get(0);
                String missing = String.join(", ", worst.getMissingKeywords().subList(0, Math.min(3, worst.getMissingKeywords().size())));
                items.add(focusItem("ATS_GAP", "warn",
                        "Your resume is missing " + worst.getCategory() + " keywords this JD weights heavily",
                        "\"" + missing + "\" appear in the job description but not in your resume — the biggest lever on your " + atsReport.getFinalScore() + "/100 score.",
                        "Resume gap", "Latest ATS scan",
                        "Fix resume", "/resume-builder"));
            }
        }

        // 3. Stale mock interview — only for users who actually have access
        // to it (Mock Interview is gated behind a paid plan/admin).
        boolean hasMockAccess = user.getPlanType() == User.PlanType.PRO || user.getRole() == User.UserRole.ADMIN;
        if (hasMockAccess) {
            boolean stale = latestInterview == null
                    || latestInterview.getCreatedAt() == null
                    || latestInterview.getCreatedAt().isBefore(LocalDateTime.now().minusDays(5));
            if (stale) {
                String detail = latestInterview == null
                        ? "You haven't run a Mock Interview yet — it's the only score that measures how you actually sound answering out loud."
                        : "Your last one was over 5 days ago. DSA/resume data is fresher — worth keeping this current too.";
                items.add(focusItem("STALE_MOCK", "info",
                        "Your communication score hasn't been checked in a while",
                        detail, "Keep it current", "Mock Interview",
                        "Start mock interview", "/setup"));
            }
        }

        // 4. Study plan next step — only as a 4th item if the first three
        // didn't already fill the panel; no per-user "week you're on"
        // tracking exists anywhere, so this always surfaces week1 honestly
        // as "your next step," not a fabricated progress state.
        if (items.size() < 3 && techReport != null && techReport.getStudyPlan() != null
                && techReport.getStudyPlan().getWeek1() != null && !techReport.getStudyPlan().getWeek1().isBlank()) {
            items.add(focusItem("STUDY_PLAN", "info",
                    "Pick up your study plan",
                    techReport.getStudyPlan().getWeek1(),
                    "From your last report", "4-week study plan",
                    "View full plan", "/tech-interview/history"));
        }

        return items.size() > 3 ? items.subList(0, 3) : items;
    }

    private int importanceRank(String importance) {
        if (importance == null) return IMPORTANCE_RANK_ORDER.size();
        int i = 0;
        for (String level : IMPORTANCE_RANK_ORDER) {
            if (level.equalsIgnoreCase(importance)) return i;
            i++;
        }
        return IMPORTANCE_RANK_ORDER.size();
    }

    private Map<String, Object> focusItem(String type, String severity, String title, String detail,
                                           String tag, String source, String ctaLabel, String ctaPath) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("type", type);
        item.put("severity", severity);
        item.put("title", title);
        item.put("detail", detail);
        item.put("tag", tag);
        item.put("source", source);
        item.put("ctaLabel", ctaLabel);
        item.put("ctaPath", ctaPath);
        return item;
    }

    // ── Streak ───────────────────────────────────────────────────
    // Derived from report/analysis creation timestamps (all DB-backed) —
    // deliberately NOT from TechInterviewSession start times, which only
    // live as local-disk JSON files (see TechInterviewStateService) and
    // would require an unindexed directory scan per user, the exact
    // anti-pattern already replaced elsewhere this session.
    private Map<String, Object> buildStreak(List<TechInterviewReportEntity> techHistory,
                                             List<AtsAnalysis> atsHistory,
                                             List<Interview> interviewHistory) {
        LocalDate cutoff = LocalDate.now().minusDays(6);
        Set<LocalDate> activeDays = new HashSet<>();
        for (TechInterviewReportEntity e : techHistory) collectDay(activeDays, e.getCreatedAt(), cutoff);
        for (AtsAnalysis a : atsHistory) collectDay(activeDays, a.getCreatedAt(), cutoff);
        for (Interview i : interviewHistory) collectDay(activeDays, i.getCreatedAt(), cutoff);

        Map<String, Object> streak = new LinkedHashMap<>();
        streak.put("activeDaysLast7", activeDays.size());
        streak.put("practicedToday", activeDays.contains(LocalDate.now()));
        return streak;
    }

    private void collectDay(Set<LocalDate> activeDays, LocalDateTime timestamp, LocalDate cutoff) {
        if (timestamp == null) return;
        LocalDate day = timestamp.toLocalDate();
        if (!day.isBefore(cutoff)) activeDays.add(day);
    }

    private <T> T firstOrNull(List<T> list) {
        return (list == null || list.isEmpty()) ? null : list.get(0);
    }
}
