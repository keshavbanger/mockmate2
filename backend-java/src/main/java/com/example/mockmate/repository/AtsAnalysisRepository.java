package com.example.mockmate.repository;

import com.example.mockmate.model.AtsAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AtsAnalysisRepository extends JpaRepository<AtsAnalysis, String> {
    List<AtsAnalysis> findByUserIdOrderByCreatedAtDesc(String userId);
}
