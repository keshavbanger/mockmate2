package com.example.mockmate.repository;

import com.example.mockmate.model.CareerRoadmap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CareerRoadmapRepository extends JpaRepository<CareerRoadmap, String> {
    Optional<CareerRoadmap> findByUserId(String userId);
}
