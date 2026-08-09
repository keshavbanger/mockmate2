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
public class CompanyFit {

    private String companyName;

    /** Tier1 / Tier2 / Tier3 / Service */
    private String tier;

    /** 0–100 fit percentage */
    private int fitPercent;

    /** One-sentence explanation of this fit percentage */
    private String reason;

    /** Specific gaps that need to be addressed for this company */
    private List<String> gaps;
}
