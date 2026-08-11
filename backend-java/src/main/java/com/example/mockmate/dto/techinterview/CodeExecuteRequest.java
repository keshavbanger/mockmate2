package com.example.mockmate.dto.techinterview;

import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class CodeExecuteRequest {
    // The multipart size limit in application.yml doesn't apply to this
    // JSON body — without an explicit cap, a candidate could submit an
    // arbitrarily large code string with no truncation before it's
    // forwarded to Piston. 50,000 chars is far beyond any real solution.
    @Size(max = 50_000, message = "Code submission is too large (max 50,000 characters)")
    private String code;
    private String language;
    private String problemId;
    // Present only for console/"run with custom input" requests — when set,
    // the controller routes to CodeExecutionService.executeCustom() instead
    // of grading against the problem's fixed test cases.
    @Size(max = 10_000, message = "Custom input is too large (max 10,000 characters)")
    private String customInput;
}
