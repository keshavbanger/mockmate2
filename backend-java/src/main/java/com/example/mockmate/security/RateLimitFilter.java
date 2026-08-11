package com.example.mockmate.security;

import com.example.mockmate.model.User;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Fixed-window per-user rate limiting for the handful of endpoints that call
 * a paid third-party API (Tavus persona/conversation creation, Groq chat,
 * Groq Whisper transcription) with no cap at all otherwise — one abusive
 * account could loop these to run up costs, or exhaust Tavus/Groq's own
 * rate limits for every other concurrent user, since those are shared across
 * the whole app on one API key (see OpenRouterFallbackService's comment on
 * the tech-interview side for the same failure mode).
 * <p>
 * Deliberately not a library (Bucket4j etc.) — this app has no rate-limiting
 * dependency yet, and a simple in-memory per-user counter is enough for a
 * single-instance deployment, consistent with SessionStoreService's own
 * in-memory-map approach elsewhere in this codebase.
 */
@Slf4j
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    // sessionId sits in the middle of most tech-interview paths
    // (/api/tech-interview/{sessionId}/answer), so a plain prefix can't
    // isolate just the expensive actions — suffix matching does.
    private record Rule(String matcher, boolean suffix, int limit, long windowMs) {
        Rule(String pathPrefix, int limit, long windowMs) { this(pathPrefix, false, limit, windowMs); }
        boolean matches(String path) { return suffix ? path.endsWith(matcher) : path.startsWith(matcher); }
    }

    private static final Rule[] RULES = {
            new Rule("/api/session/create", 15, 60_000),
            new Rule("/api/start-interview", 8, 60_000),
            new Rule("/api/mock-chat", 30, 60_000),
            new Rule("/api/generate-report", 6, 60_000),
            new Rule("/api/save-audio-turn", 20, 60_000),
            // ATS/resume endpoints call Groq (analysis, reconstruction, the
            // resume writer) and/or do CPU-heavy PDF/DOCX parsing, but were
            // entirely uncovered — any authenticated (free-signup) account
            // could loop them to run up Groq costs or exhaust the shared
            // API key's rate limit for every other user.
            new Rule("/api/ats/analyze", 8, 60_000),
            new Rule("/api/ats/compare", 5, 60_000),  // runs two full analyses internally
            new Rule("/api/parse-resume", 15, 60_000),
            new Rule("/api/resume-generator/generate", 8, 60_000),
            new Rule("/api/resume-studio/load", 10, 60_000),
            new Rule("/api/resume-studio/report", 10, 60_000),
            new Rule("/api/resume-studio/confidence", 15, 60_000),
            // Tech-interview plan generation is permitAll'd (see
            // SecurityConfig) and backs onto up to 4 chained Groq attempts
            // plus a 90s OpenRouter fallback and resume-text extraction —
            // an open cost/DoS surface reachable without any account at all.
            new Rule("/api/tech-interview/plan", 5, 60_000),
            // Conversation turns and code/SQL execution — each hits Groq
            // and/or the shared, unauthenticated-capacity Piston sandbox
            // with no prior cap; one scripted session could exhaust Groq's
            // shared-key quota or Piston's job capacity for everyone else.
            new Rule("/answer", true, 30, 60_000),
            new Rule("/execute-code", true, 20, 60_000),
            new Rule("/execute-sql", true, 20, 60_000),
    };

    private record Bucket(AtomicInteger count, long windowStart) {}

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        Rule rule = null;
        for (Rule r : RULES) {
            if (r.matches(path)) {
                rule = r;
                break;
            }
        }

        if (rule != null) {
            String key = rule.matcher() + ":" + resolveIdentity(request);
            if (isOverLimit(key, rule)) {
                log.warn("[RateLimit] Blocked {} for {} — over {}/{}ms", path, key, rule.limit(), rule.windowMs());
                response.setStatus(429); // HttpStatus.TOO_MANY_REQUESTS
                response.setContentType("application/json");
                response.getWriter().write("{\"detail\":\"Too many requests — please slow down and try again shortly.\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isOverLimit(String key, Rule rule) {
        long now = System.currentTimeMillis();
        Bucket updated = buckets.compute(key, (k, existing) -> {
            if (existing == null || now - existing.windowStart() >= rule.windowMs()) {
                return new Bucket(new AtomicInteger(1), now);
            }
            existing.count().incrementAndGet();
            return existing;
        });
        return updated.count().get() > rule.limit();
    }

    // Authenticated requests are keyed by user id (JwtAuthenticationFilter
    // runs before this filter in the chain, so the principal is already
    // resolved); unauthenticated requests fall back to remote address so an
    // anonymous caller can't dodge the limit entirely.
    private String resolveIdentity(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            return "user:" + user.getId();
        }
        return "ip:" + request.getRemoteAddr();
    }
}
