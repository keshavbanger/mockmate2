package com.example.mockmate.config;

import com.example.mockmate.security.JwtAuthenticationFilter;
import com.example.mockmate.security.RateLimitFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final CorsConfigurationSource corsConfigurationSource;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RateLimitFilter rateLimitFilter;

    public SecurityConfig(CorsConfigurationSource corsConfigurationSource, JwtAuthenticationFilter jwtAuthenticationFilter,
                           RateLimitFilter rateLimitFilter) {
        this.corsConfigurationSource = corsConfigurationSource;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.rateLimitFilter = rateLimitFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        // Tavus can't attach our JWT to its webhook calls, so this stays
                        // permitAll — verified instead via a shared-secret token on the
                        // callback URL itself (see TavusService/InterviewController).
                        .requestMatchers("/api/tavus-webhook").permitAll()
                        // generate-report now requires auth + a session-ownership check
                        // inside the handler (was previously permitAll with no check at
                        // all — anyone who obtained a sessionId could pull any report).
                        // Browser <audio> elements can't send an Authorization header, so
                        // recordings stay permitAll — verified instead via a per-file
                        // signed token embedded in the URL (see InterviewController).
                        .requestMatchers("/api/recordings/**").permitAll()
                        .requestMatchers("/api/tech-interview/plan").permitAll()
                        .requestMatchers("/health").permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                // After the JWT filter so the authenticated principal is
                // already resolved, letting the limiter key by user id
                // instead of falling back to a shared IP for everyone behind
                // the same NAT/proxy.
                .addFilterAfter(rateLimitFilter, JwtAuthenticationFilter.class);
        return http.build();
    }
}
