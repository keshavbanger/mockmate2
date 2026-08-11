package com.example.mockmate.service.provider;

import com.example.mockmate.model.techinterview.CodeExecutionResult;
import com.example.mockmate.model.techinterview.DSAProblem;
import com.example.mockmate.service.HarnessGeneratorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.tools.*;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class InAppExecutionProvider implements CodeExecutionProvider {

    private final HarnessGeneratorService harnessGeneratorService;

    @Override
    public String getProviderName() {
        return "inapp";
    }

    @Override
    public CodeExecutionResult execute(String code, String language, DSAProblem problem, List<DSAProblem.TestCase> testCases) {
        String lang = language != null ? language.toLowerCase() : "java";
        String jobId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        List<CodeExecutionResult.TestResult> results = new ArrayList<>();
        int passed = 0;
        String sharedCompilationError = null;

        for (DSAProblem.TestCase tc : testCases) {
            ExecutionRunResult runResult = runCode(code, lang, problem, tc.getInput(), jobId);

            CodeExecutionResult.TestResult tr = new CodeExecutionResult.TestResult();
            tr.setInput(tc.isHidden() ? "[hidden]" : tc.getInput());
            tr.setExpectedOutput(tc.isHidden() ? "[hidden]" : tc.getExpectedOutput());
            tr.setHidden(tc.isHidden());
            tr.setDescription(tc.getDescription());

            if (runResult.compileError != null) {
                tr.setPassed(false);
                tr.setCompileError(runResult.compileError);
                tr.setActualOutput("Compilation Error");
                sharedCompilationError = runResult.compileError;
                results.add(tr);
                break;
            }

            if (runResult.timedOut) {
                tr.setPassed(false);
                tr.setActualOutput(tc.isHidden() ? "[hidden]" : "Time Limit Exceeded");
            } else if (runResult.exitCode != 0 || runResult.stderr.length() > 0) {
                tr.setPassed(false);
                tr.setActualOutput(tc.isHidden() ? "Runtime Error" : "Runtime Error: " + runResult.stderr);
            } else {
                String actual = runResult.stdout.trim();
                tr.setActualOutput(tc.isHidden() ? "[hidden]" : actual);
                if (tc.getExpectedOutput() != null) {
                    tr.setPassed(normalizeOutput(actual).equals(normalizeOutput(tc.getExpectedOutput())));
                } else {
                    tr.setPassed(false);
                }
            }

            if (tr.isPassed()) passed++;
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
        String lang = language != null ? language.toLowerCase() : "java";
        String jobId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        ExecutionRunResult runResult = runCode(code, lang, problem, customInput, jobId);

        CodeExecutionResult.TestResult tr = new CodeExecutionResult.TestResult();
        tr.setInput(customInput);
        tr.setExpectedOutput(null);
        tr.setHidden(false);
        tr.setDescription("Custom Input");

        if (runResult.compileError != null) {
            tr.setPassed(false);
            tr.setCompileError(runResult.compileError);
            tr.setActualOutput("Compilation Error");
        } else if (runResult.timedOut) {
            tr.setPassed(false);
            tr.setActualOutput("Time Limit Exceeded");
        } else {
            tr.setPassed(false);
            tr.setActualOutput(runResult.stdout.length() > 0 ? runResult.stdout : runResult.stderr);
        }

        CodeExecutionResult result = new CodeExecutionResult();
        result.setSuccess(true);
        result.setCustomRun(true);
        result.setResults(new CodeExecutionResult.TestResult[]{tr});
        result.setStdout(tr.getActualOutput());
        if (tr.getCompileError() != null) result.setCompilationError(tr.getCompileError());
        return result;
    }

    private ExecutionRunResult runCode(String code, String lang, DSAProblem problem, String stdin, String jobId) {
        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("mockmate_runner_" + jobId + "_");
            String fileName = harnessGeneratorService.sourceFileName(lang, jobId);
            Path sourceFile = tempDir.resolve(fileName);
            String harnessCode = harnessGeneratorService.generateHarness(code, lang, problem, stdin, jobId);
            Files.writeString(sourceFile, harnessCode);

            switch (lang) {
                case "java":
                    return runJava(sourceFile, tempDir, fileName, stdin);
                case "python":
                case "python3":
                case "py":
                    return runCommand(new String[]{"python3", sourceFile.toString()}, stdin, tempDir);
                case "javascript":
                case "js":
                case "node":
                    return runCommand(new String[]{"node", sourceFile.toString()}, stdin, tempDir);
                case "cpp":
                case "c++":
                    Path exePath = tempDir.resolve("program.exe");
                    ExecutionRunResult compileRes = runCommand(new String[]{"g++", "-O2", sourceFile.toString(), "-o", exePath.toString()}, "", tempDir);
                    if (compileRes.exitCode != 0 || compileRes.stderr.length() > 0) {
                        compileRes.compileError = compileRes.stderr.length() > 0 ? compileRes.stderr : "C++ Compilation Failed";
                        return compileRes;
                    }
                    return runCommand(new String[]{exePath.toString()}, stdin, tempDir);
                case "go":
                    return runCommand(new String[]{"go", "run", sourceFile.toString()}, stdin, tempDir);
                default:
                    return runJava(sourceFile, tempDir, fileName, stdin);
            }

        } catch (Exception e) {
            log.error("InApp execution error: {}", e.getMessage(), e);
            ExecutionRunResult err = new ExecutionRunResult();
            err.stderr = "Internal execution error: " + e.getMessage();
            return err;
        } finally {
            if (tempDir != null) {
                try {
                    deleteDirectory(tempDir.toFile());
                } catch (Exception ignored) {}
            }
        }
    }

    private ExecutionRunResult runJava(Path sourceFile, Path tempDir, String fileName, String stdin) {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler != null) {
            ByteArrayOutputStream errStream = new ByteArrayOutputStream();
            int compileResult = compiler.run(null, null, errStream, sourceFile.toString(), "-d", tempDir.toString());
            if (compileResult != 0) {
                ExecutionRunResult res = new ExecutionRunResult();
                res.compileError = errStream.toString().trim();
                return res;
            }
            String className = fileName.substring(0, fileName.lastIndexOf('.'));
            String javaExec = System.getProperty("java.home") + File.separator + "bin" + File.separator + "java";
            return runCommand(new String[]{javaExec, "-cp", tempDir.toString(), className}, stdin, tempDir);
        } else {
            // Fallback if compiler tool is missing (e.g. JRE without JDK)
            return runCommand(new String[]{"java", sourceFile.toString()}, stdin, tempDir);
        }
    }

    private ExecutionRunResult runCommand(String[] cmd, String stdin, Path workDir) {
        ExecutionRunResult result = new ExecutionRunResult();
        try {
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.directory(workDir.toFile());

            Process process = pb.start();

            if (stdin != null && !stdin.isEmpty()) {
                try (OutputStream os = process.getOutputStream()) {
                    os.write(stdin.getBytes());
                    os.flush();
                } catch (IOException ignored) {}
            }

            ByteArrayOutputStream stdoutBaos = new ByteArrayOutputStream();
            ByteArrayOutputStream stderrBaos = new ByteArrayOutputStream();

            Thread outThread = new Thread(() -> copyStream(process.getInputStream(), stdoutBaos));
            Thread errThread = new Thread(() -> copyStream(process.getErrorStream(), stderrBaos));
            outThread.start();
            errThread.start();

            boolean finished = process.waitFor(4, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                result.timedOut = true;
                return result;
            }

            outThread.join(1000);
            errThread.join(1000);

            result.exitCode = process.exitValue();
            result.stdout = stdoutBaos.toString().trim();
            result.stderr = stderrBaos.toString().trim();

        } catch (Exception e) {
            result.stderr = "Process execution failed: " + e.getMessage();
        }
        return result;
    }

    private void copyStream(InputStream in, OutputStream out) {
        try {
            byte[] buf = new byte[1024];
            int len;
            while ((len = in.read(buf)) != -1) {
                out.write(buf, 0, len);
            }
        } catch (IOException ignored) {}
    }

    private String normalizeOutput(String s) {
        if (s == null) return "";
        return s.trim().replace(" ", "").replace("\n", "").toLowerCase();
    }

    private void deleteDirectory(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isDirectory()) deleteDirectory(f);
                else f.delete();
            }
        }
        dir.delete();
    }

    private static class ExecutionRunResult {
        int exitCode;
        String stdout = "";
        String stderr = "";
        String compileError;
        boolean timedOut;
    }
}
