package com.example.mockmate.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;

@Slf4j
@Service
public class GroqWhisperService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    public GroqWhisperService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.baseUrl("https://api.groq.com/openai/v1/").build();
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        if (groqApiKey != null) {
            groqApiKey = groqApiKey.trim().replace("\"", "").replace("'", "");
        }
    }

    public String transcribe(byte[] audioBytes, String filename) {
        if (groqApiKey == null || groqApiKey.isEmpty()) {
            log.error("Groq API Key is not configured for audio transcription.");
            return "";
        }

        try {
            MultipartBodyBuilder builder = new MultipartBodyBuilder();
            // Override getFilename to satisfy the multipart/form-data requirements of Groq's API
            ByteArrayResource fileResource = new ByteArrayResource(audioBytes) {
                @Override
                public String getFilename() {
                    return filename != null ? filename : "audio.webm";
                }
            };
            builder.part("file", fileResource, MediaType.parseMediaType("audio/webm"));
            builder.part("model", "whisper-large-v3");

            MultiValueMap<String, ?> body = builder.build();

            log.info("Sending audio transcription request to Groq for filename: {}", filename);
            String response = webClient.post()
                    .uri("audio/transcriptions")
                    .header("Authorization", "Bearer " + groqApiKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(body))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            var node = objectMapper.readTree(response);
            if (node.has("text")) {
                String text = node.path("text").asText().trim();
                log.info("Transcription successful: {} characters", text.length());
                return text;
            } else {
                log.error("Groq response missing text field: {}", response);
                return "";
            }
        } catch (Exception e) {
            log.error("Error during Groq audio transcription", e);
            return "";
        }
    }
}
