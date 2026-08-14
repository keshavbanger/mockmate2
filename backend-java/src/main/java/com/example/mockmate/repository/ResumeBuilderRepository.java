package com.example.mockmate.repository;

import com.example.mockmate.model.ResumeBuilder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ResumeBuilderRepository extends JpaRepository<ResumeBuilder, String> {

    /** All non-deleted resumes for a user, newest first. */
    @Query("SELECT r FROM ResumeBuilder r WHERE r.userId = :userId AND r.deleted = false ORDER BY r.updatedAt DESC")
    List<ResumeBuilder> findAllByUserIdAndNotDeleted(@Param("userId") String userId);

    /** Single resume owned by a specific user (for ownership enforcement). */
    @Query("SELECT r FROM ResumeBuilder r WHERE r.id = :id AND r.userId = :userId AND r.deleted = false")
    Optional<ResumeBuilder> findByIdAndUserId(@Param("id") String id, @Param("userId") String userId);

    long countByUserIdAndDeletedFalse(String userId);
}
