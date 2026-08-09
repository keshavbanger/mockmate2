package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @NoArgsConstructor @AllArgsConstructor
public class ATSDownloadResult {
    private byte[]               docxBytes;
    private ATSValidationResult  validation;
    private ReconstructedResume  reconstructed;
}
