package com.example.mockmate.service;

import com.example.mockmate.model.CareerRoadmap;
import com.example.mockmate.model.CareerRoadmapContent;
import com.example.mockmate.model.SavedResume;
import com.example.mockmate.model.User;
import com.example.mockmate.model.techinterview.TechInterviewReport;
import com.example.mockmate.model.techinterview.TechInterviewReportEntity;
import com.example.mockmate.repository.CareerRoadmapRepository;
import com.example.mockmate.repository.SavedResumeRepository;
import com.example.mockmate.repository.TechInterviewReportRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Generates and caches a per-user, LLM-written career roadmap targeting
 * User.targetDomain — the one genuinely new content-generation piece of the
 * Dashboard roadmap feature (no curriculum data exists anywhere in this
 * codebase for arbitrary career domains, unlike the LeetCode-topic
 * recommendations in DSAProblemService.recommendForTopics, which reuse
 * already-computed report data).
 *
 * Reuses OpenRouterFallbackService.complete() directly as the primary call
 * (not just a last-resort fallback tier, unlike its use in
 * AIInterviewerService/InterviewPlanGeneratorService/
 * InterviewEvaluationService) since this feature doesn't need the extra
 * Groq-first reliability tier those interview-critical paths use.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CareerRoadmapService {

    private final CareerRoadmapRepository careerRoadmapRepository;
    private final TechInterviewReportRepository techInterviewReportRepository;
    private final SavedResumeRepository savedResumeRepository;
    private final OpenRouterFallbackService openRouterFallbackService;
    private final ObjectMapper objectMapper;

    private static final String SYSTEM_PROMPT = """
You are a career mentor helping a candidate reach a specific target role. \
Produce a realistic, phased learning roadmap tailored to their current status \
and any skill gaps already known about them. Return ONLY valid JSON, no \
markdown, no code fences, no explanation — a pure JSON object.
""";

    /**
     * Returns the cached roadmap, or generates one if none exists yet, the
     * user's targetDomain changed since the cached one, or forceRegenerate
     * is true (subject to a 24h cooldown against repeated LLM spend from
     * button-mashing). Returns null if the user hasn't set a targetDomain —
     * callers should show a CTA instead of calling this at all in that case.
     */
    public CareerRoadmapContent getOrGenerate(User user, boolean forceRegenerate) {
        if (user.getTargetDomain() == null || user.getTargetDomain().isBlank()) {
            return null;
        }

        Optional<CareerRoadmap> existingOpt = careerRoadmapRepository.findByUserId(user.getId());
        boolean domainChanged = existingOpt.isEmpty()
                || existingOpt.get().getTargetDomain() == null
                || !user.getTargetDomain().trim().equalsIgnoreCase(existingOpt.get().getTargetDomain().trim());

        if (existingOpt.isPresent() && !domainChanged) {
            if (!forceRegenerate) {
                return existingOpt.get().getRoadmapJson();
            }
            LocalDateTime generatedAt = existingOpt.get().getGeneratedAt();
            if (generatedAt != null && generatedAt.isAfter(LocalDateTime.now().minusHours(24))) {
                throw new IllegalArgumentException("You can regenerate your roadmap once every 24 hours.");
            }
        }

        CareerRoadmapContent content = generateViaLLM(user);

        CareerRoadmap toSave = existingOpt.orElseGet(() -> CareerRoadmap.builder().userId(user.getId()).build());
        toSave.setTargetDomain(user.getTargetDomain());
        toSave.setRoadmapJson(content);
        toSave.setGeneratedAt(LocalDateTime.now());
        careerRoadmapRepository.save(toSave);

        return content;
    }

    private CareerRoadmapContent generateViaLLM(User user) {
        String userPrompt = buildUserPrompt(user);
        try {
            String raw = openRouterFallbackService.complete(SYSTEM_PROMPT, userPrompt, 2048);
            if (raw != null) {
                return objectMapper.readValue(raw, CareerRoadmapContent.class);
            }
        } catch (Exception e) {
            log.warn("Career roadmap generation failed for user {}: {}", user.getId(), e.getMessage());
        }
        return buildFallbackRoadmap(user);
    }

    private String buildUserPrompt(User user) {
        List<TechInterviewReportEntity> techHistory = techInterviewReportRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        TechInterviewReport latestReport = (!techHistory.isEmpty()) ? techHistory.get(0).getReportJson() : null;
        Map<String, Integer> scoreByCategory = latestReport != null ? latestReport.getScoreByCategory() : null;

        Optional<SavedResume> defaultResume = savedResumeRepository.findByUserIdAndIsDefaultTrue(user.getId());
        List<String> skills = defaultResume.map(r -> r.getParsedProfile() != null ? r.getParsedProfile().getSkills() : null).orElse(null);

        return """
Target role/domain: %s
Target companies: %s
Current status: %s
College: %s
Year of study: %s
Known skills (from resume, may be empty): %s
Latest technical-interview category scores (0-100, may be empty): %s

Return this exact JSON structure:
{
  "summary": "2-3 sentence overview of the path from where they are now to the target role",
  "phases": [
    {
      "title": "string, e.g. Foundations",
      "durationWeeks": 4,
      "skillsToLearn": ["string"],
      "projectIdeas": ["string"],
      "milestones": ["string"]
    }
  ],
  "targetCompanyNotes": "1-2 sentences on what the named target companies specifically look for, or general advice if none were named"
}
Produce 3-5 phases, ordered earliest first. Be specific to the target domain, not generic career advice.
""".formatted(
                user.getTargetDomain(),
                blankToNone(user.getTargetCompanies()),
                blankToNone(user.getCurrentStatus()),
                blankToNone(user.getCollege()),
                blankToNone(user.getYearOfStudy()),
                skills != null && !skills.isEmpty() ? String.join(", ", skills) : "none on file",
                scoreByCategory != null && !scoreByCategory.isEmpty() ? scoreByCategory.toString() : "none on file"
        );
    }

    private String blankToNone(String value) {
        return (value == null || value.isBlank()) ? "not specified" : value;
    }

    private CareerRoadmapContent buildFallbackRoadmap(User user) {
        log.warn("Using fallback career roadmap for user {}", user.getId());
        CareerRoadmapContent.Phase phase = new CareerRoadmapContent.Phase();
        phase.setTitle("Get Started");
        phase.setDurationWeeks(4);
        phase.setSkillsToLearn(List.of("Core fundamentals for " + user.getTargetDomain()));
        phase.setProjectIdeas(List.of("Build one small end-to-end project in this domain"));
        phase.setMilestones(List.of("Complete a Tech Interview Lab session to get a personalized skill assessment"));

        CareerRoadmapContent content = new CareerRoadmapContent();
        content.setSummary("We couldn't generate a personalized roadmap right now — here's a starting point. Try regenerating in a bit.");
        content.setPhases(List.of(phase));
        content.setTargetCompanyNotes(null);
        return content;
    }
}
