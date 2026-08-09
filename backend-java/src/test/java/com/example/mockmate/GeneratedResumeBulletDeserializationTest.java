package com.example.mockmate;

import com.example.mockmate.model.GeneratedResume;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Weaker fallback models (e.g. llama-3.1-8b-instant) sometimes flatten a
 * project bullet to a plain JSON string instead of the {text,
 * has_placeholder} object the writer prompt specifies. Reproduces that exact
 * failure (seen live: "Cannot construct instance of ...Bullet ... no
 * String-argument constructor") and confirms the @JsonCreator fallback on
 * GeneratedResume.Bullet tolerates it. No network call — pure deserialization.
 */
class GeneratedResumeBulletDeserializationTest {

    // Mirrors ResumeWriterService's snakeCaseMapper construction exactly,
    // including findAndRegisterModules(), to rule out any module/feature
    // interaction the simpler bare-ObjectMapper test might miss.
    private final ObjectMapper mapper = buildMapperLikeResumeWriterService();

    private static ObjectMapper buildMapperLikeResumeWriterService() {
        ObjectMapper base = new ObjectMapper();
        base.findAndRegisterModules();
        return base.copy()
                .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .enable(JsonParser.Feature.ALLOW_TRAILING_COMMA)
                .enable(JsonParser.Feature.ALLOW_COMMENTS)
                .enable(JsonParser.Feature.ALLOW_UNQUOTED_FIELD_NAMES)
                .enable(JsonParser.Feature.ALLOW_SINGLE_QUOTES);
    }

    @Test
    void toleratePlainStringBullet() throws Exception {
        String json = """
                {"contact": {"name": "Test"}, "summary": "s",
                 "projects": [{"title": "P", "bullets": [
                     "Built a Java Spring Boot engine with RESTful APIs.",
                     {"text": "Second bullet with [N] placeholder", "has_placeholder": true}
                 ]}]}
                """;
        GeneratedResume out = mapper.readValue(json, GeneratedResume.class);
        var bullets = out.getProjects().get(0).getBullets();
        assertEquals(2, bullets.size());
        assertEquals("Built a Java Spring Boot engine with RESTful APIs.", bullets.get(0).getText());
        assertFalse(bullets.get(0).isHasPlaceholder());
        assertEquals("Second bullet with [N] placeholder", bullets.get(1).getText());
        assertTrue(bullets.get(1).isHasPlaceholder());
    }

    @Test
    void stillParsesObjectShapedBullet() throws Exception {
        String json = """
                {"projects": [{"title": "P", "bullets": [
                    {"text": "Only object shape", "has_placeholder": false}
                ]}]}
                """;
        GeneratedResume out = mapper.readValue(json, GeneratedResume.class);
        assertEquals("Only object shape", out.getProjects().get(0).getBullets().get(0).getText());
    }
}
