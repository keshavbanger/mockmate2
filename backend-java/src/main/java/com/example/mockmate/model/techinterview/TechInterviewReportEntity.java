package com.example.mockmate.model.techinterview;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Durable, queryable record of a completed Technical Interview Lab report.
 * Previously the ONLY copy of a report lived as a JSON file on local disk
 * (data/sessions/technical/{sessionId}/report.json), and "history" was a
 * live directory scan on every request — both lost on any restart on
 * ephemeral hosting, and neither indexed nor paginated. This table is now
 * the primary read path for both GET /report/{sessionId} and
 * GET /history/{userId}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "tech_interview_reports",
    indexes = {
        @Index(name = "idx_tir_user_id", columnList = "user_id"),
        @Index(name = "idx_tir_session_id", columnList = "session_id")
    })
public class TechInterviewReportEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "session_id", unique = true, nullable = false)
    private String sessionId;

    @Column(name = "role_level")
    private String roleLevel;

    @Column(name = "interview_type")
    private String interviewType;

    @Column(name = "overall_score")
    private int overallScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "report_json", columnDefinition = "jsonb", nullable = false)
    private TechInterviewReport reportJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
