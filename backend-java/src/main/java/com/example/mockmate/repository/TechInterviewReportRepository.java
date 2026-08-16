package com.example.mockmate.repository;

import com.example.mockmate.model.techinterview.TechInterviewReportEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TechInterviewReportRepository extends JpaRepository<TechInterviewReportEntity, String> {

    List<TechInterviewReportEntity> findByUserIdOrderByCreatedAtDesc(String userId);

    Optional<TechInterviewReportEntity> findBySessionId(String sessionId);
}
