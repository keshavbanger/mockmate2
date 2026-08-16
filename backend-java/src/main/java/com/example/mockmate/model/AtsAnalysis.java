package com.example.mockmate.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ats_analyses")
public class AtsAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "report_id", unique = true)
    private String reportId; // Links to the disk-based JSON report

    @Column(name = "resume_file_name", columnDefinition = "TEXT")
    private String resumeFileName;

    @Column(name = "final_score")
    private Integer finalScore;
    
    @Column(name = "verdict")
    private String verdict;

    // Full report body, durably queryable — previously the ONLY copy of the
    // actual report content lived in a disk JSON file (see
    // ATSAnalyzerService.saveReport/reportFile), so a redeploy or restart on
    // ephemeral hosting could silently orphan every "view report"/"history"
    // request even though this metadata row survived. This row is now the
    // primary read path; the disk file is kept only for ATSDownloadService's
    // separate DOCX-generation pipeline, not for report retrieval.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "report_json", columnDefinition = "jsonb")
    private com.example.mockmate.model.ATSReport reportJson;
}
