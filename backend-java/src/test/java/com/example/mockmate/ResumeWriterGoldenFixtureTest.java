package com.example.mockmate;

import com.example.mockmate.model.GeneratedResume;
import com.example.mockmate.model.VerifiedResumeInput;
import com.example.mockmate.service.ResumeGenerationValidator;
import com.example.mockmate.service.ResumeWriterService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Part 4 of the Resume Generator Prompt Pack — the golden fixture. This is a
 * live integration test against the real writer LLM (not a mock), because
 * the whole point is asserting the actual generator's output shape, not a
 * stand-in for it. Skips gracefully (rather than failing) when no Groq key
 * is configured, since CI/dev environments without one shouldn't block on
 * this — see the java-doc on why: it needs the real system prompt's actual
 * behavior to mean anything.
 */
@SpringBootTest
class ResumeWriterGoldenFixtureTest {

    @Autowired private ResumeWriterService resumeWriterService;
    @Autowired private ResumeGenerationValidator validator;
    @Autowired private ObjectMapper objectMapper;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    // ── VERIFIED_KESHAV — the fixture from the prompt pack, built as what
    // the Fill Gaps Wizard would have produced after user confirmation. ────
    private VerifiedResumeInput buildVerifiedKeshav() {
        return VerifiedResumeInput.builder()
                .name("Keshav Banger")
                .targetJobTitle("Java Developer")
                .email("keshavbanger230815@acropolis.in")
                .phone("+91 9399148486")
                .location("Indore, M.P.")
                .linkedinUrl("linkedin.com/in/keshav-banger-68aa34256")
                .githubUrl("github.com/Keshavbanger")
                .degree("B.Tech")
                .specialization("Computer Science & Engineering")
                .institution("Acropolis Institute of Technology & Research, Indore (RGPV Bhopal)")
                .graduationMonthYear("2026")
                .graduationEndYear(2026)
                .includeCgpa(false) // below 7.0 — candidate elected to omit, per Fill Gaps default
                .cgpaValue(null)
                .coursework(List.of("Data Structures & Algorithms", "OOP", "DBMS", "Operating Systems"))
                // Only what was explicitly confirmed — no HTML/CSS/JS/Oracle,
                // matching the golden fixture's "note what is absent".
                .confirmedSkills(List.of(
                        "Java", "SQL", "Spring Boot", "Spring Data JPA", "Hibernate", "MySQL",
                        "Data Structures & Algorithms", "OOP", "DBMS", "Operating Systems"
                ))
                .projects(List.of(
                        VerifiedResumeInput.VerifiedEntry.builder()
                                .title("MockMate — Interview Simulation Platform")
                                .techStack("Java, Spring Boot, Spring Data JPA, Hibernate, MySQL")
                                .duration("2026")
                                .bullets(List.of(
                                        "Built an interview simulation engine with RESTful APIs and real-time avatar logic, supporting [N] concurrent sessions via Java multithreading",
                                        "Developed an integrated ATS that parses resumes and scores them against job descriptions using automated scoring pipelines",
                                        "Implemented performance-report generation with Spring Data JPA for persistent storage of candidate metrics"
                                ))
                                .build(),
                        VerifiedResumeInput.VerifiedEntry.builder()
                                .title("StreamSmart — Career Guidance Platform")
                                .techStack("Java, Spring Boot, Spring Data JPA, MySQL")
                                .duration("Ongoing")
                                .bullets(List.of(
                                        "Developed a career guidance platform serving personalised recommendations to Class 10 and 12 students via RESTful APIs",
                                        "Designed a dynamic quiz engine and degree exploration module following a layered Controller–Service–Repository architecture"
                                ))
                                .build()
                ))
                .experience(List.of())
                .achievements(List.of(
                        "1st Prize — Ekatra Hackathon, IIC-AIML 2025: AI-based detection model, 200+ competing teams",
                        "1st Prize — IEEE Ignite 2025 (Track 1): research on Ethical and Cognitive Responsibility in Generative AI",
                        "Ranked 7th — Kriyeta 5.0 Coding Competition, 250+ participants"
                ))
                .certifications(List.of(
                        "Java Programming Specialization — Coursera & LearnQuest: Core Java, OOP, Collections, Streams, Lambdas, Generics",
                        "Java Backend Development Training — EduPyramids, SINE (2024): RESTful APIs, Spring Boot, Database Integration"
                ))
                .leadership(List.of(
                        "Leader, Entrepreneurship Development Cell, AITR (2025–26)",
                        "Lead Coordinator, Cosmic Star Super 100 — in association with ISRO",
                        "Leader, E-Summit 2026, Acropolis Institution | IIC Regional Meet 2025"
                ))
                // Left blank by the candidate in the Fill Gaps wizard — must
                // stay a placeholder, not get resolved to an invented number.
                .placeholderResolutions(Map.of("project:0:0", ""))
                .includePersonalDetails(false)
                .jdText("Java Developer — backend role requiring Spring Boot, REST APIs, and SQL.")
                .build();
    }

    @Test
    void goldenFixtureMatchesExpectedShape() throws Exception {
        Assumptions.assumeTrue(groqApiKey != null && !groqApiKey.isBlank(),
                "Skipping — no GROQ_API_KEY configured, and this test needs the real writer LLM to mean anything.");

        VerifiedResumeInput verified = buildVerifiedKeshav();
        GeneratedResume out = resumeWriterService.generate(verified);

        // Excludes omittedFields: the writer is REQUIRED to name omitted PII
        // categories there (e.g. "father's or mother's name") to prove it
        // deliberately left them out, so that self-report must not trip
        // these same content checks — see ResumeGenerationValidator.
        var node = objectMapper.valueToTree(out);
        if (node instanceof com.fasterxml.jackson.databind.node.ObjectNode on) {
            on.remove("omittedFields");
        }
        String flat = objectMapper.writeValueAsString(node).toLowerCase();

        assertNotNull(out.getSummary());
        assertFalse(out.getSummary().toLowerCase().contains("however"), "Summary must never hedge");
        assertFalse(flat.contains("oracle"), "Oracle was never confirmed as a skill — must not appear");
        assertFalse(flat.contains("father"), "PII must never appear");
        assertFalse(flat.contains("html") && !flat.contains("javascript"), "Unconfirmed front-end skills must not appear");

        assertNotNull(out.getContact());
        assertEquals("Java Developer", out.getContact().getTargetTitle());

        // All generated skills must be a subset of what was confirmed.
        List<String> confirmedLower = verified.getConfirmedSkills().stream().map(String::toLowerCase).toList();
        for (var group : out.getSkills()) {
            for (String item : group.getItems()) {
                assertTrue(confirmedLower.contains(item.toLowerCase()),
                        "Generated skill '" + item + "' was never confirmed by the candidate");
            }
        }

        // The one blank-left placeholder should survive as unresolved, not
        // get silently invented into a plausible number.
        assertEquals(1, out.getUnresolvedPlaceholders() != null ? out.getUnresolvedPlaceholders().size() : 0,
                "Expected exactly one surviving placeholder (the [N] concurrent sessions the candidate left blank)");

        // The full post-validation suite (Part 3) must also accept this
        // output outright — ties the writer and validator together in one
        // live assertion instead of testing them in isolation.
        assertDoesNotThrow(() -> validator.validate(out, verified));
    }
}
