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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final SupabaseJwtVerifier supabaseJwtVerifier;
    private final ResendEmailService resendEmailService;

    // Comma-separated admin emails (ADMIN_EMAILS env var / app.admin-emails
    // property). Checked on every verify/signup/login so an account gets
    // promoted the moment it logs in with a matching email — including
    // retroactively for accounts that existed before this feature, with no
    // manual DB migration needed to bootstrap the first admin.
    @Value("${app.admin-emails:}")
    private String adminEmailsConfig;

    private void promoteIfConfiguredAdmin(User user) {
        if (user == null || user.getEmail() == null || adminEmailsConfig == null || adminEmailsConfig.isBlank()) return;
        boolean isConfiguredAdmin = Arrays.stream(adminEmailsConfig.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .anyMatch(adminEmail -> adminEmail.equalsIgnoreCase(user.getEmail()));
        if (isConfiguredAdmin && user.getRole() != User.UserRole.ADMIN) {
            user.setRole(User.UserRole.ADMIN);
        }
    }

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

        promoteIfConfiguredAdmin(user);
        User savedUser = userRepository.save(user);
        if (isNewUser) {
            java.util.concurrent.CompletableFuture.runAsync(() ->
                resendEmailService.sendWelcomeEmail(savedUser.getEmail(), savedUser.getFullName())
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

        promoteIfConfiguredAdmin(user);
        User savedUser = userRepository.save(user);
        java.util.concurrent.CompletableFuture.runAsync(() ->
            resendEmailService.sendWelcomeEmail(savedUser.getEmail(), savedUser.getFullName())
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
        promoteIfConfiguredAdmin(user);
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
                .role(user.getRole() != null ? user.getRole().name() : "USER")
                .prefRoleLevel(user.getPrefRoleLevel())
                .prefInterviewType(user.getPrefInterviewType())
                .prefCompanyStyle(user.getPrefCompanyStyle())
                .prefLanguage(user.getPrefLanguage())
                .prefDurationMinutes(user.getPrefDurationMinutes())
                .createdAt(user.getCreatedAt())
                .build();
    }

    // Interview preferences — account-level defaults for Tech Interview
    // setup (see User.prefRoleLevel etc.) and the Dashboard's readiness-score
    // target company. Validated against the same known value sets the
    // frontend's dropdowns use (frontend/src/constants/interviewOptions.js)
    // so a bad/typo'd value can't silently corrupt future session defaults.
    private static final java.util.Set<String> VALID_ROLE_LEVELS = java.util.Set.of("INTERN", "FRESHER", "SDE_1", "SDE_2", "SDE_3");
    private static final java.util.Set<String> VALID_INTERVIEW_TYPES = java.util.Set.of("BACKEND", "FRONTEND", "FULLSTACK", "DATA_SCIENCE", "DEVOPS");
    private static final java.util.Set<String> VALID_COMPANY_STYLES = java.util.Set.of("GOOGLE", "AMAZON", "MICROSOFT", "STARTUP", "GENERIC");
    private static final java.util.Set<String> VALID_LANGUAGES = java.util.Set.of("java", "python", "cpp", "javascript", "go");

    @Transactional
    public UserResponse updatePreferences(User user, Map<String, Object> updates) {
        if (updates.containsKey("prefRoleLevel")) {
            user.setPrefRoleLevel(validateOrThrow(updates.get("prefRoleLevel"), VALID_ROLE_LEVELS, "prefRoleLevel"));
        }
        if (updates.containsKey("prefInterviewType")) {
            user.setPrefInterviewType(validateOrThrow(updates.get("prefInterviewType"), VALID_INTERVIEW_TYPES, "prefInterviewType"));
        }
        if (updates.containsKey("prefCompanyStyle")) {
            user.setPrefCompanyStyle(validateOrThrow(updates.get("prefCompanyStyle"), VALID_COMPANY_STYLES, "prefCompanyStyle"));
        }
        if (updates.containsKey("prefLanguage")) {
            Object val = updates.get("prefLanguage");
            if (val == null) {
                user.setPrefLanguage(null);
            } else if (VALID_LANGUAGES.contains(String.valueOf(val))) {
                user.setPrefLanguage(String.valueOf(val));
            } else {
                throw new IllegalArgumentException("Invalid prefLanguage: " + val);
            }
        }
        if (updates.containsKey("prefDurationMinutes")) {
            Object val = updates.get("prefDurationMinutes");
            if (val == null) {
                user.setPrefDurationMinutes(null);
            } else {
                int minutes = ((Number) val).intValue();
                if (minutes < 5 || minutes > 180) {
                    throw new IllegalArgumentException("prefDurationMinutes must be between 5 and 180");
                }
                user.setPrefDurationMinutes(minutes);
            }
        }
        User saved = userRepository.save(user);
        return mapToResponse(saved);
    }

    // Uppercase enum-style fields (role level/type/company) accept null to
    // clear the preference back to "unset", otherwise must exactly match the
    // known value set — same validate-or-reject pattern already used in
    // AdminController.updatePlan/updateRole.
    private String validateOrThrow(Object value, java.util.Set<String> validValues, String fieldName) {
        if (value == null) return null;
        String upper = String.valueOf(value).toUpperCase();
        if (!validValues.contains(upper)) {
            throw new IllegalArgumentException("Invalid " + fieldName + ": " + value);
        }
        return upper;
    }
}
