package com.example.mockmate.service;

import com.example.mockmate.dto.request.TokenVerificationRequest;
import com.example.mockmate.dto.request.UserLoginRequest;
import com.example.mockmate.dto.request.UserSignupRequest;
import com.example.mockmate.dto.response.TokenResponse;
import com.example.mockmate.dto.response.UserResponse;
import com.example.mockmate.model.User;
import com.example.mockmate.repository.UserRepository;
import com.example.mockmate.security.JwtUtil;
import com.example.mockmate.security.SupabaseJwtVerifier;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final SupabaseJwtVerifier supabaseJwtVerifier;
    private final SmtpEmailService smtpEmailService;

    @Transactional
    public TokenResponse verify(TokenVerificationRequest request) {
        Claims claims = supabaseJwtVerifier.verifyAndGetClaims(request.getToken());
        
        String supabaseUserId = claims.getSubject(); // 'sub' claim in JWT
        String email = claims.get("email", String.class);
        
        if (email == null) {
            throw new IllegalArgumentException("Supabase JWT missing email claim");
        }

        Map<String, Object> userMetadata = claims.get("user_metadata", Map.class);
        String fullName = null;
        String avatarUrl = null;
        if (userMetadata != null) {
            fullName = (String) userMetadata.get("full_name");
            avatarUrl = (String) userMetadata.get("avatar_url");
        }

        // Idempotent upsert
        Optional<User> userOpt = userRepository.findBySupabaseUserId(supabaseUserId);
        boolean isNewUser = false;
        User user;
        if (userOpt.isPresent()) {
            user = userOpt.get();
            user.setEmail(email);
            if (fullName != null) user.setFullName(fullName);
            if (avatarUrl != null) user.setAvatarUrl(avatarUrl);
            user.setLastLogin(LocalDateTime.now());
        } else {
            Optional<User> emailUserOpt = userRepository.findByEmail(email);
            if (emailUserOpt.isPresent()) {
                user = emailUserOpt.get();
                user.setSupabaseUserId(supabaseUserId);
                if (fullName != null) user.setFullName(fullName);
                if (avatarUrl != null) user.setAvatarUrl(avatarUrl);
                user.setLastLogin(LocalDateTime.now());
            } else {
                isNewUser = true;
                user = User.builder()
                        .supabaseUserId(supabaseUserId)
                        .email(email)
                        .fullName(fullName)
                        .avatarUrl(avatarUrl)
                        .createdAt(LocalDateTime.now())
                        .lastLogin(LocalDateTime.now())
                        .planType(User.PlanType.FREE)
                        .isActive(true)
                        .build();
            }
        }

        User savedUser = userRepository.save(user);
        if (isNewUser) {
            java.util.concurrent.CompletableFuture.runAsync(() ->
                smtpEmailService.sendWelcomeEmail(savedUser.getEmail(), savedUser.getFullName())
            );
        }

        String mockMateToken = jwtUtil.generateToken(savedUser.getEmail());

        return TokenResponse.builder()
                .accessToken(mockMateToken)
                .user(mapToResponse(savedUser))
                .build();
    }

    @Transactional
    public TokenResponse register(TokenVerificationRequest request) {
        return verify(request);
    }

    @Transactional
    public TokenResponse signup(UserSignupRequest request) {
        String normalizedEmail = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("Email already registered");
        }

        User user = User.builder()
                .email(normalizedEmail)
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .fullName(((request.getFirstName() != null ? request.getFirstName() : "") + " " + 
                           (request.getLastName() != null ? request.getLastName() : "")).trim())
                .username(request.getUsername())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .createdAt(LocalDateTime.now())
                .lastLogin(LocalDateTime.now())
                .planType(User.PlanType.FREE)
                .isActive(true)
                .build();

        User savedUser = userRepository.save(user);
        java.util.concurrent.CompletableFuture.runAsync(() ->
            smtpEmailService.sendWelcomeEmail(savedUser.getEmail(), savedUser.getFullName())
        );

        String token = jwtUtil.generateToken(savedUser.getEmail());

        return TokenResponse.builder()
                .accessToken(token)
                .user(mapToResponse(savedUser))
                .build();
    }

    @Transactional
    public TokenResponse login(UserLoginRequest request) {
        String normalizedEmail = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        // Accounts created via Supabase/OAuth (verify()/register()) never set a
        // passwordHash. Without this check, a null hash would skip the match
        // below entirely and let anyone log in as that account with any password.
        if (user.getPasswordHash() == null) {
            throw new IllegalArgumentException("This account uses social/Google login — please sign in that way");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        user.setLastLogin(LocalDateTime.now());
        User savedUser = userRepository.save(user);

        String token = jwtUtil.generateToken(user.getEmail());

        return TokenResponse.builder()
                .accessToken(token)
                .user(mapToResponse(savedUser))
                .build();
    }

    @Transactional
    public void deleteAccount(User user) {
        if (user != null && user.getId() != null) {
            userRepository.deleteById(user.getId());
        }
    }

    public UserResponse mapToResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .supabaseUserId(user.getSupabaseUserId())
                .planType(user.getPlanType() != null ? user.getPlanType().name() : "FREE")
                .createdAt(user.getCreatedAt())
                .build();
    }
}
