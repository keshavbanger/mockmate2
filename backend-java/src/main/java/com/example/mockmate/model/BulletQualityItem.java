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
public class BulletQualityItem {
    private String       section;
    private int          bulletNumber;
    private String       originalText;
    private List<String> issues;
    private int           qualityScore; // 0-100
    private String        rewrittenVersion;
    private String        improvement;
}
