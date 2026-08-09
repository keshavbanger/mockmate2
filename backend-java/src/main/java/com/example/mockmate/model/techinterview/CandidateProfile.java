package com.example.mockmate.model.techinterview;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CandidateProfile {
    private List<String> detectedTechnologies;
    private List<String> detectedProjects;
    private List<String> experienceSignals;
    private List<String> weaknessSignals;
    private List<String> strengths;
}
