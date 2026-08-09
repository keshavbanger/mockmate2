package com.example.mockmate.service;

import com.example.mockmate.model.techinterview.CodeExecutionResult;
import com.example.mockmate.model.techinterview.DSAProblem;
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
public class CodeExecutionService {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;
    private final DSAProblemService dsaProblemService;

    // emkc.org's free public Piston API went whitelist-only on 2026-02-15
    // (every request now 401s: "Public Piston API is now whitelist only").
    // Defaults to a self-hosted instance — see docker-compose.piston.yml.
    @Value("${piston.url:http://localhost:2000/api/v2/execute}")
    private String pistonUrl;

    // ── Language map: candidate language → Piston language+version ────
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

    // ── Main Execute Method ───────────────────────────────────
    public CodeExecutionResult execute(String code, String language, String problemId, boolean runAllTests) {
        DSAProblem problem = dsaProblemService.getProblemFull(problemId);
        if (problem == null) {
            // This used to only set pistonError, which the frontend never reads —
            // so a missing/unresolved problemId (e.g. a race where the editor
            // hadn't finished loading the problem yet) silently rendered as a
            // fake green "success" banner with zero test cases. compilationError
            // IS read by the frontend, so surface it there too.
            String msg = "Could not load problem \"" + problemId + "\" — it may not have finished loading yet. Please wait a moment and try again.";
            CodeExecutionResult err = new CodeExecutionResult();
            err.setSuccess(false);
            err.setPistonError(msg);
            err.setCompilationError(msg);
            return err;
        }

        List<DSAProblem.TestCase> testCases = runAllTests
                ? problem.getTestCases()
                : problem.getTestCases().stream().filter(tc -> !tc.isHidden()).toList();

        String lang = language != null ? language.toLowerCase() : "java";
        String[] pistonLang = LANGUAGE_MAP.getOrDefault(lang, new String[]{"java", "15.0.2"});

        // Test cases are logically independent Piston calls, and running them
        // concurrently (via CompletableFuture.supplyAsync) was tried here to
        // cut wall-clock latency roughly N-fold. It was reverted: live testing
        // showed this self-hosted Piston instance isn't safe under concurrent
        // requests that use the same source filename ("Main.java") — two
        // simultaneous submissions of the exact same correct solution
        // intermittently came back with empty stdout and no error (exit code
        // 0, nothing printed), silently marking a CORRECT solution as failed.
        // That's a worse bug than the sequential latency it was meant to fix,
        // so this stays sequential until Piston-side job isolation is
        // confirmed safe for concurrent same-filename requests.
        List<CodeExecutionResult.TestResult> results = new ArrayList<>();
        int passed = 0;
        String sharedCompilationError = null;
        for (DSAProblem.TestCase tc : testCases) {
            CodeExecutionResult.TestResult r = runSingleTestCase(code, lang, pistonLang, tc, problem);
            results.add(r);
            if (r.isPassed()) passed++;
            // A compile error is identical for every test case since it's the
            // same submitted code — stop re-compiling once we've seen one
            // instead of burning a Piston call (and showing N confusing
            // "Runtime Error" rows) per remaining test case.
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

    // ── Run Against Custom Input (Console mode) ───────────────
    // Unlike execute(), this doesn't grade against the problem's fixed test
    // cases — it runs the candidate's current code against whatever input
    // they typed into the console and just shows the raw output, like an
    // actual terminal. There was previously no way to try arbitrary input at
    // all; Run/Submit could only ever replay the problem's built-in cases.
    public CodeExecutionResult executeCustom(String code, String language, String problemId, String customInput) {
        DSAProblem problem = dsaProblemService.getProblemFull(problemId);
        if (problem == null) {
            String msg = "Could not load problem \"" + problemId + "\" — it may not have finished loading yet. Please wait a moment and try again.";
            CodeExecutionResult err = new CodeExecutionResult();
            err.setSuccess(false);
            err.setCompilationError(msg);
            return err;
        }

        String lang = language != null ? language.toLowerCase() : "java";
        String[] pistonLang = LANGUAGE_MAP.getOrDefault(lang, new String[]{"java", "15.0.2"});

        DSAProblem.TestCase custom = new DSAProblem.TestCase();
        custom.setInput(customInput != null ? customInput : "");
        custom.setDescription("Custom Input");
        // expectedOutput intentionally left null — runSingleTestCase treats
        // that as "no verdict to compute", just report the raw output.

        CodeExecutionResult.TestResult r = runSingleTestCase(code, lang, pistonLang, custom, problem);

        CodeExecutionResult result = new CodeExecutionResult();
        result.setSuccess(true);
        result.setCustomRun(true);
        result.setResults(new CodeExecutionResult.TestResult[]{r});
        result.setStdout(r.getActualOutput());
        if (r.getCompileError() != null) result.setCompilationError(r.getCompileError());
        return result;
    }

    // ── Run Single Test Case ──────────────────────────────────
    private CodeExecutionResult.TestResult runSingleTestCase(
            String candidateCode, String lang, String[] pistonLang,
            DSAProblem.TestCase tc, DSAProblem problem) {

        CodeExecutionResult.TestResult result = new CodeExecutionResult.TestResult();
        result.setInput(tc.isHidden() ? "[hidden]" : tc.getInput());
        result.setExpectedOutput(tc.isHidden() ? "[hidden]" : tc.getExpectedOutput());
        result.setHidden(tc.isHidden());
        result.setDescription(tc.getDescription());

        // C++ and Go can't be generically marshaled the way Java/Python/JS are:
        // Java gets real parameter types from post-compile reflection, and
        // Python/JS are dynamically typed so args can just be JSON-parsed. C++
        // has no runtime type reflection at all, so invoking the candidate's
        // function with correctly-typed arguments (vector<int> vs int vs
        // string, etc.) generically — without per-problem hand-written type
        // metadata that doesn't exist in this problem bank — isn't possible.
        // The previous wrappers for these silently printed a hardcoded string
        // ("Test executed") that never matched any expected output, so every
        // C++/Go submission failed every test case regardless of correctness,
        // with no indication why. Fail loudly and honestly instead.
        if (lang.equals("cpp") || lang.equals("c++") || lang.equals("go")) {
            result.setPassed(false);
            result.setCompileError(
                    "Automatic grading for " + (lang.equals("go") ? "Go" : "C++") + " isn't supported yet — "
                    + "the judge can't generically determine your function's parameter types for a compiled "
                    + "language without per-problem type metadata. Please switch the language selector to "
                    + "Java, Python, or JavaScript to run against test cases.");
            result.setActualOutput("Unsupported Language");
            return result;
        }

        try {
            String wrappedCode = wrapCode(candidateCode, lang, problem, tc.getInput());

            // Without an explicit filename, Piston assigns its own internal
            // name and its Java runner picks the wrong class to execute (it
            // ran "Solution" instead of "Main", the class that actually has
            // main()). The wrapper always names its public entry class "Main"
            // for Java — the filename must match that exactly.
            Map<String, Object> body = new HashMap<>();
            body.put("language", pistonLang[0]);
            body.put("version", pistonLang[1]);
            body.put("files", List.of(Map.of("name", sourceFileName(lang), "content", wrappedCode)));
            body.put("stdin", tc.getInput());

            String response = webClientBuilder.build()
                    .post().uri(pistonUrl)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(java.time.Duration.ofSeconds(10))
                    .block();

            JsonNode root  = objectMapper.readTree(response);

            // Piston returns a SEPARATE "compile" stage for compiled languages
            // (java/cpp/go) before "run". This was never being read — a genuine
            // compile error (the most common thing a candidate hits) fell
            // through to the runtime-error branch below and got reported per
            // test case as a confusing generic "Runtime Error", instead of one
            // clear "Compilation Error" the UI already has a dedicated banner
            // for but which was never actually triggered.
            JsonNode compileNode = root.path("compile");
            if (!compileNode.isMissingNode()) {
                int compileCode = compileNode.path("code").asInt(0);
                String compileStderr = compileNode.path("stderr").asText("").trim();
                if (compileCode != 0 || !compileStderr.isEmpty()) {
                    result.setPassed(false);
                    result.setCompileError(compileStderr.isEmpty()
                            ? "Compilation failed (exit code " + compileCode + ")" : compileStderr);
                    result.setActualOutput("Compilation Error");
                    return result;
                }
            }

            String   stdout = root.path("run").path("stdout").asText("").trim();
            String   stderr = root.path("run").path("stderr").asText("").trim();
            int      code2 = root.path("run").path("code").asInt(0);

            if (code2 != 0 || (!stderr.isEmpty() && stdout.isEmpty())) {
                result.setPassed(false);
                result.setActualOutput("Runtime Error: " + (stderr.isEmpty() ? "Exit code " + code2 : stderr));
            } else {
                String actual = stdout.trim();
                result.setActualOutput(tc.isHidden() ? "[hidden]" : actual);
                // Custom/console runs have no expected output to grade against —
                // just surface the raw output with no pass/fail verdict.
                if (tc.getExpectedOutput() != null) {
                    result.setPassed(normalizeOutput(actual).equals(normalizeOutput(tc.getExpectedOutput().trim())));
                } else {
                    result.setPassed(false);
                }
            }

        } catch (Exception e) {
            log.warn("Piston execution failed for {}: {}", problem.getId(), e.getMessage());
            result.setPassed(false);
            result.setActualOutput("Execution error: " + e.getMessage());
        }
        return result;
    }

    // ── Code Wrappers ─────────────────────────────────────────

    // cpp/go never reach here — runSingleTestCase short-circuits them before
    // calling wrapCode (see the "Unsupported Language" branch above).
    private String wrapCode(String code, String lang, DSAProblem problem, String input) {
        return switch (lang) {
            case "java"       -> wrapJava(code, problem, input);
            case "python", "python3" -> wrapPython(code, problem, input);
            case "javascript", "js" -> wrapJs(code, problem, input);
            default           -> code;
        };
    }

    // Java requires the source filename to match its public class exactly
    // ("Main", per wrapJava below) or Piston's runner picks the wrong class
    // to execute. Other languages don't have this constraint but get an
    // explicit name anyway for clarity/consistency.
    private String sourceFileName(String lang) {
        return switch (lang) {
            case "java"              -> "Main.java";
            case "python", "python3" -> "main.py";
            case "cpp", "c++"        -> "main.cpp";
            case "javascript", "js"  -> "main.js";
            case "go"                -> "main.go";
            default                  -> "main";
        };
    }

    private String wrapJava(String code, DSAProblem problem, String input) {
        String cleanCode = code != null ? code.trim() : "";
        if (!cleanCode.contains("class ")) {
            cleanCode = "class Solution {\n" + cleanCode + "\n}";
        }

        String escapedInput = input != null ? input.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") : "";

        // Piston's Java runner executes whichever class is declared FIRST in
        // the file — not the one that's public, not the one with main().
        // With the candidate's Solution class emitted before Main (as this
        // used to do), Piston tried to run "Solution" and failed with
        // "can't find main(String[]) method in class: Solution" on every
        // single submission. Main must come first.
        return """
import java.util.*;
import java.util.stream.*;
import java.lang.reflect.*;

public class Main {
    public static void main(String[] args) throws Exception {
        Solution sol = new Solution();
        Method targetMethod = null;
        for (Method m : Solution.class.getDeclaredMethods()) {
            if (Modifier.isPublic(m.getModifiers()) && !m.getName().startsWith("lambda$")) {
                targetMethod = m;
                break;
            }
        }
        if (targetMethod == null) {
            System.out.println("No solution method found");
            return;
        }

        String rawInput = "%s";
        String[] lines = rawInput.split("\\\\n");
        Class<?>[] paramTypes = targetMethod.getParameterTypes();
        Object[] invokeArgs = new Object[paramTypes.length];

        for (int i = 0; i < paramTypes.length; i++) {
            String line = i < lines.length ? lines[i].trim() : "";
            Class<?> pType = paramTypes[i];
            if (pType == int[].class) {
                if (line.isEmpty() || line.equals("[]")) {
                    invokeArgs[i] = new int[0];
                } else {
                    String clean = line.replaceAll("[\\\\[\\\\]\\\\s]", "");
                    invokeArgs[i] = clean.isEmpty() ? new int[0] : Arrays.stream(clean.split(",")).mapToInt(Integer::parseInt).toArray();
                }
            } else if (pType == int.class || pType == Integer.class) {
                invokeArgs[i] = line.isEmpty() ? 0 : Integer.parseInt(line.trim());
            } else if (pType == String.class) {
                invokeArgs[i] = line.replaceAll("^\\\"|\\\"$", "");
            } else if (pType == boolean.class || pType == Boolean.class) {
                invokeArgs[i] = Boolean.parseBoolean(line.trim());
            } else {
                invokeArgs[i] = null;
            }
        }

        Object result = targetMethod.invoke(sol, invokeArgs);
        printResult(result);
    }

    private static void printResult(Object res) {
        if (res == null) {
            System.out.println("null");
        } else if (res instanceof int[]) {
            System.out.println(Arrays.toString((int[]) res).replace(" ", ""));
        } else if (res instanceof Object[]) {
            System.out.println(Arrays.toString((Object[]) res).replace(" ", ""));
        } else if (res instanceof List<?>) {
            System.out.println(res.toString().replace(" ", ""));
        } else {
            System.out.println(res.toString());
        }
    }
}

%s
""".formatted(escapedInput, cleanCode);
    }

    // Python is dynamically typed, so unlike Java there's no need to know each
    // parameter's declared type ahead of time — each input line can just be
    // JSON/literal-parsed into whatever Python value it represents (int,
    // list, string, bool) and passed straight through. This previously never
    // invoked the candidate's Solution at all (hardcoded "Test passed"),
    // failing every submission regardless of correctness.
    private String wrapPython(String code, DSAProblem problem, String input) {
        String cleanCode = code != null ? code.trim() : "";
        if (!cleanCode.contains("class Solution")) {
            StringBuilder indented = new StringBuilder();
            for (String line : cleanCode.split("\n", -1)) {
                indented.append("    ").append(line).append("\n");
            }
            cleanCode = "class Solution:\n" + indented;
        }
        String escapedInput = input != null ? input.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") : "";

        return """
import json, ast

%s

def _parse_arg(s):
    s = s.strip()
    if s == "":
        return None
    try:
        return json.loads(s)
    except Exception:
        pass
    try:
        return ast.literal_eval(s)
    except Exception:
        pass
    return s

def _fmt(r):
    if r is None:
        return "null"
    if isinstance(r, bool):
        return "true" if r else "false"
    if isinstance(r, (list, tuple)):
        return "[" + ",".join(_fmt(x) for x in r) + "]"
    return str(r)

sol = Solution()
_target = None
for _name, _val in vars(Solution).items():
    if callable(_val) and not _name.startswith("_"):
        _target = _name
        break

if _target is None:
    print("No solution method found")
else:
    _raw = "%s"
    _lines = _raw.split("\\n")
    _args = [_parse_arg(l) for l in _lines if l.strip() != ""]
    _result = getattr(sol, _target)(*_args)
    print(_fmt(_result))
""".formatted(cleanCode, escapedInput);
    }

    // Same generic dynamic-typing approach as Python: JS needs no declared
    // parameter types either, so the candidate's method can be located on the
    // Solution prototype and invoked directly with JSON-parsed arguments.
    private String wrapJs(String code, DSAProblem problem, String input) {
        String cleanCode = code != null ? code.trim() : "";
        if (!cleanCode.contains("class Solution")) {
            cleanCode = "class Solution {\n" + cleanCode + "\n}";
        }
        String escapedInput = input != null ? input.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") : "";

        return """
%s

function _parseArg(s) {
    s = s.trim();
    if (s === "") return undefined;
    try { return JSON.parse(s); } catch (e) {}
    return s;
}

function _fmt(r) {
    if (r === null || r === undefined) return "null";
    if (typeof r === "boolean") return r ? "true" : "false";
    if (Array.isArray(r)) return "[" + r.map(_fmt).join(",") + "]";
    return String(r);
}

const sol = new Solution();
const _proto = Object.getOwnPropertyNames(Object.getPrototypeOf(sol));
const _target = _proto.find(n => n !== "constructor" && typeof sol[n] === "function");

if (!_target) {
    console.log("No solution method found");
} else {
    const _raw = "%s";
    const _args = _raw.split("\\n").filter(l => l.trim() !== "").map(_parseArg);
    const _result = sol[_target](..._args);
    console.log(_fmt(_result));
}
""".formatted(cleanCode, escapedInput);
    }

    // ── Output Normalization ──────────────────────────────────

    private String normalizeOutput(String s) {
        if (s == null) return "";
        return s.trim()
                .replace(" ", "")
                .replace("\n", "")
                .toLowerCase();
    }
}
