package com.example.mockmate.service;

import java.util.*;

public final class ATSRulesLibrary {
    private ATSRulesLibrary() {}

    public static final Set<String> ACTION_VERBS = Set.of(
        "built","engineered","designed","developed","implemented","architected","optimized","led",
        "delivered","reduced","increased","automated","integrated","deployed","created","spearheaded",
        "coordinated","achieved","launched","managed","improved","established","streamlined","drove"
    );

    public static final Map<String, String> SKILL_ALIASES = Map.ofEntries(
        Map.entry("js","javascript"), Map.entry("reactjs","javascript"),
        Map.entry("react.js","javascript"), Map.entry("node.js","nodejs"),
        Map.entry("rest api","rest apis"), Map.entry("spring","spring boot"),
        Map.entry("postgres","postgresql"), Map.entry("mongo","mongodb"),
        Map.entry("k8s","kubernetes"), Map.entry("aws lambda","aws")
    );

    public static final List<List<String>> SYNONYM_GROUPS = List.of(
        List.of("developed","built","created","engineered"),
        List.of("managed","led","headed","oversaw"),
        List.of("improved","optimized","enhanced","boosted"),
        List.of("designed","architected","planned"),
        List.of("implemented","integrated","deployed"),
        List.of("analyzed","evaluated","assessed")
    );

    public static final Map<String, List<String>> SECTION_ALIASES = Map.of(
        "summary",  List.of("summary","objective","career objective","profile","about"),
        "skills",   List.of("skills","technical skills","technologies","tech stack","core competencies"),
        "experience", List.of("experience","work experience","work history","internship","employment"),
        "projects", List.of("projects","key projects","personal projects","portfolio"),
        "achievements", List.of("achievements","awards","accolades","rewards","accomplishments"),
        "certifications", List.of("certifications","courses","training","online courses"),
        "leadership", List.of("leadership","extracurricular","co-curricular","activities"),
        "education", List.of("education","academic","qualifications","academic record")
    );

    public static final Set<Character> ATS_BREAKING_CHARS =
        Set.of('\u2605','\u25CF','\u25A0','\u25A1','\u25AA','\u25B8','\u27A4','\u2192','\u25C6','\u2713');

    public static final List<String> STRIP_SECTIONS = List.of(
        "personal details","personal information","references","declaration","hobbies",
        "strengths","areas of improvement","weaknesses","mother tongue","passport",
        "marital status","father","family"
    );

    // ── NEW: Keyword categories for Keyword Intelligence Engine ───────────────

    /**
     * Maps category name → list of keywords to look for in JD and resume.
     * Used by ATSScoringService to build CategoryKeywordMatch results.
     */
    public static final Map<String, List<String>> JD_KEYWORD_CATEGORIES = Map.of(
        "Programming Languages", List.of(
            "java","python","javascript","typescript",
            "kotlin","scala","go","rust","c++","c"
        ),
        "Backend Frameworks", List.of(
            "spring boot","spring","hibernate","jpa",
            "rest apis","rest","microservices","maven",
            "gradle","jwt","spring security"
        ),
        "Databases", List.of(
            "mysql","postgresql","mongodb","redis",
            "oracle","elasticsearch","cassandra","sql"
        ),
        "Cloud/DevOps", List.of(
            "docker","kubernetes","aws","azure","gcp",
            "ci/cd","jenkins","github actions",
            "git","linux"
        ),
        "Frontend", List.of(
            "react","angular","vue","html","css",
            "javascript","typescript","tailwind"
        ),
        "Testing", List.of(
            "junit","mockito","testng","selenium",
            "integration testing","unit testing"
        ),
        "CS Fundamentals", List.of(
            "dsa","oop","dbms","os","algorithms",
            "data structures","system design"
        ),
        "Soft Skills", List.of(
            "leadership","teamwork","communication",
            "problem solving","agile","scrum"
        )
    );

    /**
     * Importance level per category: Critical / Important / Nice-to-have
     */
    public static final Map<String, String> CATEGORY_IMPORTANCE = Map.of(
        "Programming Languages", "Critical",
        "Backend Frameworks",    "Critical",
        "Databases",             "Important",
        "Cloud/DevOps",          "Important",
        "Frontend",              "Nice-to-have",
        "Testing",               "Important",
        "CS Fundamentals",       "Important",
        "Soft Skills",           "Nice-to-have"
    );
}
