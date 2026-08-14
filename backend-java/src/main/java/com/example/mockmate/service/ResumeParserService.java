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

    // Asks for the full resume structure in one pass — both the flat summary
    // fields (kept exactly as-is; QuestionGeneratorService/InterviewController/
    // QuestionController/ResumeController all read these for the mock-interview
    // flow) and the nested fields the Resume Builder's import needs. Before
    // this, only the flat fields existed, so importing a resume into the
    // Builder silently threw away every project, work-experience bullet,
    // certification, achievement, and most contact info — only name, email,
    // a flat skills list, and a 2-sentence summary survived.
    private static final String EXTRACTION_PROMPT = """
            Extract every section of the following resume and return ONLY valid JSON with this exact shape.
            Use empty string "", empty array [], or false where information isn't present — never omit a key.

            {
              "name": string — full name,
              "email": string,
              "phone": string,
              "location": string — city/state or address line,
              "linkedin": string — LinkedIn URL or handle if present,
              "github": string — GitHub URL or handle if present,
              "portfolio": string — personal website/portfolio URL if present,
              "professionalTitle": string — the candidate's headline/title if the resume has one (e.g. "Senior Backend Engineer"), else "",
              "summary": string — exactly 2-3 sentences summarising the candidate's profile,
              "skills": array of strings — every individual skill, flattened, no categories,
              "skillDetails": array of { "skill": string, "category": string } — same skills, but grouped under whatever category headings the resume itself uses (e.g. "Languages", "Frameworks", "Databases", "Tools"); if the resume has no categories, use a sensible category per skill,
              "totalExperienceYears": number — estimated total years of professional experience, 0 if fresher,
              "jobTitles": array of strings — every job/role title found (include leadership/club roles too),
              "companies": array of strings — every company/organization name found,
              "education": array of strings — each degree as one line, e.g. "B.Tech CS — NIT Trichy (2023)",
              "educationDetails": array of { "institution": string, "degree": string, "fieldOfStudy": string, "location": string, "startDate": string, "endDate": string, "gpa": string },
              "experience": array of { "jobTitle": string, "company": string, "location": string, "startDate": string, "endDate": string, "isCurrent": boolean, "bullets": array of strings — each responsibility/achievement as its own bullet, verbatim or lightly cleaned up },
              "projects": array of { "name": string, "description": string, "technologies": string — comma-separated, "bullets": array of strings — one per described capability/outcome },
              "certifications": array of { "name": string, "issuingOrganization": string, "issueDate": string },
              "achievements": array of { "title": string, "description": string, "date": string } — awards, rankings, hackathon wins, competitions, notable recognitions
            }

            Important:
            - Capture co-curricular/leadership roles (club lead, committee member, etc.) as entries in "experience" if they read like a role with responsibilities, not just a one-line mention.
            - Do not invent information that isn't in the resume text.
            - Return ONLY the raw JSON object. No markdown fences, no explanation, no extra text.

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
        
        // Truncate to ~18 000 chars — raised from 12 000 now that the prompt
        // asks for full section detail (bullets, dates, projects) rather than
        // just a flat summary, so denser multi-page resumes need more room
        // before hitting the cutoff.
        String truncatedText = rawText.length() > 18000 ? rawText.substring(0, 18000) : rawText;
        String prompt = EXTRACTION_PROMPT.replace("%s", truncatedText);

        return callGeminiApi(prompt);
    }

    private ResumeParsedResponse callGeminiApi(String prompt) {
        Map<String, Object> requestBody = Map.of(
            "model", "llama-3.1-8b-instant",
            "temperature", 0.2,
            // Raised from 2048 — the schema now includes full experience/
            // project/education entries with bullet arrays, not just a flat
            // summary, and 2048 was tight enough to risk truncating (and
            // therefore invalidating) the JSON for a dense multi-page resume.
            "max_tokens", 4096,
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
