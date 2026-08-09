package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Styling tokens for a resume template.
 * <p>
 * All color values are 6-hex (e.g. "2C5F8A") without '#' prefix,
 * consistent with how Apache POI expects color strings.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemplateConfig {

    /** Primary color for candidate name and section headers */
    private String colorName;

    /** Accent color for skills labels, bullets, links */
    private String colorAccent;

    /** Body text color */
    private String colorBody;

    /** Gray / muted text color for dates, locations, metadata */
    private String colorGray;

    /** Name font size in half-points (POI uses half-points) */
    private int nameSizeHalfPoints;

    /** Section border style — how section headers are visually delimited */
    private BorderStyle sectionBorderStyle;

    /** Font family string for rendering */
    private String fontFamily;

    /** The template identifier (e.g. "compact", "professional") — stamped by TemplateRegistry.get() */
    private String templateId;

    /** 6-arg backward-compat constructor (no fontFamily, no templateId) */
    public TemplateConfig(String colorName, String colorAccent, String colorBody, String colorGray, int nameSizeHalfPoints, BorderStyle sectionBorderStyle) {
        this(colorName, colorAccent, colorBody, colorGray, nameSizeHalfPoints, sectionBorderStyle, null, null);
    }

    /** 7-arg constructor (with fontFamily, no templateId) */
    public TemplateConfig(String colorName, String colorAccent, String colorBody, String colorGray, int nameSizeHalfPoints, BorderStyle sectionBorderStyle, String fontFamily) {
        this(colorName, colorAccent, colorBody, colorGray, nameSizeHalfPoints, sectionBorderStyle, fontFamily, null);
    }

    public enum BorderStyle {
        BOTTOM,     // classic — line below section header
        LEFT,       // modern — left accent bar
        NONE        // minimal — no border
    }
}
