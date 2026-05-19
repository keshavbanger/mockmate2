package com.example.mockmate.service;

import com.example.mockmate.dto.response.ResumeParsedResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ResumeParserService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    @jakarta.annotation.PostConstruct
    public void init() {
        if (groqApiKey != null) {
            groqApiKey = groqApiKey.trim().replace("\"", "").replace("'", "");
        }
        if (groqApiKey == null || groqApiKey.isEmpty()) {
            log.error("CRITICAL: Groq API Key is NOT configured correctly.");
        } else {
            log.info("Groq API Key loaded successfully for ResumeParser (Length: {}, starts with: {}...)", 
                groqApiKey.length(), groqApiKey.substring(0, Math.min(5, groqApiKey.length())));
        }
    }

    private static final String EXTRACTION_PROMPT = """
            Extract information from the following resume text and return ONLY valid JSON with these exact keys:
            - name (string): full name of the candidate
            - email (string): email address, empty string if not found
            - skills (array of strings): technical and soft skills listed
            - totalExperienceYears (number): estimated total years of professional experience, 0 if fresher
            - jobTitles (array of strings): all job/role titles found
            - companies (array of strings): all company/organization names found
            - education (array of strings): degrees and institutions, each as one string e.g. "B.Tech CS — NIT Trichy (2023)"
            - summary (string): exactly 2 sentences summarising the candidate's profile
            
            Important:
            - Return ONLY the raw JSON object. No markdown fences, no explanation, no extra text.
            - If a field cannot be determined, use an empty string or empty array as appropriate.
            
            Resume Text:
            \"\"\"
            %s
            \"\"\"
            """;

    public ResumeParserService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.baseUrl("https://api.groq.com/openai/v1/").build();
        this.objectMapper = objectMapper;
    }

    public String extractTextFromPdf(byte[] pdfBytes) throws Exception {
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String fullText = stripper.getText(document).trim();
            if (fullText.isEmpty()) {
                throw new IllegalArgumentException("PDF appears to contain no extractable text (scanned image?).");
            }
            log.info("Extracted {} characters from PDF", fullText.length());
            return fullText;
        }
    }

    public ResumeParsedResponse parseResumeWithGemini(byte[] pdfBytes) throws Exception {
        String rawText = extractTextFromPdf(pdfBytes);
        
        // Truncate to ~12 000 chars
        String truncatedText = rawText.length() > 12000 ? rawText.substring(0, 12000) : rawText;
        String prompt = EXTRACTION_PROMPT.replace("%s", truncatedText);

        return callGeminiApi(prompt);
    }

    private ResumeParsedResponse callGeminiApi(String prompt) {
        Map<String, Object> requestBody = Map.of(
            "model", "llama-3.1-8b-instant",
            "temperature", 0.2,
            "max_tokens", 2048,
            "messages", List.of(
                Map.of("role", "system", "content", "You are an ATS parser. Return ONLY valid JSON with no markdown formatting."),
                Map.of("role", "user",   "content", prompt)
            )
        );

        try {
            log.info("Calling Groq API for resume parsing with model: llama-3.1-8b-instant");
            String rawJsonResponse = webClient.post()
                    .uri("chat/completions")
                    .header("Authorization", "Bearer " + groqApiKey.trim())
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(status -> status.isError(), response -> 
                        response.bodyToMono(String.class).flatMap(body -> {
                            log.error("Groq API error body: {}", body);
                            return Mono.error(new RuntimeException("Groq API error: " + body));
                        })
                    )
                    .bodyToMono(String.class)
                    .block();
                    
            log.info("Groq API responded successfully.");
            return parseGeminiResponse(rawJsonResponse);
        } catch (Exception e) {
            log.error("Groq API error during resume parsing: {}", e.getMessage());
            throw new RuntimeException("Groq API error: " + e.getMessage(), e);
        }
    }

    private ResumeParsedResponse parseGeminiResponse(String responseJson) {
        try {
            var rootNode = objectMapper.readTree(responseJson);
            
            if (!rootNode.has("choices") || rootNode.path("choices").isEmpty()) {
                log.error("Groq response missing choices: {}", responseJson);
                throw new RuntimeException("Groq response missing choices");
            }

            var choice = rootNode.path("choices").get(0);
            String extractedText = choice.path("message").path("content").asText();

            String cleanJson = stripMarkdownFences(extractedText);
            return objectMapper.readValue(cleanJson, ResumeParsedResponse.class);
            
        } catch (Exception e) {
            log.error("Failed to parse Groq response. Error: {}. Response: {}", e.getMessage(), responseJson);
            throw new RuntimeException("Failed to parse Groq response: " + e.getMessage(), e);
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
