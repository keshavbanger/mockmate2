package com.example.mockmate.repository;

import com.example.mockmate.model.Interview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InterviewRepository extends JpaRepository<Interview, String> {
    List<Interview> findByUserIdOrderByCreatedAtDesc(String userId);
}
