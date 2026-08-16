package com.example.mockmate.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private String id;
    private String email;
    private String firstName;
    private String lastName;
    private String username;
    private String fullName;
    private String avatarUrl;
    private String supabaseUserId;
    private String planType;
    private String role;
    private LocalDateTime createdAt;
}
