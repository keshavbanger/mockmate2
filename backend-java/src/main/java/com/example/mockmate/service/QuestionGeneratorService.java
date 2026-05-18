package com.example.mockmate.service;

import com.example.mockmate.dto.response.ResumeParsedResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class QuestionGeneratorService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api-key}")
    private String geminiApiKey;

    private static final String QUESTION_PROMPT = """
            Generate exactly 7 interview questions for a %s level %s interview.
            
            Candidate profile:
            - Skills: %s
            - Job titles held: %s
            - Companies worked at: %s
            - Education: %s
            - Total experience: %.1f years
            
            Requirements:
            - Questions must be progressively harder (Q1 easiest -> Q7 hardest).
            - Interview type is "%s": tailor questions accordingly.
              - Technical: focus on coding, system design, architecture, problem-solving
              - Behavioral: focus on STAR-method situational questions
              - HR: focus on culture fit, motivation, salary, goals
              - Mixed: blend of all three types
            - Difficulty level is "%s":
              - Junior: foundational concepts, basic scenarios
              - Mid: intermediate depth, real-world trade-offs
              - Senior: complex, leadership, architectural decisions
            - Language instruction: questions should be asked in %s.
              - English: standard professional English
              - Hindi: modern Hindi with technical terms kept in English
              - Hinglish: natural mix of Hindi and English as spoken in Indian tech interviews
            - Do NOT number the questions inside the strings.
            - Return ONLY a JSON array of exactly 7 strings. No markdown, no explanation, no extra text.
            
            Example format:
            ["Question one?", "Question two?", "Question three?", "Question four?", "Question five?", "Question six?", "Question seven?"]
            """;

    public QuestionGeneratorService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.baseUrl("https://generativelanguage.googleapis.com/v1/models/").build();
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        if (geminiApiKey != null) {
            geminiApiKey = geminiApiKey.trim().replace("\"", "").replace("'", "");
            log.info("QuestionGeneratorService: Gemini API Key sanitized.");
        }
    }

    public List<String> generateQuestions(
            ResumeParsedResponse resumeData,
            String interviewType,
            String difficulty,
            String language
    ) {
        String skillsStr = String.join(", ", resumeData.getSkills().isEmpty() ? List.of("Not specified") : resumeData.getSkills())
                .replace("%", "%%");
        String jobTitlesStr = String.join(", ", resumeData.getJobTitles().isEmpty() ? List.of("Not specified") : resumeData.getJobTitles())
                .replace("%", "%%");
        String companiesStr = String.join(", ", resumeData.getCompanies().isEmpty() ? List.of("Not specified") : resumeData.getCompanies())
                .replace("%", "%%");
        String educationStr = String.join(", ", resumeData.getEducation().isEmpty() ? List.of("Not specified") : resumeData.getEducation())
                .replace("%", "%%");
        double expYears = resumeData.getTotalExperienceYears();

        String prompt = String.format(QUESTION_PROMPT,
                difficulty,
                interviewType,
                skillsStr,
                jobTitlesStr,
                companiesStr,
                educationStr,
                expYears,
                interviewType,
                difficulty,
                language
        );

        return callGeminiApi(prompt);
    }

    private List<String> callGeminiApi(String prompt) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("contents", List.of(
                Map.of("parts", List.of(Map.of("text", prompt)))
        ));

        String url = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;

        try {
            String rawJsonResponse = webClient.post()
                    .uri(url)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return parseGeminiResponse(rawJsonResponse);
        } catch (Exception e) {
            log.error("Gemini API error during question generation", e);
            throw new RuntimeException("Gemini API error: " + e.getMessage(), e);
        }
    }

    private List<String> parseGeminiResponse(String responseJson) {
        try {
            var rootNode = objectMapper.readTree(responseJson);
            
            if (!rootNode.has("candidates") || rootNode.path("candidates").isEmpty()) {
                log.error("Gemini response missing candidates: {}", responseJson);
                throw new RuntimeException("Gemini response missing candidates");
            }

            String extractedText = rootNode
                    .path("candidates")
                    .get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .asText();

            String cleanJson = stripMarkdownFences(extractedText);
            
            List<String> questions = objectMapper.readValue(cleanJson, new TypeReference<List<String>>() {});

            if (questions.size() < 7) {
                log.warn("Gemini returned only {} questions; padding.", questions.size());
                while (questions.size() < 7) {
                    questions.add("Tell me more about your experience.");
                }
            } else if (questions.size() > 7) {
                log.warn("Gemini returned {} questions; trimming to 7.", questions.size());
                questions = new ArrayList<>(questions.subList(0, 7));
            }

            return questions.stream().map(String::trim).collect(Collectors.toList());

        } catch (Exception e) {
            log.error("Failed to parse Gemini response: {}", responseJson, e);
            throw new RuntimeException("Failed to parse Gemini response", e);
        }
    }

    private String stripMarkdownFences(String text) {
        String clean = text.trim();
        if (clean.startsWith("```json")) {
            clean = clean.substring(7);
        } else if (clean.startsWith("```")) {
            clean = clean.substring(3);
        }
        if (clean.endsWith("```")) {
            clean = clean.substring(0, clean.length() - 3);
        }
        return clean.trim();
    }
}
