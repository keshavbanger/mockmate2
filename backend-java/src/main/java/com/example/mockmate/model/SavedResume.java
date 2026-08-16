package com.example.mockmate.model;

import com.example.mockmate.dto.response.ResumeParsedResponse;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * A user's saved resume — uploaded once via any feature, reusable across all
 * of them (Mock Interview, Technical Interview Lab, ATS Checker, Resume
 * Builder import) instead of re-uploading the same file per feature.
 *
 * A user may have several (e.g. "Backend Resume", "Frontend Resume"); at most
 * one is marked {@link #isDefault} at a time, offered as the pre-selected
 * choice wherever a feature asks "use your saved resume?".
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "saved_resumes",
    indexes = {
        @Index(name = "idx_saved_resumes_user_id", columnList = "user_id")
    })
public class SavedResume {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** FK to users.id — ownership check on every API request. */
    @Column(name = "user_id", nullable = false)
    private String userId;

    /** Display label (e.g. "Backend Resume") — defaults to the original filename. */
    @Column(nullable = false)
    private String label;

    @Column(name = "file_name")
    private String fileName;

    /** "pdf" or "docx" — drives which extractor produced rawText. */
    @Column(name = "file_type")
    private String fileType;

    // Plain TEXT column, deliberately NOT @Lob — @Lob on a String maps to
    // Postgres' oid large-object type here, which needs its own transaction/
    // connection-pooling handling and is the wrong tool for what's just a
    // long string (same TEXT-via-columnDefinition pattern already used for
    // AtsAnalysis.resumeFileName elsewhere in this codebase).
    @Column(name = "raw_text", columnDefinition = "TEXT")
    private String rawText;

    /**
     * Structured profile (skills/projects/experience/etc), reusing the same
     * DTO shape already load-bearing for the mock-interview and Resume
     * Builder flows — see ResumeParsedResponse for field documentation.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parsed_profile", columnDefinition = "jsonb")
    private ResumeParsedResponse parsedProfile;

    @Column(name = "is_default", nullable = false)
    @Builder.Default
    private boolean isDefault = false;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime uploadedAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    void prePersist() {
        if (uploadedAt == null) uploadedAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
