package com.example.mockmate.service.provider;

import com.example.mockmate.model.techinterview.CodeExecutionResult;
import com.example.mockmate.model.techinterview.DSAProblem;
import com.example.mockmate.service.HarnessGeneratorService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PistonExecutionProvider implements CodeExecutionProvider {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;
    private final HarnessGeneratorService harnessGeneratorService;

    @Value("${piston.url:http://localhost:2000/api/v2/execute}")
    private String pistonUrl;

    private static final Map<String, String[]> LANGUAGE_MAP = Map.of(
            "java",       new String[]{"java", "15.0.2"},
            "python",     new String[]{"python", "3.10.0"},
            "python3",    new String[]{"python", "3.10.0"},
            "cpp",        new String[]{"cpp", "10.2.0"},
            "c++",        new String[]{"cpp", "10.2.0"},
            "javascript", new String[]{"javascript", "18.15.0"},
            "js",         new String[]{"javascript", "18.15.0"},
            "go",         new String[]{"go", "1.16.2"}
    );

    @Override
    public String getProviderName() {
        return "piston";
    }

    @Override
    public CodeExecutionResult execute(String code, String language, DSAProblem problem, List<DSAProblem.TestCase> testCases) {
        String lang = language != null ? language.toLowerCase() : "java";
        String[] pistonLang = LANGUAGE_MAP.getOrDefault(lang, new String[]{"java", "15.0.2"});
        String jobId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);

        List<CodeExecutionResult.TestResult> results = new ArrayList<>();
        int passed = 0;
        String sharedCompilationError = null;

        for (DSAProblem.TestCase tc : testCases) {
            CodeExecutionResult.TestResult r = runSingleTestCase(code, lang, pistonLang, tc, problem, jobId);
            results.add(r);
            if (r.isPassed()) passed++;
            if (r.getCompileError() != null) {
                sharedCompilationError = r.getCompileError();
                break;
            }
        }

        CodeExecutionResult result = new CodeExecutionResult();
        result.setSuccess(true);
        result.setTestCasesPassed(passed);
        result.setTotalTestCases(testCases.size());
        result.setAllPassed(passed == testCases.size());
        result.setResults(results.toArray(new CodeExecutionResult.TestResult[0]));
        if (sharedCompilationError != null) {
            result.setCompilationError(sharedCompilationError);
        }
        if (!results.isEmpty()) {
            CodeExecutionResult.TestResult last = results.get(results.size() - 1);
            result.setStdout(last.getActualOutput());
        }
        return result;
    }

    @Override
    public CodeExecutionResult executeCustom(String code, String language, DSAProblem problem, String customInput) {
        String lang = language != null ? language.toLowerCase() : "java";
        String[] pistonLang = LANGUAGE_MAP.getOrDefault(lang, new String[]{"java", "15.0.2"});

        DSAProblem.TestCase custom = new DSAProblem.TestCase();
        custom.setInput(customInput != null ? customInput : "");
        custom.setDescription("Custom Input");

        String jobId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        CodeExecutionResult.TestResult r = runSingleTestCase(code, lang, pistonLang, custom, problem, jobId);

        CodeExecutionResult result = new CodeExecutionResult();
        result.setSuccess(true);
        result.setCustomRun(true);
        result.setResults(new CodeExecutionResult.TestResult[]{r});
        result.setStdout(r.getActualOutput());
        if (r.getCompileError() != null) result.setCompilationError(r.getCompileError());
        return result;
    }

    private CodeExecutionResult.TestResult runSingleTestCase(
            String candidateCode, String lang, String[] pistonLang,
            DSAProblem.TestCase tc, DSAProblem problem, String jobId) {

        CodeExecutionResult.TestResult result = new CodeExecutionResult.TestResult();
        result.setInput(tc.isHidden() ? "[hidden]" : tc.getInput());
        result.setExpectedOutput(tc.isHidden() ? "[hidden]" : tc.getExpectedOutput());
        result.setHidden(tc.isHidden());
        result.setDescription(tc.getDescription());

        try {
            String wrappedCode = harnessGeneratorService.generateHarness(candidateCode, lang, problem, tc.getInput(), jobId);

            Map<String, Object> body = new HashMap<>();
            body.put("language", pistonLang[0]);
            body.put("version", pistonLang[1]);
            body.put("files", List.of(Map.of("name", harnessGeneratorService.sourceFileName(lang, jobId), "content", wrappedCode)));
            body.put("stdin", tc.getInput());

            String response = webClientBuilder.build()
                    .post().uri(pistonUrl)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(java.time.Duration.ofSeconds(10))
                    .block();

            JsonNode root = objectMapper.readTree(response);

            JsonNode compileNode = root.path("compile");
            if (!compileNode.isMissingNode()) {
                int compileCode = compileNode.path("code").asInt(0);
                String compileStderr = compileNode.path("stderr").asText("").trim();
                if (compileCode != 0 || !compileStderr.isEmpty()) {
                    result.setPassed(false);
                    result.setCompileError(compileStderr.isEmpty() ? "Compilation failed" : compileStderr);
                    result.setActualOutput("Compilation Error");
                    return result;
                }
            }

            String stdout = root.path("run").path("stdout").asText("").trim();
            String stderr = root.path("run").path("stderr").asText("").trim();
            int code2 = root.path("run").path("code").asInt(0);

            if (code2 != 0 || (!stderr.isEmpty() && stdout.isEmpty())) {
                result.setPassed(false);
                result.setActualOutput(tc.isHidden() ? "Runtime Error" : "Runtime Error: " + (stderr.isEmpty() ? "Exit code " + code2 : stderr));
            } else {
                String actual = stdout.trim();
                result.setActualOutput(tc.isHidden() ? "[hidden]" : actual);
                if (tc.getExpectedOutput() != null) {
                    result.setPassed(normalizeOutput(actual).equals(normalizeOutput(tc.getExpectedOutput().trim())));
                } else {
                    result.setPassed(false);
                }
            }

        } catch (Exception e) {
            log.warn("Piston execution failed: {}", e.getMessage());
            result.setPassed(false);
            result.setActualOutput("Execution error: " + e.getMessage());
        }
        return result;
    }

    private String normalizeOutput(String s) {
        if (s == null) return "";
        return s.trim().replace(" ", "").replace("\n", "").toLowerCase();
    }
}
