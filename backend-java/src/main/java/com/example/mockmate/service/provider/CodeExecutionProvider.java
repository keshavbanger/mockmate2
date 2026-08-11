package com.example.mockmate.service.provider;

import com.example.mockmate.model.techinterview.CodeExecutionResult;
import com.example.mockmate.model.techinterview.DSAProblem;

import java.util.List;

public interface CodeExecutionProvider {

    /**
     * Executes candidate code against test cases for a problem.
     */
    CodeExecutionResult execute(String code, String language, DSAProblem problem, List<DSAProblem.TestCase> testCases);

    /**
     * Executes candidate code against custom console input.
     */
    CodeExecutionResult executeCustom(String code, String language, DSAProblem problem, String customInput);

    /**
     * Provider identifier (e.g. "judge0", "piston").
     */
    String getProviderName();
}
