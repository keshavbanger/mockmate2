package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnverifiableMetric {
    private String quote;
    private String whyFlagged;
    private String fix;
}
