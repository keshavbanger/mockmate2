package com.example.mockmate.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TokenResponse {
    private String accessToken;
    @Builder.Default
    private String tokenType = "bearer";
    private UserResponse user;
}
