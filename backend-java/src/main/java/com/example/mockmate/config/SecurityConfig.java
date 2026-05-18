package com.example.mockmate.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final CorsConfigurationSource corsConfigurationSource;

    public SecurityConfig(CorsConfigurationSource corsConfigurationSource) {
        this.corsConfigurationSource = corsConfigurationSource;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/session/**").permitAll()
                        .requestMatchers("/api/parse-resume").permitAll()
                        .requestMatchers("/api/generate-questions").permitAll()
                        .requestMatchers("/api/start-interview").permitAll()
                        .requestMatchers("/api/save-turn").permitAll()
                        .requestMatchers("/api/end-interview").permitAll()
                        .requestMatchers("/api/save-emotion-snapshots").permitAll()
                        .requestMatchers("/api/generate-report").permitAll()
                        .requestMatchers("/api/mock-chat").permitAll()
                        .requestMatchers("/api/ats/**").permitAll()   // ATS Resume Checker
                        .anyRequest().authenticated()
                );
        return http.build();
    }
}
