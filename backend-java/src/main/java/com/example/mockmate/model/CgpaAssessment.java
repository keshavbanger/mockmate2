package com.example.mockmate.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CgpaAssessment {
    private String cgpa;
    private String impact;
    private List<String> companiesFiltered;
    private List<String> compensationRequired;
    private List<String> currentCompensation;
    @JsonProperty("isCompensationSufficient")
    private boolean isCompensationSufficient;
    private String assessment;
}
