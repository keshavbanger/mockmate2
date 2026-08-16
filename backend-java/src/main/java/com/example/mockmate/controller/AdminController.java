package com.example.mockmate.controller;

import com.example.mockmate.model.User;
import com.example.mockmate.repository.UserRepository;
import com.example.mockmate.security.AdminGuard;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin-only user management — who gets access to paid features (currently
 * just the AI Mock Interview, see InterviewController.startInterview) and
 * who else gets admin rights. No self-serve payment integration exists yet;
 * this panel is the only way to mark a user as PRO for now.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final AdminGuard adminGuard;

    @GetMapping("/users")
    public ResponseEntity<?> listUsers(@AuthenticationPrincipal User caller) {
        if (!adminGuard.isAdmin(caller)) return forbidden();

        List<Map<String, Object>> users = userRepository.findAll().stream()
                .map(this::toSummary)
                .toList();
        return ResponseEntity.ok(users);
    }

    @PatchMapping("/users/{id}/plan")
    public ResponseEntity<?> updatePlan(
            @PathVariable String id,
            @AuthenticationPrincipal User caller,
            @RequestBody Map<String, String> body) {
        if (!adminGuard.isAdmin(caller)) return forbidden();

        User target = userRepository.findById(id).orElse(null);
        if (target == null) return ResponseEntity.notFound().build();

        User.PlanType newPlan;
        try {
            newPlan = User.PlanType.valueOf(String.valueOf(body.get("planType")).toUpperCase());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "planType must be FREE or PRO"));
        }

        target.setPlanType(newPlan);
        userRepository.save(target);
        log.info("[Admin] {} set plan={} for user {}", caller.getEmail(), newPlan, target.getEmail());
        return ResponseEntity.ok(toSummary(target));
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<?> updateRole(
            @PathVariable String id,
            @AuthenticationPrincipal User caller,
            @RequestBody Map<String, String> body) {
        if (!adminGuard.isAdmin(caller)) return forbidden();

        User target = userRepository.findById(id).orElse(null);
        if (target == null) return ResponseEntity.notFound().build();

        User.UserRole newRole;
        try {
            newRole = User.UserRole.valueOf(String.valueOf(body.get("role")).toUpperCase());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "role must be USER or ADMIN"));
        }

        target.setRole(newRole);
        userRepository.save(target);
        log.info("[Admin] {} set role={} for user {}", caller.getEmail(), newRole, target.getEmail());
        return ResponseEntity.ok(toSummary(target));
    }

    private Map<String, Object> toSummary(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("email", u.getEmail());
        m.put("fullName", u.getFullName());
        m.put("planType", u.getPlanType() != null ? u.getPlanType().name() : "FREE");
        m.put("role", u.getRole() != null ? u.getRole().name() : "USER");
        m.put("createdAt", u.getCreatedAt());
        m.put("lastLogin", u.getLastLogin());
        return m;
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required"));
    }
}
