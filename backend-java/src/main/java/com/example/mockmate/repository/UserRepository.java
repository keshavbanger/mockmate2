package com.example.mockmate.repository;

import com.example.mockmate.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findBySupabaseUserId(String supabaseUserId);
    boolean existsByEmail(String email);
}
