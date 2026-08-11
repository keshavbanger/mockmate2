package com.example.mockmate.security;

import com.example.mockmate.model.ATSReport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Centralizes the ownership check for anything keyed by an ATS reportId
 * (ATSReport itself, and the ReconstructedResume/NormalizedResume files
 * derived from it in ResumeStudioController / ResumeGeneratorController).
 * Originally this lived only in ATSController as a private helper; Studio
 * and Generator endpoints read/wrote the same reportId-keyed files with no
 * check at all. Pulled out to a shared component so the three controllers
 * can't drift out of sync on how ownership is decided.
 * <p>
 * Ownership here is resolved from the caller's JWT email (not the numeric
 * User id used elsewhere in the app), matching how ATSReport.userId was
 * already being populated — reports created without a token are tagged
 * "anonymous" and stay accessible to anyone who holds the reportId, same
 * as before.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AtsReportAccessGuard {

    private final JwtUtil jwtUtil;

    public String resolveUserId(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            try {
                return jwtUtil.extractEmail(authHeader.substring(7));
            } catch (Exception e) {
                log.debug("[AtsReportAccessGuard] Could not resolve userId from token: {}", e.getMessage());
            }
        }
        return "anonymous";
    }

    public boolean isOwnedByCaller(ATSReport report, String authHeader) {
        String owner = report.getUserId();
        if (owner == null || "anonymous".equals(owner)) {
            return true;
        }
        return owner.equals(resolveUserId(authHeader));
    }
}
