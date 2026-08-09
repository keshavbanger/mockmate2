package com.example.mockmate;

import com.example.mockmate.model.NormalizedResume;
import com.example.mockmate.model.TemplateConfig;
import com.example.mockmate.model.TemplateConfig.BorderStyle;
import com.example.mockmate.renderer.DocxRenderer;
import com.example.mockmate.renderer.HtmlRenderer;
import com.example.mockmate.renderer.LatexRenderer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ResumeRenderersTest {

    private NormalizedResume resume;
    private TemplateConfig config;

    @BeforeEach
    void setUp() {
        resume = NormalizedResume.builder()
            .name("John Doe")
            .jobTitle("Senior Engineer")
            .email("john.doe@example.com")
            .phone("555-0199")
            .location("New York, NY")
            .github("github.com/johndoe")
            .linkedin("linkedin.com/in/johndoe")
            .professionalSummary("Experienced backend engineer specializing in Spring Boot and Docker.")
            .education(NormalizedResume.NEducationEntry.builder()
                .institution("MIT")
                .degree("M.S. in Computer Science")
                .year("2018-2020")
                .cgpa("4.0")
                .relevantCoursework(List.of("Distributed Systems", "Cloud Computing"))
                .build())
            .skills(List.of(
                NormalizedResume.NSkillCategory.builder()
                    .label("Languages")
                    .value("Java, Go, Rust")
                    .build()
            ))
            .experience(List.of(
                NormalizedResume.NExperienceEntry.builder()
                    .company("BigCorp")
                    .role("Tech Lead")
                    .duration("2020 - Present")
                    .location("New York, NY")
                    .bullets(List.of("Led migration to microservices", "Mentored junior developers"))
                    .build()
            ))
            .projects(List.of(
                NormalizedResume.NProjectEntry.builder()
                    .title("CloudScheduler")
                    .techStack("Go, Kubernetes")
                    .duration("6 months")
                    .githubLink("github.com/johndoe/cloudscheduler")
                    .bullets(List.of("Developed distributed cron scheduler"))
                    .build()
            ))
            .achievements(List.of("Best Employee 2023"))
            .certifications(List.of("Google Cloud Professional Architect"))
            .leadership(List.of("Local meetup organizer"))
            .build();

        config = new TemplateConfig("0F172A", "059669", "1E293B", "64748B", 48, BorderStyle.LEFT);
    }

    @Test
    void testHtmlRenderer() {
        HtmlRenderer renderer = new HtmlRenderer();
        String result = renderer.renderToString(resume, config);
        
        assertNotNull(result);
        assertTrue(result.contains("<!DOCTYPE html>"));
        assertTrue(result.contains("John Doe"));
        assertTrue(result.contains("john.doe@example.com"));
        assertTrue(result.contains("Senior Engineer"));
        assertTrue(result.contains("BigCorp"));
        assertTrue(result.contains("CloudScheduler"));
        assertEquals("html", renderer.getOutputFormat());
    }

    @Test
    void testDocxRenderer() {
        DocxRenderer renderer = new DocxRenderer();
        byte[] bytes = renderer.renderToBytes(resume, config);

        assertNotNull(bytes);
        assertTrue(bytes.length > 0);
        assertEquals("docx", renderer.getOutputFormat());
    }

    @Test
    void testLatexRenderer() {
        LatexRenderer renderer = new LatexRenderer();
        String result = renderer.renderToString(resume, config);

        assertNotNull(result);
        assertTrue(result.contains("\\documentclass"));
        assertTrue(result.contains("John Doe"));
        assertTrue(result.contains("john.doe@example.com"));
        assertTrue(result.contains("BigCorp"));
        assertEquals("latex", renderer.getOutputFormat());
    }
}
