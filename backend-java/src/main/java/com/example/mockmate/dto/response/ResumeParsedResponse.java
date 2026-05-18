package com.example.mockmate.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResumeParsedResponse {
    private String name;
    private String email;
    private List<String> skills;
    private double totalExperienceYears;
    private List<String> jobTitles;
    private List<String> companies;
    private List<String> education;
    private String summary;
}
