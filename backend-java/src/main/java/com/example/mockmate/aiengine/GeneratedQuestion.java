package com.example.mockmate.aiengine;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Structured output of the question-generation LLM call — exactly one question, never a batch. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GeneratedQuestion {
    private String question;
    private String area;
    private String questionType; // PRIMARY | FOLLOW_UP
}
