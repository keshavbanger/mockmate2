package com.example.mockmate.service;

import com.example.mockmate.model.techinterview.CodeExecutionResult;
import com.example.mockmate.model.techinterview.DSAProblem;
import com.example.mockmate.service.provider.CodeExecutionProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
public class CodeExecutionService {

    private final DSAProblemService dsaProblemService;
    private final Map<String, CodeExecutionProvider> providerMap;

    @Value("${code.execution.provider:judge0}")
    private String configuredProvider;

    public CodeExecutionService(DSAProblemService dsaProblemService, List<CodeExecutionProvider> providers) {
        this.dsaProblemService = dsaProblemService;
        this.providerMap = providers.stream()
                .collect(Collectors.toMap(CodeExecutionProvider::getProviderName, Function.identity()));
    }

    public CodeExecutionResult execute(String code, String language, String problemId, boolean runAllTests) {
        DSAProblem problem = dsaProblemService.getProblemFull(problemId);
        if (problem == null) {
            String msg = "Could not load problem \"" + problemId + "\" — it may not have finished loading yet. Please wait a moment and try again.";
            CodeExecutionResult err = new CodeExecutionResult();
            err.setSuccess(false);
            err.setPistonError(msg);
            err.setCompilationError(msg);
            return err;
        }

        List<DSAProblem.TestCase> testCases = runAllTests
                ? problem.getTestCases()
                : (problem.getTestCases() != null
                        ? problem.getTestCases().stream().filter(tc -> !tc.isHidden()).toList()
                        : List.of());

        CodeExecutionProvider provider = getProvider();
        log.info("Executing problem {} ({}) using provider '{}'", problemId, language, provider.getProviderName());
        return provider.execute(code, language, problem, testCases);
    }

    public CodeExecutionResult executeCustom(String code, String language, String problemId, String customInput) {
        DSAProblem problem = dsaProblemService.getProblemFull(problemId);
        if (problem == null) {
            String msg = "Could not load problem \"" + problemId + "\" — it may not have finished loading yet. Please wait a moment and try again.";
            CodeExecutionResult err = new CodeExecutionResult();
            err.setSuccess(false);
            err.setCompilationError(msg);
            return err;
        }

        CodeExecutionProvider provider = getProvider();
        log.info("Executing custom input for problem {} ({}) using provider '{}'", problemId, language, provider.getProviderName());
        return provider.executeCustom(code, language, problem, customInput);
    }

    public String getActiveProviderName() {
        return getProvider().getProviderName();
    }

    private CodeExecutionProvider getProvider() {
        String key = configuredProvider != null ? configuredProvider.toLowerCase() : "piston";
        CodeExecutionProvider provider = providerMap.get(key);
        if (provider == null) {
            log.warn("Configured code execution provider '{}' not found, falling back to 'piston'", key);
            provider = providerMap.get("piston");
        }
        if (provider == null && !providerMap.isEmpty()) {
            provider = providerMap.values().iterator().next();
        }
        if (provider == null) {
            throw new IllegalStateException("No CodeExecutionProvider available in application context");
        }
        return provider;
    }
}
