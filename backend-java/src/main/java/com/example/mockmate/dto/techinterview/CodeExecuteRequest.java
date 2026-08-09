package com.example.mockmate.dto.techinterview;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class CodeExecuteRequest {
    private String code;
    private String language;
    private String problemId;
    // Present only for console/"run with custom input" requests — when set,
    // the controller routes to CodeExecutionService.executeCustom() instead
    // of grading against the problem's fixed test cases.
    private String customInput;
}
