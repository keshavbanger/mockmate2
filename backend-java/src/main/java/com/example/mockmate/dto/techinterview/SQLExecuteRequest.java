package com.example.mockmate.dto.techinterview;

import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class SQLExecuteRequest {
    @Size(max = 20_000, message = "Query is too large (max 20,000 characters)")
    private String query;
    private String problemId;
}
