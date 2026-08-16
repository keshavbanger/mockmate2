package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * The LLM-generated body of a {@link CareerRoadmap} — parsed straight from
 * OpenRouterFallbackService's JSON response (see CareerRoadmapService),
 * same pattern as InterviewPlanGeneratorService parsing InterviewPlan.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CareerRoadmapContent {
    private String summary;
    private List<Phase> phases;
    private String targetCompanyNotes;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Phase {
        private String title;
        private int durationWeeks;
        private List<String> skillsToLearn;
        private List<String> projectIdeas;
        private List<String> milestones;
    }
}
