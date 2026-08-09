package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ATSParserPreview {

    private String detectedName;
    private String detectedEmail;
    private String detectedPhone;
    private String detectedLocation;
    private String detectedGithub;
    private String detectedLinkedin;

    private List<String> detectedSkills;
    private List<String> detectedExperience;   // "Company — Role" strings
    private List<String> detectedProjects;      // project names
    private String       detectedEducation;

    private int          totalKeywordsDetected;

    /** ATS-breaking issues detected during parsing */
    private List<String> parsingWarnings;
}
