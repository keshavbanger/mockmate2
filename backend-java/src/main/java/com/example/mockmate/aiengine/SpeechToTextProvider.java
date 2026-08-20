package com.example.mockmate.aiengine;

/**
 * Provider-neutral speech-to-text boundary for the AI Interview Engine
 * (beta) — see GroqWhisperSttProvider, which wraps the existing
 * GroqWhisperService rather than introducing a second Whisper integration.
 */
public interface SpeechToTextProvider {
    /** @return the transcribed text, or empty string if transcription failed */
    String transcribe(byte[] audioBytes, String filename);
}
