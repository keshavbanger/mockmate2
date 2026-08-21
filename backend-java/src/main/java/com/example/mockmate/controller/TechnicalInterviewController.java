package com.example.mockmate.controller;

import com.example.mockmate.dto.techinterview.AnswerRequest;
import com.example.mockmate.dto.techinterview.CodeExecuteRequest;
import com.example.mockmate.dto.techinterview.SQLExecuteRequest;
import com.example.mockmate.model.SavedResume;
import com.example.mockmate.model.User;
import com.example.mockmate.model.techinterview.*;
import com.example.mockmate.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/tech-interview")
@RequiredArgsConstructor
public class TechnicalInterviewController {

    private final InterviewPlanGeneratorService planGeneratorService;
    private final TechInterviewStateService stateService;
    private final AIInterviewerService aiInterviewerService;
    private final CodeExecutionService codeExecutionService;
    private final SQLExecutionService sqlExecutionService;
    private final InterviewEvaluationService evaluationService;
    private final DSAProblemService dsaProblemService;
    private final ResumeTextExtractor resumeTextExtractor;
    private final SavedResumeService savedResumeService;
    private final com.example.mockmate.repository.TechInterviewReportRepository reportRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    // None of the session-scoped endpoints below used to compare the
    // session's owner against the authenticated caller — SecurityConfig only
    // required *some* authenticated user, not the session owner, so any
    // logged-in user who obtained another user's sessionId could read their
    // transcript/report, continue answering for them, or submit code/SQL
    // under their session. Sessions created without a token are tagged
    // "anon" (see startInterview) and stay accessible to anyone holding the
    // sessionId, same as the anonymous-report convention used elsewhere.
    private ResponseEntity<?> ownershipError() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "You do not have access to this session"));
    }

    private boolean isOwnedByOther(TechInterviewSession session, User user) {
        String owner = session.getUserId();
        if (owner == null || "anon".equals(owner)) return false;
        String callerId = user != null && user.getId() != null ? String.valueOf(user.getId()) : null;
        return !owner.equals(callerId);
    }

    // ── POST /plan — Generate + preview plan ──────────────────
    @PostMapping(value = "/plan", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> generatePlan(
            @RequestParam(value = "resume", required = false) MultipartFile resume,
            @RequestParam(value = "jdText", required = false) String jdText,
            @RequestParam(value = "roleLevel", required = false) String roleLevel,
            @RequestParam(value = "interviewType", required = false) String interviewType,
            @RequestParam(value = "companyStyle", required = false) String companyStyle,
            @RequestParam(value = "durationMinutes", required = false) String durationMinutes,
            @RequestParam(value = "preferredLanguage", required = false) String preferredLanguage,
            @RequestParam(value = "startDirectlyToDsa", required = false) Boolean startDirectlyToDsa,
            // Reuse a previously saved resume instead of re-uploading — see
            // SavedResumeController. When present, `resume` is ignored.
            @RequestParam(value = "savedResumeId", required = false) String savedResumeId,
            @RequestParam(value = "saveAsResume", required = false, defaultValue = "false") boolean saveAsResume,
            @RequestParam(value = "label", required = false) String label,
            @AuthenticationPrincipal User user) {

        try {
            String resumeText = "";
            if (savedResumeId != null && !savedResumeId.isBlank()) {
                if (user == null) {
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("error", "Authentication required to use a saved resume"));
                }
                SavedResume saved;
                try {
                    saved = savedResumeService.get(user.getId(), savedResumeId);
                } catch (NoSuchElementException e) {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
                }
                resumeText = saved.getRawText() != null ? saved.getRawText() : "";
                if (resumeText.isBlank() || resumeText.length() < 30) {
                    return ResponseEntity.badRequest().body(Map.of("error",
                            "Your saved resume doesn't contain enough readable text. Try uploading a different file."));
                }
            } else if (resume != null && !resume.isEmpty()) {
                resumeText = resumeTextExtractor.extract(resume);
                // ResumeTextExtractor swallows every failure and returns "" —
                // by design, so a bad file never 500s — but that means a
                // scanned/image-only PDF, a corrupt upload, or an unsupported
                // format previously produced a plan generated with ZERO
                // resume context and no indication to the candidate that
                // anything went wrong. The interview then looked "broken"
                // (fully generic questions) with no visible cause. Fail loudly
                // instead: this is a real, actionable failure the candidate
                // can fix by re-exporting/re-uploading, not a silent default.
                if (resumeText.isBlank() || resumeText.length() < 30) {
                    log.warn("Resume extraction produced {} chars for file '{}' — treating as a failed extraction.",
                            resumeText.length(), resume.getOriginalFilename());
                    return ResponseEntity.badRequest().body(Map.of("error",
                            "Couldn't read any text from that resume file. If it's a scanned image or a PDF exported from a design tool, try exporting a text-based PDF or DOCX instead."));
                }
                if (saveAsResume && user != null) {
                    try {
                        savedResumeService.upload(user.getId(), resume, label, false);
                    } catch (Exception e) {
                        log.warn("Failed to save resume for reuse (user {}): {}", user.getId(), e.getMessage());
                    }
                }
            }

            String effectiveLevel = (roleLevel != null && !roleLevel.isBlank()) ? roleLevel : "SDE_1";
            String effectiveJd    = (jdText != null) ? jdText : "";
            String effectiveLang  = (preferredLanguage != null && !preferredLanguage.isBlank()) ? preferredLanguage : "java";
            String effectiveStyle = (companyStyle != null && !companyStyle.isBlank()) ? companyStyle : "GENERIC";

            // Infer track if missing
            String effectiveType  = (interviewType != null && !interviewType.isBlank()) ? interviewType : "BACKEND";
            if (interviewType == null || interviewType.isBlank()) {
                String combined = (resumeText + " " + effectiveJd).toLowerCase();
                if (combined.contains("react") || combined.contains("frontend") || combined.contains("css")) {
                    effectiveType = "FRONTEND";
                } else if (combined.contains("data science") || combined.contains("machine learning") || combined.contains("python")) {
                    effectiveType = "DATA_SCIENCE";
                } else if (combined.contains("devops") || combined.contains("kubernetes") || combined.contains("docker")) {
                    effectiveType = "DEVOPS";
                }
            }

            // Estimate duration if missing or invalid
            int dur = 45;
            if (durationMinutes != null && !durationMinutes.isBlank()) {
                try { dur = Integer.parseInt(durationMinutes); } catch (Exception ignored) {}
            } else {
                if ("INTERN".equalsIgnoreCase(effectiveLevel) || "FRESHER".equalsIgnoreCase(effectiveLevel)) {
                    dur = 40;
                } else if ("SDE_2".equalsIgnoreCase(effectiveLevel) || "SDE_3".equalsIgnoreCase(effectiveLevel)) {
                    dur = 60;
                }
            }

            InterviewPlanConfig config = new InterviewPlanConfig();
            config.setResumeText(resumeText);
            config.setJdText(effectiveJd);
            config.setRoleLevel(effectiveLevel);
            config.setInterviewType(effectiveType);
            config.setCompanyStyle(effectiveStyle);
            config.setDurationMinutes(dur);
            config.setPreferredLanguage(effectiveLang);
            config.setStartDirectlyToDsa(Boolean.TRUE.equals(startDirectlyToDsa));

            InterviewPlan plan = planGeneratorService.generatePlan(config);
            if (user != null) plan.setUserId(user.getId() != null ? user.getId().toString() : "");

            return ResponseEntity.ok(Map.of(
                    "planId", plan.getPlanId(),
                    "plan", plan
            ));

        } catch (Exception e) {
            log.error("Plan generation failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── POST /start — Start session from plan ─────────────────
    @PostMapping("/start")
    public ResponseEntity<?> startInterview(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {

        try {
            String planId = (String) body.get("planId");
            // Retrieve the plan that was generated (it's embedded in the request for simplicity)
            Object planObj = body.get("plan");
            InterviewPlan plan;
            if (planObj != null) {
                // Plan was sent with the start request
                plan = objectMapper.convertValue(planObj, InterviewPlan.class);
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Plan not provided"));
            }

            String userId = user != null ? (user.getId() != null ? user.getId().toString() : "anon") : "anon";
            TechInterviewSession session = stateService.createSession(userId, plan);

            // Generate opening message
            AIInterviewerResponse opening = aiInterviewerService.generateOpeningMessage(session);

            // Record opening as turn 0
            TechInterviewSession.InterviewTurn turn = new TechInterviewSession.InterviewTurn();
            turn.setTurnId(0);
            turn.setRoundId(session.getCurrentRoundId() != null ? session.getCurrentRoundId() : "round_1");
            turn.setTimestamp(System.currentTimeMillis() / 1000);
            turn.setQuestion(opening.getResponseText());
            turn.setAiResponse(opening.getResponseText());
            turn.setAction(opening.getAction());
            stateService.addTurn(session.getSessionId(), turn);

            Map<String, Object> respMap = new HashMap<>();
            respMap.put("sessionId", session.getSessionId());
            respMap.put("firstMessage", opening.getResponseText());
            respMap.put("action", opening.getAction() != null ? opening.getAction() : "NEXT_QUESTION");
            if (opening.getEditorConfig() != null) {
                respMap.put("editorConfig", opening.getEditorConfig());
                if ("CODE".equals(opening.getEditorConfig().getType()) && opening.getEditorConfig().getProblemId() != null) {
                    stateService.setActiveDsaProblem(session.getSessionId(), opening.getEditorConfig().getProblemId());
                }
            }
            return ResponseEntity.ok(respMap);

        } catch (Exception e) {
            log.error("Interview start failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── POST /{sessionId}/answer — Submit answer ──────────────
    @PostMapping("/{sessionId}/answer")
    public ResponseEntity<?> submitAnswer(
            @PathVariable String sessionId,
            @Valid @RequestBody AnswerRequest request,
            @AuthenticationPrincipal User user) {

        try {
            TechInterviewSession session = stateService.getSession(sessionId);
            if (session == null) return ResponseEntity.notFound().build();
            if (isOwnedByOther(session, user)) return ownershipError();

            // Handle code submission if present
            CodeExecutionResult codeResult = null;
            if (request.getCodeSubmission() != null) {
                AnswerRequest.CodeSubmission cs = request.getCodeSubmission();
                // Diagnostic for a reported "AI says my code is empty despite a
                // passing solution on screen" case — logs what actually arrived
                // in the request body, the earliest point this can be checked,
                // so a recurrence can be pinpointed to frontend/transport vs.
                // backend processing instead of guessed at.
                int codeLen = cs.getCode() != null ? cs.getCode().length() : -1;
                if (codeLen <= 0) {
                    log.warn("Code submission for session {} arrived with {} — problemId={}, isSubmit={}. Payload itself is empty at the controller boundary.",
                            sessionId, codeLen == 0 ? "an empty code string" : "no code field at all", cs.getProblemId(), cs.isSubmit());
                }
                if (cs.isSubmit()) {
                    try {
                        codeResult = codeExecutionService.execute(
                                cs.getCode(), cs.getLanguage(), cs.getProblemId(), true);
                    } catch (Exception e) {
                        log.warn("Code execution during submission failed: {}", e.getMessage());
                        codeResult = new CodeExecutionResult();
                        codeResult.setCompilationError("Code execution failed: " + e.getMessage());
                    }
                    try {
                        updateDsaAttempt(sessionId, session, cs, codeResult, request.getComplexityAnswer());
                    } catch (Exception e) {
                        log.error("Failed to update DSA attempt for session {}", sessionId, e);
                    }
                }
            }

            // Handle SQL submission
            SQLExecutionResult sqlResult = null;
            if (request.getSqlSubmission() != null) {
                AnswerRequest.SQLSubmission ss = request.getSqlSubmission();
                try {
                    sqlResult = sqlExecutionService.executeQuery(ss.getQuery(), ss.getProblemId(), sessionId);
                } catch (Exception e) {
                    log.warn("SQL execution during submission failed: {}", e.getMessage());
                }
                // Previously nothing ever wrote into session.sqlAttempts (there was
                // no equivalent of updateDsaAttempt for SQL at all) — the entire SQL
                // round was invisible to scoring and the final report regardless of
                // how well the candidate actually did.
                try {
                    updateSqlAttempt(sessionId, ss, sqlResult);
                } catch (Exception e) {
                    log.error("Failed to update SQL attempt for session {}", sessionId, e);
                }
            }

            // Handle whiteboard
            if (request.getWhiteboardSnapshot() != null) {
                stateService.saveWhiteboard(sessionId, request.getWhiteboardSnapshot());
            }

            // Get AI response
            AIInterviewerResponse aiResp = aiInterviewerService.processAnswer(
                    session, request.getAnswerText(), codeResult, sqlResult);

            // Track which DSA problem is currently open (needed so a later
            // GIVE_HINT turn — which happens over chat, not a submission —
            // knows which attempt's hint counter to bump) and record hints as
            // they're actually given, instead of leaving hintsUsed frozen at 0.
            if (aiResp.getEditorConfig() != null && "CODE".equals(aiResp.getEditorConfig().getType())
                    && aiResp.getEditorConfig().getProblemId() != null) {
                stateService.setActiveDsaProblem(sessionId, aiResp.getEditorConfig().getProblemId());
            }
            if ("GIVE_HINT".equals(aiResp.getAction())) {
                stateService.recordHint(sessionId);
            }

            // Record turn
            TechInterviewSession.InterviewTurn turn = new TechInterviewSession.InterviewTurn();
            turn.setTurnId(request.getTurnId());
            turn.setTimestamp(System.currentTimeMillis() / 1000);
            turn.setCandidateAnswer(request.getAnswerText());
            turn.setAiResponse(aiResp.getResponseText());
            turn.setAction(aiResp.getAction());
            if (aiResp.getCurrentAnswerEvaluation() != null) {
                var eval = aiResp.getCurrentAnswerEvaluation();
                // Unlike the DSA scoring path (computeDsaScore, explicitly
                // clamped below), this score comes straight from the LLM's
                // JSON response with no bounds check — combined with the
                // prompt-injection surface on the candidate's raw answer
                // text (see AIInterviewerService.processAnswer), a
                // manipulated or simply hallucinated out-of-range value
                // would otherwise be stored and averaged into the report as-is.
                turn.setScore(Math.max(0, Math.min(100, eval.getScore())));
                turn.setQuality(eval.getQuality());
                turn.setTopicAssessed(eval.getTopicAssessed());
                turn.setCorrectPoints(eval.getCorrectPoints());
                turn.setMissedPoints(eval.getMissedPoints());
                turn.setMisconceptions(eval.getMisconceptions());
                turn.setInternalNote(eval.getInternalNote());
            }
            stateService.addTurn(sessionId, turn);

            // Check round transition
            boolean roundChanged = false;
            InterviewRound newRound = null;
            if ("NEXT_ROUND".equals(aiResp.getAction()) ||
                    (aiResp.getRoundProgress() != null && !aiResp.getRoundProgress().isShouldContinueRound())) {
                stateService.advanceToNextRound(sessionId);
                session = stateService.getSession(sessionId);
                roundChanged = true;
                if (!session.isEnded()) {
                    int ri = session.getCurrentRoundIndex();
                    List<InterviewRound> rounds = session.getPlan().getInterviewPlan().getRounds();
                    if (ri < rounds.size()) newRound = rounds.get(ri);
                }
            }

            // Compute time remaining
            long now = System.currentTimeMillis() / 1000;
            long elapsed = now - session.getStartedAt();
            int totalMin = session.getPlan().getConfig().getDurationMinutes();
            int remaining = (int) Math.max(0, totalMin - elapsed / 60);

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("aiResponse", aiResp.getResponseText());
            resp.put("action", aiResp.getAction());
            resp.put("nextQuestion", aiResp.getNextQuestion());
            resp.put("editorConfig", aiResp.getEditorConfig());
            resp.put("roundChanged", roundChanged);
            resp.put("newRound", newRound);
            resp.put("timeRemainingMinutes", remaining);
            resp.put("interviewEnded", session.isEnded());
            if (codeResult != null) resp.put("codeResult", codeResult);
            if (sqlResult != null) resp.put("sqlResult", sqlResult);

            return ResponseEntity.ok(resp);

        } catch (Exception e) {
            log.error("Answer submission failed for session {}", sessionId, e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── POST /{sessionId}/execute-code ────────────────────────
    @PostMapping("/{sessionId}/execute-code")
    public ResponseEntity<?> executeCode(
            @PathVariable String sessionId,
            @Valid @RequestBody CodeExecuteRequest request,
            @AuthenticationPrincipal User user) {
        try {
            TechInterviewSession session = stateService.getSession(sessionId);
            if (session == null) return ResponseEntity.notFound().build();
            if (isOwnedByOther(session, user)) return ownershipError();

            // Console/"run with custom input" requests don't grade against the
            // problem's fixed test cases — they just run the candidate's code
            // against whatever input they typed and return raw output.
            CodeExecutionResult result = (request.getCustomInput() != null && !request.getCustomInput().isBlank())
                    ? codeExecutionService.executeCustom(
                            request.getCode(), request.getLanguage(), request.getProblemId(), request.getCustomInput())
                    : codeExecutionService.execute(
                            request.getCode(), request.getLanguage(), request.getProblemId(), false);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Code execution failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── POST /{sessionId}/execute-sql ─────────────────────────
    @PostMapping("/{sessionId}/execute-sql")
    public ResponseEntity<?> executeSQL(
            @PathVariable String sessionId,
            @Valid @RequestBody SQLExecuteRequest request,
            @AuthenticationPrincipal User user) {
        try {
            TechInterviewSession session = stateService.getSession(sessionId);
            if (session == null) return ResponseEntity.notFound().build();
            if (isOwnedByOther(session, user)) return ownershipError();

            SQLExecutionResult result = sqlExecutionService.executeQuery(
                    request.getQuery(), request.getProblemId(), sessionId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("SQL execution failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── POST /{sessionId}/save-whiteboard ─────────────────────
    @PostMapping("/{sessionId}/save-whiteboard")
    public ResponseEntity<?> saveWhiteboard(
            @PathVariable String sessionId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {
        TechInterviewSession session = stateService.getSession(sessionId);
        if (session == null) return ResponseEntity.notFound().build();
        if (isOwnedByOther(session, user)) return ownershipError();
        stateService.saveWhiteboard(sessionId, body.get("snapshot"));
        return ResponseEntity.ok(Map.of("saved", true));
    }

    // ── POST /{sessionId}/end ─────────────────────────────────
    @PostMapping("/{sessionId}/end")
    public ResponseEntity<?> endInterview(
            @PathVariable String sessionId,
            @AuthenticationPrincipal User user) {
        try {
            TechInterviewSession session = stateService.getSession(sessionId);
            if (session == null) return ResponseEntity.notFound().build();
            if (isOwnedByOther(session, user)) return ownershipError();
            stateService.endSession(sessionId);
            TechInterviewReport report = evaluationService.evaluate(session);
            // Persist report
            saveReport(session.getSessionId(), report);
            return ResponseEntity.ok(Map.of(
                    "reportId", report.getReportId(),
                    "sessionId", sessionId
            ));
        } catch (Exception e) {
            log.error("Interview end failed for session {}", sessionId, e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── GET /report/{sessionId} ───────────────────────────────
    @GetMapping("/report/{sessionId}")
    public ResponseEntity<?> getReport(@PathVariable String sessionId, @AuthenticationPrincipal User user) {
        try {
            TechInterviewSession session = stateService.getSession(sessionId);
            if (session == null) return ResponseEntity.notFound().build();
            if (isOwnedByOther(session, user)) return ownershipError();

            // DB row is now the primary source; disk is only consulted for
            // reports saved before this migration (a redeploy could have
            // cleared the disk copy but not the DB row, or vice versa for a
            // pre-migration session).
            var existing = reportRepository.findBySessionId(sessionId);
            if (existing.isPresent()) {
                return ResponseEntity.ok(existing.get().getReportJson());
            }

            java.io.File reportFile = new java.io.File(
                    "data/sessions/technical/" + sessionId + "/report.json");
            if (reportFile.exists()) {
                TechInterviewReport report = objectMapper.readValue(reportFile, TechInterviewReport.class);
                return ResponseEntity.ok(report);
            }

            // Generate on demand
            TechInterviewReport report = evaluationService.evaluate(session);
            saveReport(sessionId, report);
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            log.error("Report fetch failed for session {}", sessionId, e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── GET /history/{userId} ─────────────────────────────────
    @GetMapping("/history/{userId}")
    public ResponseEntity<?> getHistory(@PathVariable String userId, @AuthenticationPrincipal User user) {
        // {userId} in the path is NOT trusted — history is always scoped to
        // the caller's own identity resolved from their JWT, same pattern as
        // ATSController.getHistory, so a client can't pull another user's
        // full interview history just by changing the path segment.
        if (user == null || user.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Login required to view interview history"));
        }
        String callerId = String.valueOf(user.getId());
        try {
            // Previously scanned every session directory on disk on every
            // request — slow, unpaginated, and lost on an ephemeral-disk
            // restart. Only completed interviews have a saved report row, so
            // this naturally reflects "interviews you finished," which is
            // what a report history should show anyway.
            List<Map<String, Object>> history = new ArrayList<>();
            for (var entity : reportRepository.findByUserIdOrderByCreatedAtDesc(callerId)) {
                TechInterviewReport report = entity.getReportJson();
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("sessionId", entity.getSessionId());
                entry.put("date", entity.getCreatedAt()
                        .atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli());
                entry.put("role", entity.getRoleLevel());
                entry.put("interviewType", entity.getInterviewType());
                entry.put("overallScore", entity.getOverallScore());
                entry.put("companyStyle", report != null ? report.getCompanyStyle() : null);
                entry.put("ended", true);
                history.add(entry);
            }
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── GET /problems/dsa/{problemId} ─────────────────────────
    @GetMapping("/problems/dsa/{problemId}")
    public ResponseEntity<?> getDsaProblem(@PathVariable String problemId) {
        DSAProblem problem = dsaProblemService.getProblem(problemId);
        if (problem == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(problem);
    }

    // ── GET /{sessionId}/debug ──────────────────────────────────
    @GetMapping("/{sessionId}/debug")
    public ResponseEntity<?> getSessionDebugInfo(@PathVariable String sessionId, @AuthenticationPrincipal User user) {
        TechInterviewSession session = stateService.getSession(sessionId);
        if (session == null) return ResponseEntity.notFound().build();
        if (isOwnedByOther(session, user)) return ownershipError();

        Map<String, Object> debug = new LinkedHashMap<>();
        debug.put("sessionId", session.getSessionId());
        debug.put("isEnded", session.isEnded());
        debug.put("currentRoundIndex", session.getCurrentRoundIndex());
        if (session.getPlan() != null && session.getPlan().getInterviewPlan() != null && session.getPlan().getInterviewPlan().getRounds() != null) {
            debug.put("totalRounds", session.getPlan().getInterviewPlan().getRounds().size());
            debug.put("rounds", session.getPlan().getInterviewPlan().getRounds().stream().map(r -> Map.of(
                    "roundId", r.getRoundId() != null ? r.getRoundId() : "",
                    "roundName", r.getRoundName() != null ? r.getRoundName() : "",
                    "roundType", r.getRoundType() != null ? r.getRoundType() : "",
                    "allocatedMinutes", r.getAllocatedMinutes(),
                    "topics", r.getTopics() != null ? r.getTopics() : List.of()
            )).collect(Collectors.toList()));
        }
        debug.put("turnsCount", session.getTurns() != null ? session.getTurns().size() : 0);
        return ResponseEntity.ok(debug);
    }

    // ── GET /problems/sql/{problemId} ─────────────────────────
    @GetMapping("/problems/sql/{problemId}")
    public ResponseEntity<?> getSqlProblem(@PathVariable String problemId) {
        var problem = sqlExecutionService.getProblem(problemId);
        if (problem == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(problem);
    }

    // ── GET /health/execution ────────────────────────────────
    @GetMapping("/health/execution")
    public ResponseEntity<?> getExecutionHealth() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status", "UP");
        health.put("provider", codeExecutionService.getActiveProviderName());
        health.put("supportedLanguages", List.of("java", "python", "javascript", "cpp", "go"));
        return ResponseEntity.ok(health);
    }

    // ── Helpers ───────────────────────────────────────────────
    private void updateDsaAttempt(String sessionId, TechInterviewSession session,
                                   AnswerRequest.CodeSubmission cs, CodeExecutionResult codeResult,
                                   AnswerRequest.ComplexityAnswer complexity) {
        if (cs == null || codeResult == null) return;
        Map<String, TechInterviewSession.DSAAttempt> dsaAttempts = session.getDsaAttempts();
        if (dsaAttempts == null) {
            dsaAttempts = new HashMap<>();
            session.setDsaAttempts(dsaAttempts);
        }
        String pid = cs.getProblemId() != null ? cs.getProblemId() : "general_code";
        TechInterviewSession.DSAAttempt attempt = dsaAttempts.getOrDefault(pid, new TechInterviewSession.DSAAttempt());
        attempt.setProblemId(pid);
        attempt.setFinalCode(cs.getCode());
        attempt.setLanguage(cs.getLanguage());
        attempt.setTestCasesPassed(codeResult.getTestCasesPassed());
        attempt.setTotalTestCases(codeResult.getTotalTestCases());
        attempt.setAllPassed(codeResult.isAllPassed());

        // Determine approach quality
        if (codeResult.isAllPassed()) {
            attempt.setApproachQuality("OPTIMAL");
        } else if (codeResult.getTestCasesPassed() > 0) {
            attempt.setApproachQuality("PARTIAL");
        } else {
            attempt.setApproachQuality("WRONG");
        }

        if (complexity != null) {
            attempt.setTimeComplexityAnswer(complexity.getTime());
            attempt.setSpaceComplexityAnswer(complexity.getSpace());
        }

        // Complexity correctness was declared on the model (complexityCorrect)
        // but nothing ever set it, and the score below awarded full points for
        // ANY non-blank answer — a candidate could type "O(n^100)" for Two Sum
        // and still get full complexity credit. Compare against the problem's
        // documented optimal complexity instead.
        DSAProblem problemDef = dsaProblemService.getProblemFull(pid);
        if (complexity != null && problemDef != null && problemDef.getOptimalSolution() != null) {
            boolean timeOk = complexityMatches(complexity.getTime(), problemDef.getOptimalSolution().getTimeComplexity());
            boolean spaceOk = complexityMatches(complexity.getSpace(), problemDef.getOptimalSolution().getSpaceComplexity());
            attempt.setComplexityCorrect(timeOk && spaceOk);
        }

        // Score calculation
        int score = computeDsaScore(attempt);
        attempt.setScore(score);

        stateService.updateDsaAttempt(sessionId, attempt);
    }

    private int computeDsaScore(TechInterviewSession.DSAAttempt attempt) {
        int score = 0;
        if ("OPTIMAL".equals(attempt.getApproachQuality())) score += 20;
        else if ("PARTIAL".equals(attempt.getApproachQuality())) score += 10;

        if (attempt.getTotalTestCases() > 0) {
            double passRate = (double) attempt.getTestCasesPassed() / attempt.getTotalTestCases();
            score += (int)(passRate * 55);
        }

        boolean hasTimeAnswer  = attempt.getTimeComplexityAnswer()  != null && !attempt.getTimeComplexityAnswer().isBlank();
        boolean hasSpaceAnswer = attempt.getSpaceComplexityAnswer() != null && !attempt.getSpaceComplexityAnswer().isBlank();
        if (attempt.isComplexityCorrect()) {
            // Correct complexity: full 25 points (matches the previous 15+10 max)
            score += 25;
        } else if (hasTimeAnswer || hasSpaceAnswer) {
            // Attempted but wrong/unverified (e.g. no reference complexity on
            // file for this problem) — partial credit for engaging with the
            // question at all, well short of full marks for being right.
            score += 8;
        }

        score -= attempt.getHintsUsed() * 10;
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Normalizes and compares Big-O style complexity strings (e.g. "O(n log n)"
     * vs "o(nlogn)"). Deliberately conservative: only awards credit on a fairly
     * literal match, since a fuzzier equivalence check (e.g. treating O(n) and
     * O(n+m) as "the same") risks giving credit for answers that aren't
     * actually equivalent.
     */
    private boolean complexityMatches(String candidate, String reference) {
        if (candidate == null || reference == null) return false;
        String a = normalizeComplexity(candidate);
        String b = normalizeComplexity(reference);
        return !a.isEmpty() && a.equals(b);
    }

    private String normalizeComplexity(String s) {
        if (s == null) return "";
        return s.toLowerCase()
                .replaceAll("\\s+", "")
                .replace("big-o", "o")
                .replace("bigo", "o")
                .replace("θ", "o")
                .replace("*", "")
                .replaceAll("^o\\(|\\)$", "");
    }

    // SQL equivalent of updateDsaAttempt — see comment at its call site for
    // why this exists (sqlAttempts was previously never written to at all).
    private void updateSqlAttempt(String sessionId, AnswerRequest.SQLSubmission ss, SQLExecutionResult sqlResult) {
        if (ss == null || sqlResult == null) return;
        TechInterviewSession.SQLAttempt attempt = new TechInterviewSession.SQLAttempt();
        attempt.setProblemId(ss.getProblemId() != null ? ss.getProblemId() : "general_sql");
        attempt.setFinalQuery(ss.getQuery());
        attempt.setCorrect(sqlResult.isCorrect());
        attempt.setScore(computeSqlScore(sqlResult));
        stateService.updateSqlAttempt(sessionId, attempt);
    }

    private int computeSqlScore(SQLExecutionResult result) {
        if (result == null || !result.isSuccess()) return 0;   // didn't even run (syntax error, blocked statement, etc.)
        if (result.isCorrect()) return 100;                     // matches expected result
        return 25;                                              // valid, executable query — just the wrong result
    }

    private void saveReport(String sessionId, TechInterviewReport report) {
        // Disk copy kept as a secondary artifact (cheap, harmless); the DB
        // row below is now the primary, durable source for getReport()/
        // getHistory() — see TechInterviewReportEntity's javadoc for why.
        try {
            java.io.File dir = new java.io.File("data/sessions/technical/" + sessionId);
            dir.mkdirs();
            objectMapper.writeValue(new java.io.File(dir, "report.json"), report);
        } catch (Exception e) {
            log.error("Failed to save report for session {}", sessionId, e);
        }

        try {
            com.example.mockmate.model.techinterview.TechInterviewReportEntity entity =
                    reportRepository.findBySessionId(sessionId).orElseGet(
                            com.example.mockmate.model.techinterview.TechInterviewReportEntity::new);
            entity.setUserId(report.getUserId());
            entity.setSessionId(sessionId);
            entity.setRoleLevel(report.getRoleLevel());
            entity.setInterviewType(report.getInterviewType());
            entity.setOverallScore(report.getOverallScore());
            entity.setReportJson(report);
            reportRepository.save(entity);
        } catch (Exception e) {
            log.error("Failed to persist report row for session {}", sessionId, e);
        }
    }
}
