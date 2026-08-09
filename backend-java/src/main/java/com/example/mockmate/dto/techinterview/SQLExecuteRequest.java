package com.example.mockmate.dto.techinterview;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class SQLExecuteRequest {
    private String query;
    private String problemId;
}
