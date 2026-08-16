package com.example.mockmate.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * One cached, LLM-generated career roadmap per user (upserted, not
 * versioned) — see CareerRoadmapService.getOrGenerate for the
 * regeneration/staleness rules. Keyed by the account UUID (User.id), same
 * identity scheme as SavedResume/Interview/TechInterviewReportEntity.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "career_roadmaps")
public class CareerRoadmap {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false, unique = true)
    private String userId;

    @Column(name = "target_domain")
    private String targetDomain;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "roadmap_json", columnDefinition = "jsonb")
    private CareerRoadmapContent roadmapJson;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;
}
