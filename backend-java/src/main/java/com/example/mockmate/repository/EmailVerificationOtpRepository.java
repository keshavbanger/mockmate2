package com.example.mockmate.repository;

import com.example.mockmate.model.EmailVerificationOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface EmailVerificationOtpRepository extends JpaRepository<EmailVerificationOtp, String> {

    Optional<EmailVerificationOtp> findTopByEmailAndPurposeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
            String email, String purpose, LocalDateTime now);

    @Modifying
    @Transactional
    @Query("DELETE FROM EmailVerificationOtp e WHERE e.email = :email")
    void deleteByEmail(@Param("email") String email);
}
