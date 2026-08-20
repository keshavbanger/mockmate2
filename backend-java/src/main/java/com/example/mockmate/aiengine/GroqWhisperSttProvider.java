package com.example.mockmate.aiengine;

import com.example.mockmate.service.GroqWhisperService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Delegates to the existing GroqWhisperService (already calling Groq's
 * hosted whisper-large-v3, already wired into the current Tavus flow's
 * /api/save-audio-turn) — genuine reuse, not a new STT integration.
 */
@Service
@RequiredArgsConstructor
public class GroqWhisperSttProvider implements SpeechToTextProvider {

    private final GroqWhisperService groqWhisperService;

    @Override
    public String transcribe(byte[] audioBytes, String filename) {
        return groqWhisperService.transcribe(audioBytes, filename);
    }
}
