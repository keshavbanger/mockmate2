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

import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class Judge0ExecutionProvider implements CodeExecutionProvider {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;
    private final HarnessGeneratorService harnessGeneratorService;

    @Value("${judge0.base-url:https://judge0-ce.p.rapidapi.com}")
    private String baseUrl;

    @Value("${judge0.api-key:}")
    private String apiKey;

    @Value("${judge0.api-host:judge0-ce.p.rapidapi.com}")
    private String apiHost;

    // Fallback static map: canonical lang name -> Judge0 language ID
    private static final Map<String, Integer> DEFAULT_LANGUAGE_MAP = Map.of(
            "java",       62,
            "python",     71,
            "python3",    71,
            "javascript", 63,
            "js",         63,
            "cpp",        54,
            "c++",        54,
            "go",         60
    );

    private final Map<String, Integer> dynamicLanguageMap = new ConcurrentHashMap<>(DEFAULT_LANGUAGE_MAP);

    @PostConstruct
    public void init() {
        fetchLanguagesFromJudge0();
    }

    private void fetchLanguagesFromJudge0() {
        try {
            String url = baseUrl.replaceAll("/$", "") + "/languages";
            WebClient.RequestHeadersSpec<?> req = webClientBuilder.build().get().uri(url);
            if (apiKey != null && !apiKey.isBlank()) {
                req.header("X-RapidAPI-Key", apiKey)
                   .header("X-RapidAPI-Host", apiHost)
                   .header("X-Auth-Token", apiKey);
            }
            String response = req.retrieve().bodyToMono(String.class)
                    .timeout(java.time.Duration.ofSeconds(5))
                    .block();
            if (response != null) {
                JsonNode arr = objectMapper.readTree(response);
                if (arr.isArray()) {
                    for (JsonNode node : arr) {
                        int id = node.path("id").asInt();
                        String name = node.path("name").asText("").toLowerCase();
                        if (name.contains("java") && !dynamicLanguageMap.containsKey("java")) dynamicLanguageMap.put("java", id);
                        if (name.contains("python") && !dynamicLanguageMap.containsKey("python")) dynamicLanguageMap.put("python", id);
                        if (name.contains("javascript") && !dynamicLanguageMap.containsKey("javascript")) dynamicLanguageMap.put("javascript", id);
                        if ((name.contains("c++") || name.contains("gcc")) && !dynamicLanguageMap.containsKey("cpp")) dynamicLanguageMap.put("cpp", id);
                        if (name.contains("go") && !dynamicLanguageMap.containsKey("go")) dynamicLanguageMap.put("go", id);
                    }
                    log.info("Successfully fetched dynamic Judge0 language IDs: {}", dynamicLanguageMap);
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch dynamic Judge0 language list, using defaults: {}", e.getMessage());
        }
    }

    @Override
    public String getProviderName() {
        return "judge0";
    }

    @Override
    public CodeExecutionResult execute(String code, String language, DSAProblem problem, List<DSAProblem.TestCase> testCases) {
        String cleanLang = language != null ? language.toLowerCase() : "java";
        int languageId = resolveLanguageId(cleanLang);

        String jobId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        List<CodeExecutionResult.TestResult> results = new ArrayList<>();
        int passed = 0;
        String sharedCompilationError = null;

        // Execute batch if more than 1 test case, or single submission
        for (DSAProblem.TestCase tc : testCases) {
            String harnessCode = harnessGeneratorService.generateHarness(code, cleanLang, problem, tc.getInput(), jobId);
            SingleJudge0Response resp = executeSingleJudge0(harnessCode, languageId, tc.getInput(), tc.getExpectedOutput());

            CodeExecutionResult.TestResult tr = new CodeExecutionResult.TestResult();
            tr.setInput(tc.isHidden() ? "[hidden]" : tc.getInput());
            tr.setExpectedOutput(tc.isHidden() ? "[hidden]" : tc.getExpectedOutput());
            tr.setHidden(tc.isHidden());
            tr.setDescription(tc.getDescription());

            if (resp.getCompileError() != null) {
                tr.setPassed(false);
                tr.setCompileError(resp.getCompileError());
                tr.setActualOutput("Compilation Error");
                sharedCompilationError = resp.getCompileError();
                results.add(tr);
                break;
            }

            if (resp.getStatusId() == 3) { // Accepted
                tr.setPassed(true);
                tr.setActualOutput(tc.isHidden() ? "[hidden]" : resp.getStdout());
                passed++;
            } else if (resp.getStatusId() == 4) { // Wrong Answer
                tr.setPassed(false);
                tr.setActualOutput(tc.isHidden() ? "[hidden]" : resp.getStdout());
            } else if (resp.getStatusId() == 5) { // TLE
                tr.setPassed(false);
                tr.setActualOutput(tc.isHidden() ? "[hidden]" : "Time Limit Exceeded");
            } else if (resp.getStatusId() == 6) { // Compile Error
                tr.setPassed(false);
                tr.setCompileError(resp.getStderr());
                tr.setActualOutput("Compilation Error");
                sharedCompilationError = resp.getStderr();
                results.add(tr);
                break;
            } else { // Runtime Error or other
                tr.setPassed(false);
                tr.setActualOutput(tc.isHidden() ? "Runtime Error" : "Runtime Error: " + resp.getStderr());
            }

            results.add(tr);
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
        String cleanLang = language != null ? language.toLowerCase() : "java";
        int languageId = resolveLanguageId(cleanLang);

        String jobId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String harnessCode = harnessGeneratorService.generateHarness(code, cleanLang, problem, customInput, jobId);

        SingleJudge0Response resp = executeSingleJudge0(harnessCode, languageId, customInput, null);

        CodeExecutionResult.TestResult tr = new CodeExecutionResult.TestResult();
        tr.setInput(customInput);
        tr.setExpectedOutput(null);
        tr.setHidden(false);
        tr.setDescription("Custom Input");

        if (resp.getCompileError() != null) {
            tr.setPassed(false);
            tr.setCompileError(resp.getCompileError());
            tr.setActualOutput("Compilation Error");
        } else {
            tr.setPassed(false);
            tr.setActualOutput(resp.getStdout() != null && !resp.getStdout().isBlank() ? resp.getStdout() : resp.getStderr());
        }

        CodeExecutionResult result = new CodeExecutionResult();
        result.setSuccess(true);
        result.setCustomRun(true);
        result.setResults(new CodeExecutionResult.TestResult[]{tr});
        result.setStdout(tr.getActualOutput());
        if (tr.getCompileError() != null) result.setCompilationError(tr.getCompileError());
        return result;
    }

    private int resolveLanguageId(String lang) {
        return dynamicLanguageMap.getOrDefault(lang, DEFAULT_LANGUAGE_MAP.getOrDefault(lang, 62));
    }

    private SingleJudge0Response executeSingleJudge0(String sourceCode, int languageId, String stdin, String expectedOutput) {
        try {
            String url = baseUrl.replaceAll("/$", "") + "/submissions?base64_encoded=false&wait=true";

            Map<String, Object> payload = new HashMap<>();
            payload.put("language_id", languageId);
            payload.put("source_code", sourceCode);
            payload.put("stdin", stdin != null ? stdin : "");
            if (expectedOutput != null && !expectedOutput.isBlank()) {
                payload.put("expected_output", expectedOutput.trim());
            }

            WebClient.RequestBodySpec req = webClientBuilder.build().post().uri(url);
            req.header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
            if (apiKey != null && !apiKey.isBlank()) {
                req.header("X-RapidAPI-Key", apiKey)
                   .header("X-RapidAPI-Host", apiHost)
                   .header("X-Auth-Token", apiKey);
            }

            String responseStr = req.bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(java.time.Duration.ofSeconds(12))
                    .block();

            JsonNode root = objectMapper.readTree(responseStr);

            SingleJudge0Response res = new SingleJudge0Response();
            JsonNode statusNode = root.path("status");
            res.setStatusId(statusNode.path("id").asInt(3));
            res.setStatusDescription(statusNode.path("description").asText("Accepted"));
            res.setStdout(root.path("stdout").asText("").trim());
            res.setStderr(root.path("stderr").asText("").trim());
            res.setCompileOutput(root.path("compile_output").asText("").trim());

            if (res.getStatusId() == 6 || !res.getCompileOutput().isEmpty()) {
                res.setCompileError(!res.getCompileOutput().isEmpty() ? res.getCompileOutput() : res.getStderr());
            }

            return res;

        } catch (Exception e) {
            log.error("Judge0 execution call failed: {}", e.getMessage(), e);
            SingleJudge0Response err = new SingleJudge0Response();
            err.setStatusId(13); // Internal Error
            err.setStderr("Execution error: " + e.getMessage());
            return err;
        }
    }

    @lombok.Data
    private static class SingleJudge0Response {
        private int statusId;
        private String statusDescription;
        private String stdout;
        private String stderr;
        private String compileOutput;
        private String compileError;
    }
}
