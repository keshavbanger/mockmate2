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

    @Value("${gemini.api-key}")
    private String geminiApiKey;

    @jakarta.annotation.PostConstruct
    public void init() {
        if (geminiApiKey != null) {
            geminiApiKey = geminiApiKey.trim().replace("\"", "").replace("'", "");
        }
        if (geminiApiKey == null || geminiApiKey.isEmpty() || geminiApiKey.contains("your_gemini_api_key")) {
            log.error("CRITICAL: Gemini API Key is NOT configured correctly. Current value: {}", geminiApiKey);
        } else {
            log.info("Gemini API Key loaded successfully (Length: {}, starts with: {}...)", 
                geminiApiKey.length(), geminiApiKey.substring(0, Math.min(5, geminiApiKey.length())));
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
        this.webClient = webClientBuilder.baseUrl("https://generativelanguage.googleapis.com/v1/models/").build();
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
        Map<String, Object> part = new HashMap<>();
        part.put("text", prompt);
        Map<String, Object> content = new HashMap<>();
        content.put("parts", List.of(part));
        
        Map<String, Object> finalBody = new HashMap<>();
        finalBody.put("contents", List.of(content));

        try {
            log.info("Calling Gemini API for resume parsing with model: gemini-1.5-flash");
            String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;
            String rawJsonResponse = webClient.post()
                    .uri(url)
                    .bodyValue(finalBody)
                    .retrieve()
                    .onStatus(status -> status.isError(), response -> 
                        response.bodyToMono(String.class).flatMap(body -> {
                            log.error("Gemini API error body: {}", body);
                            return Mono.error(new RuntimeException("Gemini API error: " + body));
                        })
                    )
                    .bodyToMono(String.class)
                    .block();
                    
            log.info("Gemini API responded successfully.");
            return parseGeminiResponse(rawJsonResponse);
        } catch (Exception e) {
            log.error("Gemini API error during resume parsing: {}", e.getMessage());
            throw new RuntimeException("Gemini API error: " + e.getMessage(), e);
        }
    }

    private ResumeParsedResponse parseGeminiResponse(String responseJson) {
        try {
            var rootNode = objectMapper.readTree(responseJson);
            
            if (!rootNode.has("candidates") || rootNode.path("candidates").isEmpty()) {
                log.error("Gemini response missing candidates: {}", responseJson);
                throw new RuntimeException("Gemini response missing candidates");
            }

            var candidate = rootNode.path("candidates").get(0);
            var content = candidate.path("content");
            var parts = content.path("parts");
            
            if (parts.isEmpty()) {
                log.error("Gemini response missing content parts: {}", responseJson);
                throw new RuntimeException("Gemini response missing content parts");
            }

            String extractedText = parts.get(0).path("text").asText();

            String cleanJson = stripMarkdownFences(extractedText);
            return objectMapper.readValue(cleanJson, ResumeParsedResponse.class);
            
        } catch (Exception e) {
            log.error("Failed to parse Gemini response. Error: {}. Response: {}", e.getMessage(), responseJson);
            throw new RuntimeException("Failed to parse Gemini response: " + e.getMessage(), e);
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
