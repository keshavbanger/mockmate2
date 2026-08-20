package com.example.mockmate.aiengine;

/**
 * Provider-neutral chat-completion boundary for the AI Interview Engine
 * (beta, no-Tavus) feature — see GroqLlmProvider for the first
 * implementation. Keeping InterviewEngineService/TurnClassifierService
 * dependent on this interface, not on Groq directly, means a future
 * OllamaLlmProvider/OpenRouterLlmProvider/MockLlmProvider can be swapped in
 * via Spring config without touching the engine.
 */
public interface LlmProvider {
    /**
     * @param systemPrompt        persona/behavior instructions
     * @param conversationContext prior turns, formatted as plain text (caller's choice of format)
     * @param userMessage         the latest message to respond to
     * @return the model's reply text, or null if the provider is unavailable/failed
     */
    String generateResponse(String systemPrompt, String conversationContext, String userMessage);

    /**
     * Same contract as generateResponse, but requests the provider's JSON
     * mode so the reply is reliably parseable — used for the structured
     * evaluate/strategize and question-generation calls (see
     * InterviewEngineService). Callers still do their own
     * objectMapper.readValue() and should be ready to handle malformed
     * output regardless of JSON mode (bounded retry, not a guarantee).
     *
     * @return raw JSON string, or null if the provider is unavailable/failed
     */
    String generateJson(String systemPrompt, String userPrompt, int maxTokens);

    /** Whether this provider is usable right now (e.g. an API key is configured). */
    default boolean isAvailable() {
        return true;
    }
}
