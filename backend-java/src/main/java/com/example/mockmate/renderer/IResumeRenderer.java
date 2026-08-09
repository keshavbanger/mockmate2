package com.example.mockmate.renderer;

import com.example.mockmate.model.NormalizedResume;
import com.example.mockmate.model.TemplateConfig;

/**
 * IResumeRenderer — the rendering contract for all resume output formats.
 * <p>
 * Rules:
 * <ul>
 *   <li>No renderer calls Groq or any AI service</li>
 *   <li>No renderer contains ATS scoring or enforcement logic</li>
 *   <li>No renderer modifies the incoming NormalizedResume</li>
 *   <li>Switching templateId never triggers an AI call</li>
 *   <li>All renderers consume the identical NormalizedResume</li>
 * </ul>
 */
public interface IResumeRenderer {

    /**
     * Render the resume to a byte array (for binary formats like DOCX).
     * Implementations that produce text formats may return the UTF-8 encoded string.
     */
    byte[] renderToBytes(NormalizedResume resume, TemplateConfig config);

    /**
     * Render the resume to a string (for text-based formats like HTML, LaTeX).
     * Implementations that produce binary formats may throw {@link UnsupportedOperationException}.
     */
    String renderToString(NormalizedResume resume, TemplateConfig config);

    /**
     * Returns the output format this renderer produces.
     * Examples: {@code "docx"}, {@code "html"}, {@code "latex"}
     */
    String getOutputFormat();
}
