package com.example.mockmate.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import org.springframework.data.domain.Persistable;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "interviews")
public class Interview implements Persistable<String> {

    @Id
    private String id;

    @Transient
    @Builder.Default
    private boolean isNewEntity = true;

    @Override
    public boolean isNew() {
        return isNewEntity;
    }

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.isNewEntity = false;
    }

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "overall_score")
    private Integer overallScore;

    @Column(name = "role", columnDefinition = "TEXT")
    private String role;

    @Column(name = "company", columnDefinition = "TEXT")
    private String company;

    @Column(name = "interview_type", columnDefinition = "TEXT")
    @Builder.Default
    private String interviewType = "general";

    @Column(name = "company_id", columnDefinition = "TEXT")
    @Builder.Default
    private String companyId = "general";

    @Column(name = "filler_word_count")
    private Integer fillerWordCount;

    @Column(name = "average_wpm")
    private Integer averageWpm;
}
