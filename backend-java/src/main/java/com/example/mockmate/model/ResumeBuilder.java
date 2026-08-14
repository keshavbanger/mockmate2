package com.example.mockmate.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Represents a standalone resume created by a user in the Resume Builder.
 * Resume content is stored as JSONB to keep the schema flexible as the
 * data model evolves, while still supporting queries on user_id.
 *
 * This is intentionally separate from {@link GeneratedResume} (which is the
 * output of the AI-driven ATS-upload-and-rewrite flow) and
 * {@link ReconstructedResume} (which is a live editor state for that same flow).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "resume_builder_resumes",
    indexes = {
        @Index(name = "idx_rbr_user_id", columnList = "user_id"),
        @Index(name = "idx_rbr_updated_at", columnList = "updated_at")
    })
public class ResumeBuilder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** FK to users.id — ownership check on every API request. */
    @Column(name = "user_id", nullable = false)
    private String userId;

    /** Display title for this resume (e.g. "Java Backend Resume"). */
    @Column(nullable = false)
    @Builder.Default
    private String title = "My Resume";

    /** Template identifier (e.g. "modern", "classic", "minimal"). */
    @Column(name = "template_id", nullable = false)
    @Builder.Default
    private String templateId = "modern";

    /**
     * Full resume content stored as JSONB.
     * Follows the ResumeData shape defined in the frontend's resumeDefaults.js.
     * Using JSONB avoids 15+ normalized tables for an MVP while remaining
     * fully queryable and schema-upgradeable in place.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "resume_data", columnDefinition = "jsonb")
    private Map<String, Object> resumeData;

    /**
     * Ordered list of section keys (e.g. ["summary","experience","education"]).
     * Stored as a JSON array so the renderer can respect user-defined order.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "section_order", columnDefinition = "jsonb")
    private List<String> sectionOrder;

    /**
     * Visual customisation settings (font, accentColor, lineSpacing, etc.).
     * Stored as JSONB to allow additive evolution without migrations.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "settings", columnDefinition = "jsonb")
    private Map<String, Object> settings;

    /** Soft-delete flag — resume is never physically removed. */
    @Column(name = "is_deleted", nullable = false)
    @Builder.Default
    private boolean deleted = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
