package com.example.mockmate.config;

/**
 * Static style-guide strings injected into the Groq prompt per company.
 * "general" returns empty string → existing behaviour is fully preserved.
 */
public final class CompanyPromptConfig {

    private CompanyPromptConfig() {}

    public static String getStyleGuide(String companyId) {
        if (companyId == null) return "";
        return switch (companyId.toLowerCase().trim()) {
            case "google" -> """
                    INTERVIEW STYLE: Google. Focus on problem-solving process over final answer. \
                    Include 1 system design question at Google scale. \
                    Ask about handling ambiguity. Probe algorithmic thinking. \
                    Value candidates who think out loud.""";

            case "amazon" -> """
                    INTERVIEW STYLE: Amazon. Every behavioral question must map to one of Amazon's \
                    Leadership Principles. Label each question with its principle in brackets \
                    e.g. [Customer Obsession]. Include questions on Ownership, Dive Deep, \
                    Bias for Action, Deliver Results. Ask about a failure and what was learned.""";

            case "microsoft" -> """
                    INTERVIEW STYLE: Microsoft. Emphasize growth mindset and learning from failure. \
                    Ask about collaboration and inclusive teamwork. \
                    Include a design question for an existing Microsoft product. \
                    Ask one genuine Why Microsoft question.""";

            case "flipkart" -> """
                    INTERVIEW STYLE: Flipkart. Focus on product thinking and e-commerce domain. \
                    Ask about improving a Flipkart feature. \
                    Include a metrics question: how would you measure success of X. \
                    Ask about Indian market challenges: scale, regional users, Big Billion Days traffic.""";

            case "startup" -> """
                    INTERVIEW STYLE: High-growth startup. Prioritize ownership mindset and comfort \
                    with ambiguity. Ask what they would do in the first 30 days. \
                    Include one question about wearing multiple hats. \
                    Ask about shipping fast with limited resources.""";

            default -> ""; // "general" or unknown → no style guide, standard prompt
        };
    }

    /** Human-readable label for the report badge */
    public static String getDisplayName(String companyId) {
        if (companyId == null) return "General";
        return switch (companyId.toLowerCase().trim()) {
            case "google"    -> "Google-style";
            case "amazon"    -> "Amazon-style";
            case "microsoft" -> "Microsoft-style";
            case "flipkart"  -> "Flipkart-style";
            case "startup"   -> "Startup-style";
            default          -> "General";
        };
    }
}
