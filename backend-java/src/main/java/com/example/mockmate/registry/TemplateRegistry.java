package com.example.mockmate.registry;

import com.example.mockmate.model.TemplateConfig;
import com.example.mockmate.model.TemplateConfig.BorderStyle;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Static registry of all available resume templates.
 * <p>
 * Adding a new template is as simple as putting a new entry here —
 * no AI prompts, no Groq calls, no renderer changes needed.
 */
@Component
public class TemplateRegistry {

    public static final String CLASSIC      = "classic";
    public static final String MODERN       = "modern";
    public static final String MINIMAL      = "minimal";
    public static final String PROFESSIONAL = "professional";
    public static final String COMPACT      = "compact";
    public static final String HARVARD      = "harvard";

    private static final Map<String, TemplateConfig> TEMPLATES = Map.of(
        CLASSIC, new TemplateConfig(
            "1A1A2E", "2C5F8A", "222222", "555555",
            56, BorderStyle.BOTTOM, "Calibri, Georgia, serif"),
        MODERN, new TemplateConfig(
            "0F172A", "059669", "1E293B", "64748B",
            52, BorderStyle.LEFT, "Calibri, Inter, sans-serif"),
        MINIMAL, new TemplateConfig(
            "000000", "000000", "222222", "666666",
            48, BorderStyle.NONE, "Georgia, serif"),
        PROFESSIONAL, new TemplateConfig(
            "1E3A8A", "2563EB", "1E293B", "475569",
            54, BorderStyle.BOTTOM, "'Times New Roman', Georgia, serif"),
        COMPACT, new TemplateConfig(
            "0F172A", "0D9488", "334155", "64748B",
            44, BorderStyle.BOTTOM, "Arial, Helvetica, sans-serif"),
        HARVARD, new TemplateConfig(
            "000000", "000000", "000000", "555555",
            48, BorderStyle.BOTTOM, "'Times New Roman', Georgia, serif")
    );

    /**
     * Looks up template config by ID.
     * Falls back to {@link #CLASSIC} if the ID is unknown.
     * Stamps {@link TemplateConfig#setTemplateId} so renderers know which template is active.
     */
    public TemplateConfig get(String templateId) {
        String resolvedId = (templateId != null && TEMPLATES.containsKey(templateId)) ? templateId : CLASSIC;
        TemplateConfig cfg = TEMPLATES.get(resolvedId);
        // Clone-style: set the templateId so renderers can read it
        cfg.setTemplateId(resolvedId);
        return cfg;
    }

    /** Returns all registered template IDs. */
    public List<String> availableTemplates() {
        return List.of(CLASSIC, MODERN, MINIMAL, PROFESSIONAL, COMPACT, HARVARD);
    }
}
