package com.example.mockmate.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "supabase_user_id", unique = true)
    private String supabaseUserId;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    @Enumerated(EnumType.STRING)
    @Column(name = "plan_type")
    @Builder.Default
    private PlanType planType = PlanType.FREE;

    // Authorization role — separate from planType (paid vs free feature
    // access) since an admin isn't necessarily a paying customer and vice
    // versa. Defaults to USER; promoted to ADMIN either manually via the
    // admin panel or automatically on login for emails listed in
    // app.admin-emails (see AuthService.promoteIfConfiguredAdmin).
    @Enumerated(EnumType.STRING)
    @Column(name = "role")
    @Builder.Default
    private UserRole role = UserRole.USER;

    // Interview preferences — account-level defaults for the Tech Interview
    // setup form, so role/track/company/language/duration don't have to be
    // re-picked every session. Deliberately nullable with no @Builder.Default:
    // null means "not set yet," so the setup form falls back to its own
    // existing hardcoded defaults rather than a fabricated one here.
    // prefCompanyStyle doubles as the Dashboard's readiness-score target —
    // see DashboardInsightsService.buildReadiness — rather than introducing
    // a separate "goal" concept for the same underlying choice.
    @Column(name = "pref_role_level")
    private String prefRoleLevel;
    @Column(name = "pref_interview_type")
    private String prefInterviewType;
    @Column(name = "pref_company_style")
    private String prefCompanyStyle;
    @Column(name = "pref_language")
    private String prefLanguage;
    @Column(name = "pref_duration_minutes")
    private Integer prefDurationMinutes;

    // Backward compatibility fields
    private String firstName;
    private String lastName;
    private String username;
    private String passwordHash;

    @Builder.Default
    private boolean isActive = true;

    public enum PlanType {
        FREE, PRO
    }

    public enum UserRole {
        USER, ADMIN
    }
}
