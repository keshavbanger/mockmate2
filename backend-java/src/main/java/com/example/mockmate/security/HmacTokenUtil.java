package com.example.mockmate.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Short HMAC tokens for the two places in this app that need to verify a
 * request without a bearer JWT: audio-recording URLs (an {@code <audio src>}
 * can't send an Authorization header) and the Tavus webhook (Tavus can't
 * attach our JWT either). Reuses the existing JWT signing secret rather than
 * adding a second one to configure.
 */
@Component
public class HmacTokenUtil {

    @Value("${jwt.secret}")
    private String secret;

    private Mac mac() {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize HMAC", e);
        }
    }

    /** Short, URL-safe token — enough to prevent guessing, not a full-length signature. */
    public String sign(String input) {
        byte[] sig = mac().doFinal(input.getBytes(StandardCharsets.UTF_8));
        String full = Base64.getUrlEncoder().withoutPadding().encodeToString(sig);
        return full.substring(0, 22);
    }

    public boolean verify(String input, String token) {
        if (token == null || token.isBlank()) return false;
        // Constant-time-ish comparison isn't critical here (these tokens are
        // short-lived-adjacent and low-value compared to the JWT itself),
        // but MessageDigest.isEqual avoids an easy timing side channel for free.
        return java.security.MessageDigest.isEqual(
                sign(input).getBytes(StandardCharsets.UTF_8),
                token.getBytes(StandardCharsets.UTF_8));
    }
}
