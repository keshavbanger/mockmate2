package com.example.mockmate.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    // Comma-separated allowlist, e.g. "http://localhost:5173,https://mockmate.live"
    // No "*" default: with allowCredentials(true) below, a wildcard origin
    // fallback means any site on the internet can make credentialed requests
    // against this API the moment CORS_ALLOWED_ORIGINS isn't set — this
    // default list is the actual known set of frontends instead.
    @Value("${cors.allowed-origins:http://localhost:5173,https://mockmate2.vercel.app,https://mockmate.live,https://www.mockmate.live}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        // "*" is still honored if someone explicitly opts into it via the env
        // var, but it's no longer what an unset/misconfigured deployment
        // silently gets.
        if (origins.isEmpty()) {
            config.setAllowedOriginPatterns(List.of(
                    "http://localhost:5173", "https://mockmate2.vercel.app",
                    "https://mockmate.live", "https://www.mockmate.live"));
        } else {
            config.setAllowedOriginPatterns(origins);
        }

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
