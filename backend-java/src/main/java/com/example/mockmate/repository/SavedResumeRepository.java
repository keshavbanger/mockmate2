package com.example.mockmate.repository;

import com.example.mockmate.model.SavedResume;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SavedResumeRepository extends JpaRepository<SavedResume, String> {

    List<SavedResume> findByUserIdOrderByUpdatedAtDesc(String userId);

    Optional<SavedResume> findByUserIdAndIsDefaultTrue(String userId);

    @Query("SELECT r FROM SavedResume r WHERE r.id = :id AND r.userId = :userId")
    Optional<SavedResume> findByIdAndUserId(@Param("id") String id, @Param("userId") String userId);

    long countByUserId(String userId);
}
