package com.example.mockmate.security;

import com.example.mockmate.model.User;
import org.springframework.stereotype.Component;

/**
 * Centralizes the "is this caller an admin" check for AdminController.
 * No controller in this codebase wires Spring Security roles/authorities
 * (JwtAuthenticationFilter hard-codes an empty authorities list) — this
 * mirrors the existing in-controller ownership-check pattern (see
 * AtsReportAccessGuard, TechnicalInterviewController.isOwnedByOther) rather
 * than introducing a new authorization mechanism for just this one case.
 */
@Component
public class AdminGuard {
    public boolean isAdmin(User user) {
        return user != null && user.getRole() == User.UserRole.ADMIN;
    }
}
