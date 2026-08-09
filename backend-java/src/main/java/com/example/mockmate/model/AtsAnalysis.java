package com.example.mockmate.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
}
