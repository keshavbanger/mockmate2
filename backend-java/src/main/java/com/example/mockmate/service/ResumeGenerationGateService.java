package com.example.mockmate.service;

import com.example.mockmate.model.NeedsUserInputException;
import com.example.mockmate.model.ResumeData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Part 0 of the Resume Generator Prompt Pack — the pipeline gate. Generation
 * is BLOCKED, not caveated, when any check here fails: better to route the
 * candidate to the Fill Gaps Wizard than let the writer LLM guess at a name,
 * a graduation year, or content that's actually a demo string leaking in
 * from somewhere else in the product.
 */
@Slf4j
@Service
public class ResumeGenerationGateService {

    public static final double EDUCATION_CONFIDENCE_THRESHOLD = 0.9;
    public static final double NAME_CONFIDENCE_THRESHOLD = 0.95;

    // Section-header strings that sometimes get misread as the candidate's
    // name when a parser latches onto the wrong bold line on the page.
    private static final Set<String> SECTION_HEADERS = Set.of(
            "education", "experience", "skills", "projects", "summary", "objective",
            "achievements", "certifications", "leadership", "technical skills",
            "work experience", "professional summary", "profile", "contact",
            "personal details", "declaration"
    );

    // Example/placeholder text that leaks in from a template or a prior
    // generation prompt instead of the candidate's real content — this is
    // the "Improved performance by 30%" class of bug: a demo bullet from
    // somewhere else in the product ends up literally on someone's resume.
    // Kept as a named constant per the brief, so this exact check is
    // reusable anywhere else demo strings could leak in.
    public static final Set<String> DEMO_STRINGS = Set.of(
            "improved performance by 30%",
            "increased efficiency by 25%",
            "reduced costs by 20%",
            "lorem ipsum",
            "your bullet point here",
            "describe your achievement here",
            "[x]% increase in candidate engagement"
    );

    private static final Pattern YEAR_PATTERN = Pattern.compile("(19|20)\\d{2}");

    /**
     * @throws NeedsUserInputException if any blocking condition holds — the
     *         caller (controller) should route to the Fill Gaps Wizard with
     *         exception.getFields() rather than proceed to generation.
     */
    public void checkGate(ResumeData resume) {
        List<String> blocked = new ArrayList<>();

        if (nameConfidence(resume.getName()) < NAME_CONFIDENCE_THRESHOLD) {
            blocked.add("name");
        }

        if (educationConfidence(resume.getEducation()) < EDUCATION_CONFIDENCE_THRESHOLD) {
            blocked.add("education");
        }

        if (extractEndYear(resume) == null) {
            blocked.add("education.end_year");
        }

        if (containsDemoString(resume)) {
            blocked.add("demo_string_leak");
        }

        boolean noProjects = resume.getProjects() == null || resume.getProjects().isEmpty();
        boolean noExperience = resume.getExperience() == null || resume.getExperience().isEmpty();
        if (noProjects && noExperience) {
            blocked.add("projects_or_experience");
        }

        if (!blocked.isEmpty()) {
            log.info("[ResumeGate] Blocking generation — fields need user input: {}", blocked);
            throw new NeedsUserInputException(blocked);
        }
    }

    /** Best-effort end-year extraction from a free-text year range like
     *  "2022 - 2026" or "2026". Returns null if nothing parseable — the gate
     *  treats that as a block rather than guessing. */
    public Integer extractEndYear(ResumeData resume) {
        if (resume.getEducation() == null || resume.getEducation().getYear() == null) return null;
        Matcher m = YEAR_PATTERN.matcher(resume.getEducation().getYear());
        Integer last = null;
        while (m.find()) last = Integer.parseInt(m.group());
        return last;
    }

    /** Honest, simple heuristic rather than a fake ML-grade score: a name
     *  that's blank, a known section-header string, or an implausible word
     *  count (a parser grabbing a whole line of prose) reads as unreliable. */
    private double nameConfidence(String name) {
        if (name == null || name.isBlank()) return 0.0;
        String trimmed = name.trim();
        if (SECTION_HEADERS.contains(trimmed.toLowerCase())) return 0.0;
        int wordCount = trimmed.split("\\s+").length;
        if (wordCount == 0 || wordCount > 5) return 0.5;
        return 0.98;
    }

    private double educationConfidence(ResumeData.EducationEntry edu) {
        if (edu == null) return 0.0;
        int filled = 0;
        if (notBlank(edu.getDegree()))      filled++;
        if (notBlank(edu.getInstitution())) filled++;
        if (notBlank(edu.getYear()))        filled++;
        return filled / 3.0;
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private boolean containsDemoString(ResumeData resume) {
        List<String> allBullets = new ArrayList<>();
        if (resume.getExperience() != null) {
            for (var e : resume.getExperience()) {
                if (e.getBullets() != null) allBullets.addAll(e.getBullets());
            }
        }
        if (resume.getProjects() != null) {
            for (var p : resume.getProjects()) {
                if (p.getBullets() != null) allBullets.addAll(p.getBullets());
            }
        }
        for (String bullet : allBullets) {
            if (bullet == null) continue;
            if (DEMO_STRINGS.contains(bullet.trim().toLowerCase())) return true;
        }
        return false;
    }
}
