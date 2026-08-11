import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Split from 'react-split';
import {
  submitTechAnswer, executeTechCode, executeTechSQL,
  endTechInterview, getDsaProblem, getSqlProblem
} from '../utils/api';
import ConversationPanel from '../components/techinterview/ConversationPanel';
import CodeEditorPanel  from '../components/techinterview/CodeEditorPanel';
import SQLEditorPanel   from '../components/techinterview/SQLEditorPanel';
import WhiteboardPanel  from '../components/techinterview/WhiteboardPanel';
import InterviewerOrb   from '../components/techinterview/InterviewerOrb';

export default function TechInterviewPage() {
  const { sessionId } = useParams();
  const location       = useLocation();
  const navigate       = useNavigate();

  const { firstMessage, plan, editorConfig } = location.state || {};

  // ── Conversation state ────────────────────────────────────
  const [messages, setMessages]             = useState([]);
  const [currentInput, setCurrentInput]     = useState('');
  const [turnId, setTurnId]                 = useState(0);
  const [loading, setLoading]               = useState(false);
  const [orbState, setOrbState]             = useState('idle'); // 'idle' | 'speaking' | 'loading'
  const [interviewEnded, setInterviewEnded] = useState(false);

  // ── Editor state ──────────────────────────────────────────
  const config = plan?.interviewPlan?.config || plan?.config || {};
  const roundsList = plan?.interviewPlan?.rounds || plan?.rounds || [];

  const [editorMode, setEditorMode]         = useState(null); // null | 'CODE' | 'SQL' | 'WHITEBOARD'
  const [currentProblem, setCurrentProblem] = useState(null);
  const [loadingProblem, setLoadingProblem] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(config.preferredLanguage || 'java');
  const [codeResult, setCodeResult]         = useState(null);
  const [sqlResult, setSqlResult]           = useState(null);
  const [consoleResult, setConsoleResult]   = useState(null);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [complexity, setComplexity]         = useState({ time: '', space: '' });
  const [problemLoadError, setProblemLoadError] = useState(null);
  const [lastProblemRequest, setLastProblemRequest] = useState(null);
  // Tracks the pending "reset orb to idle" timeout so a new AI response
  // arriving before the previous one's timer fires can cancel it — each
  // response used to schedule its own uncancelled setTimeout, so an earlier
  // timer could force the orb back to idle mid-way through a newer response,
  // producing a visible flicker on rapid exchanges.
  const orbIdleTimerRef = useRef(null);
  // handleSendAnswer clears currentInput immediately (normal chat UX — the
  // box empties as soon as you hit send, before the network call resolves).
  // If that call then fails, Retry used to just re-invoke handleSendAnswer()
  // with no args, which re-reads currentInput — already empty — so Retry
  // silently no-op'd and the candidate's answer was unrecoverable. This ref
  // preserves the text that was actually sent so Retry can resend it.
  const lastSentTextRef = useRef('');

  // ── Timer & Round Info ────────────────────────────────────
  const [timeRemainingMinutes, setTimeRemaining] = useState(config.durationMinutes || 45);
  const [activeRound, setActiveRound]       = useState(roundsList[0] || null);

  // Push first AI message on mount and trigger speaking animation
  useEffect(() => {
    if (firstMessage) {
      setMessages([{ role: 'ai', text: firstMessage, timestamp: Date.now() }]);
      setOrbState('speaking');
      clearTimeout(orbIdleTimerRef.current);
      orbIdleTimerRef.current = setTimeout(() => setOrbState('idle'), 3000);
      return () => clearTimeout(orbIdleTimerRef.current);
    }
  }, [firstMessage]);

  // Auto-open code editor if starting directly in DSA round.
  // This previously called getDsaProblem() directly with no try/catch and no
  // loading gate — if that request failed for any reason (auth hiccup,
  // network blip, cold start), the rejection was silently swallowed:
  // editorMode still flipped to 'CODE' so the editor rendered, but
  // currentProblem stayed null forever with zero visible feedback, and
  // nothing stopped Run/Submit from firing with problemId=null. Now it goes
  // through the same loadProblem() path used for later problem switches,
  // which sets loadingProblem (blocking the editor behind the loading
  // skeleton) and surfaces a real error on failure.
  useEffect(() => {
    const initEditor = async () => {
      if (editorConfig && editorConfig.type === 'CODE') {
        setEditorMode('CODE');
        if (editorConfig.problemId) {
          await loadProblem('CODE', editorConfig.problemId);
        }
      } else if (editorConfig && editorConfig.type === 'SQL') {
        setEditorMode('SQL');
        if (editorConfig.problemId) {
          await loadProblem('SQL', editorConfig.problemId);
        }
      } else {
        const firstR = roundsList[0];
        if (firstR && (firstR.roundType === 'DSA' || firstR.roundId === 'round_dsa')) {
          setEditorMode('CODE');
          const probId = firstR.dsaProblems?.[0]?.problemId || 'lc-001';
          await loadProblem('CODE', probId);
        }
      }
    };
    initEditor();
  }, []);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(t => Math.max(0, t - 1/60));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Submit Answer ─────────────────────────────────────────
  const handleSendAnswer = async (overrideText = null, overrideCodeResult = null, overrideSqlResult = null) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : currentInput;
    const codeResToSend = overrideCodeResult || codeResult;
    const sqlResToSend = overrideSqlResult || sqlResult;

    if (!textToSend.trim() && !codeResToSend && !sqlResToSend) return;

    const answerText = textToSend.trim() || (codeResToSend ? '[Submitted solution via Code Editor]' : '[Submitted query via SQL Editor]');
    lastSentTextRef.current = textToSend;

    if (typeof overrideText !== 'string') {
      setCurrentInput('');
    }
    setLoading(true);
    setOrbState('loading');

    const userMsg = { role: 'user', text: answerText, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const payload = {
        answerText,
        turnId: turnId + 1,
        ...(codeResToSend && {
          codeSubmission: {
            code: codeResToSend.submittedCode,
            language: currentLanguage,
            problemId: currentProblem?.id,
            isSubmit: true,
          }
        }),
        ...(sqlResToSend && {
          sqlSubmission: {
            query: sqlResToSend.query,
            problemId: currentProblem?.id,
            result: sqlResToSend,
          }
        }),
        ...(complexity.time && { complexityAnswer: complexity }),
      };

      const { data } = await submitTechAnswer(sessionId, payload);

      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.aiResponse || data.errorMessage,
        action: data.action,
        isSystemError: data.systemError || data.action === 'SYSTEM_ERROR',
        timestamp: Date.now(),
      }]);

      setTurnId(t => t + 1);
      // `data.timeRemainingMinutes` is a legitimate 0 once time's up, but
      // `||` treats 0 as falsy and falls back to the stale (higher) value —
      // the countdown would silently freeze instead of reaching 0.
      setTimeRemaining(
        typeof data.timeRemainingMinutes === 'number' ? data.timeRemainingMinutes : timeRemainingMinutes
      );
      setOrbState(data.systemError ? 'idle' : 'speaking');
      clearTimeout(orbIdleTimerRef.current);
      if (!data.systemError) {
        orbIdleTimerRef.current = setTimeout(() => setOrbState('idle'), 3500);
      }

      // Round changed?
      if (data.roundChanged && data.newRound) {
        setActiveRound(data.newRound);
      }

      // Handle editor actions
      if (data.editorConfig) {
        const ec = data.editorConfig;
        setEditorMode(ec.type);
        if (ec.loadProblem && ec.problemId) {
          await loadProblem(ec.type, ec.problemId);
        }
      }
      if (data.action === 'CLOSE_EDITOR') setEditorMode(null);

      // Interview ended?
      if (data.interviewEnded || data.action === 'END_INTERVIEW') {
        setInterviewEnded(true);
        handleEndInterview();
      }

      // Clear code/sql results after a real submission — but NOT when the AI
      // service itself failed (systemError). Previously this ran unconditionally,
      // so a failed AI call silently discarded the user's already-executed code
      // result while the UI told them to "please re-submit your response" —
      // there was nothing left to resubmit without re-running the code first.
      if (!data.systemError) {
        // /answer is now the only place a code/SQL submission actually gets
        // executed (see handleSubmitCode/handleSubmitSQL) — it already runs
        // the FULL test set including hidden cases, so surface that graded
        // result here instead of immediately discarding it. A pre-call to
        // /execute-code used to run the same code through Piston a second
        // time just to populate this, doubling latency/Piston load/exposure
        // to the concurrent-submission bug for every single Submit click.
        setCodeResult(codeResToSend && data.codeResult
          ? { ...data.codeResult, submittedCode: codeResToSend.submittedCode, isSubmitted: true }
          : null);
        setSqlResult(sqlResToSend && data.sqlResult
          ? { ...data.sqlResult, query: sqlResToSend.query, isSubmitted: true }
          : null);
        setComplexity({ time: '', space: '' });
      }

    } catch (err) {
      console.error('[TechInterviewPage] Error submitting answer:', err);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: '⚠️ Something went wrong on our end while connecting to the AI interviewer service. Please try again.',
        isSystemError: true,
        timestamp: Date.now(),
      }]);
      setOrbState('idle');
      // A failed /answer call means the code/SQL grading that would have
      // happened server-side never ran — surface that in the editor's
      // Results tab (instead of leaving it blank) so Retry has a submission
      // to actually retry and the candidate isn't left guessing.
      if (codeResToSend) {
        setCodeResult({ success: false, submittedCode: codeResToSend.submittedCode, isSubmitted: true,
          compilationError: 'Submission failed to reach the interviewer — click Retry above to resend.' });
      }
      if (sqlResToSend) {
        setSqlResult({ success: false, query: sqlResToSend.query, isSubmitted: true,
          error: 'Submission failed to reach the interviewer — click Retry above to resend.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Load Problem (Bug 11: with loading guard) ────────────
  const loadProblem = async (type, problemId) => {
    setLoadingProblem(true);
    setProblemLoadError(null);
    setLastProblemRequest({ type, problemId });
    try {
      if (type === 'CODE') {
        const { data } = await getDsaProblem(problemId);
        setCurrentProblem(data);
      } else if (type === 'SQL') {
        const { data } = await getSqlProblem(problemId);
        setCurrentProblem(data);
      }
    } catch (e) {
      console.error('Failed to load problem', e);
      setCurrentProblem(null);
      setProblemLoadError(
        e?.response?.status === 401 || e?.response?.status === 403
          ? 'Your session may have expired. Try refreshing the page.'
          : (e?.message || 'Failed to load the problem.')
      );
    } finally {
      setLoadingProblem(false);
    }
  };

  // Problem isn't loaded — refuse to fire a request that's guaranteed to
  // fail with problemId=null, and tell the user why instead of a silent hang.
  const missingProblemResult = (isSubmitted) => ({
    success: false,
    compilationError: problemLoadError
      ? `Problem failed to load: ${problemLoadError}`
      : 'The problem is still loading. Please wait a moment and try again.',
    totalTestCases: 0, testCasesPassed: 0, allPassed: false,
    isSubmitted,
  });

  // ── Execute & Submit Code ──────────────────────────────────
  const handleRunCode = async (code, language) => {
    if (!currentProblem) {
      const res = { ...missingProblemResult(false), submittedCode: code };
      setCodeResult(res);
      return res;
    }
    setLoading(true);
    try {
      const { data } = await executeTechCode(sessionId, {
        code, language,
        problemId: currentProblem?.id,
      });
      const res = { ...data, submittedCode: code, isSubmitted: false };
      setCodeResult(res);
      return res;
    } catch (err) {
      // Previously missing: an axios timeout/network error here became an
      // unhandled rejection — the spinner just stopped with nothing shown.
      const res = { success: false, submittedCode: code, isSubmitted: false,
        compilationError: err?.message || 'Code execution failed. Please try again.' };
      setCodeResult(res);
      return res;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCode = async (code, language) => {
    if (!currentProblem) {
      const res = { ...missingProblemResult(true), submittedCode: code };
      setCodeResult(res);
      return res;
    }
    setLoading(true);
    try {
      // The /answer call below already runs this code through Piston once,
      // against the FULL test set (including hidden cases), whenever
      // codeSubmission.isSubmit=true — see handleSendAnswer's codeResult
      // population above. Calling /execute-code here first, as this used
      // to, ran the exact same code through Piston a second time for public
      // tests alone, immediately before the graded run repeated them anyway.
      return await handleSendAnswer(
        '[Submitted solution via Code Editor]',
        { submittedCode: code },
        null
      );
    } catch (err) {
      const res = { success: false, submittedCode: code, isSubmitted: true,
        compilationError: err?.message || 'Code submission failed. Please try again.' };
      setCodeResult(res);
      return res;
    } finally {
      setLoading(false);
    }
  };

  const missingProblemSqlResult = () => ({
    success: false,
    error: problemLoadError
      ? `Problem failed to load: ${problemLoadError}`
      : 'The problem is still loading. Please wait a moment and try again.',
  });

  // ── Execute & Submit SQL ───────────────────────────────────
  const handleRunSQL = async (query) => {
    if (!currentProblem) {
      const res = { ...missingProblemSqlResult(), query, isSubmitted: false };
      setSqlResult(res);
      return res;
    }
    setLoading(true);
    try {
      const { data } = await executeTechSQL(sessionId, {
        query,
        problemId: currentProblem?.id,
      });
      const res = { ...data, query, isSubmitted: false };
      setSqlResult(res);
      return res;
    } catch (err) {
      const res = { success: false, query, isSubmitted: false,
        error: err?.message || 'Query execution failed. Please try again.' };
      setSqlResult(res);
      return res;
    } finally {
      setLoading(false);
    }
  };

  // ── Console: run current code against arbitrary custom input ─────
  const handleRunConsole = async (code, language, customInput) => {
    if (!currentProblem) {
      setConsoleResult({ compilationError: 'The problem is still loading. Please wait a moment and try again.' });
      return;
    }
    setConsoleLoading(true);
    try {
      const { data } = await executeTechCode(sessionId, {
        code, language,
        problemId: currentProblem?.id,
        customInput,
      });
      setConsoleResult(data);
      return data;
    } catch (err) {
      setConsoleResult({ compilationError: err?.message || 'Console execution failed.' });
    } finally {
      setConsoleLoading(false);
    }
  };

  const handleSubmitSQL = async (query) => {
    if (!currentProblem) {
      const res = { ...missingProblemSqlResult(), query, isSubmitted: true };
      setSqlResult(res);
      return res;
    }
    setLoading(true);
    try {
      // Same reasoning as handleSubmitCode: /answer re-executes the query
      // itself for scoring, so a separate /execute-sql pre-call here was a
      // fully redundant round trip for every SQL Submit click.
      return await handleSendAnswer('[Submitted query via SQL Editor]', null, { query });
    } catch (err) {
      const res = { success: false, query, isSubmitted: true,
        error: err?.message || 'Query submission failed. Please try again.' };
      setSqlResult(res);
      return res;
    } finally {
      setLoading(false);
    }
  };

  // ── End Interview ─────────────────────────────────────────
  const handleEndInterview = async () => {
    try {
      const { data } = await endTechInterview(sessionId);
      navigate(`/tech-interview/report/${data.sessionId || sessionId}`);
    } catch (e) {
      navigate(`/tech-interview/report/${sessionId}`);
    }
  };

  const showEditor = editorMode !== null;
  const totalMin   = plan?.config?.durationMinutes || 45;
  const pct        = Math.min(100, ((totalMin - timeRemainingMinutes) / totalMin) * 100);

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {/* Top Header Bar */}
      <div style={styles.topBar}>
        <div style={styles.topLeft}>
          <InterviewerOrb state={orbState} interviewerName="MockMate AI Engine" />
        </div>

        <div style={styles.timerArea}>
          <div style={styles.timerBar}>
            <div style={{ ...styles.timerFill, width: `${pct}%` }} />
          </div>
          <span style={{
            ...styles.timerText,
            color: timeRemainingMinutes < 10 ? '#ef4444' : '#6b7280'
          }}>
            ⏱ {Math.ceil(timeRemainingMinutes)}m remaining
          </span>
        </div>

        <button style={styles.endBtn} onClick={() => {
          if (window.confirm('Are you sure you want to finish the interview and view your evaluation report?')) {
            handleEndInterview();
          }
        }}>
          End Interview
        </button>
      </div>

      {/* Main Content Layout */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {showEditor ? (
          <Split
            sizes={[40, 60]}
            minSize={320}
            style={{ display: 'flex', width: '100%' }}
            gutterStyle={() => ({
              background: 'rgba(0, 0, 0, 0.06)',
              cursor: 'col-resize',
              width: '4px',
            })}
          >
            {/* Left Panel: Conversation */}
            <div style={{ overflow: 'hidden', height: '100%' }}>
              <ConversationPanel
                messages={messages}
                currentInput={currentInput}
                onInputChange={setCurrentInput}
                onSend={handleSendAnswer}
                onRetry={() => handleSendAnswer(lastSentTextRef.current)}
                loading={loading}
                activeRoundName={activeRound?.roundName || 'Technical Interview'}
                activeTopic={activeRound?.topics?.[0] || ''}
                complexity={complexity}
                onComplexityChange={setComplexity}
                showComplexity={editorMode === 'CODE' && codeResult?.allPassed}
                editorMode={editorMode}
              />
            </div>

            {/* Right Panel: Active Workspace Tool */}
            <div style={{ overflow: 'hidden', height: '100%' }}>
              {loadingProblem ? (
                <div style={styles.loadingSkeleton}>
                  <div style={styles.spinner} />
                  <div style={styles.loadingText}>Loading problem & test cases...</div>
                </div>
              ) : (problemLoadError && !currentProblem) ? (
                <div style={styles.loadingSkeleton}>
                  <div style={{ fontSize: '32px' }}>⚠️</div>
                  <div style={{ ...styles.loadingText, color: '#dc2626', textAlign: 'center', maxWidth: '320px' }}>
                    Couldn't load the problem: {problemLoadError}
                  </div>
                  {lastProblemRequest && (
                    <button
                      style={styles.retryProblemBtn}
                      onClick={() => loadProblem(lastProblemRequest.type, lastProblemRequest.problemId)}
                    >
                      🔁 Retry
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {editorMode === 'CODE' && (
                    <CodeEditorPanel
                      problem={currentProblem}
                      language={currentLanguage}
                      onLanguageChange={setCurrentLanguage}
                      onRun={handleRunCode}
                      onSubmit={handleSubmitCode}
                      onRunConsole={handleRunConsole}
                      codeResult={codeResult}
                      consoleResult={consoleResult}
                      consoleLoading={consoleLoading}
                      loading={loading}
                    />
                  )}
                  {editorMode === 'SQL' && (
                    <SQLEditorPanel
                      problem={currentProblem}
                      onRun={handleRunSQL}
                      onSubmit={handleSubmitSQL}
                      sqlResult={sqlResult}
                      loading={loading}
                    />
                  )}
                  {editorMode === 'WHITEBOARD' && (
                    <WhiteboardPanel sessionId={sessionId} />
                  )}
                </>
              )}
            </div>
          </Split>
        ) : (
          <div style={{ width: '100%', maxWidth: '840px', margin: '0 auto', height: '100%' }}>
            <ConversationPanel
              messages={messages}
              currentInput={currentInput}
              onInputChange={setCurrentInput}
              onSend={handleSendAnswer}
              loading={loading}
              activeRoundName={activeRound?.roundName || 'Technical Interview'}
              activeTopic={activeRound?.topics?.[0] || ''}
              complexity={null}
              onComplexityChange={null}
              showComplexity={false}
              editorMode={null}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#fafafa',
    fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    background: '#ffffff',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    gap: '20px',
    flexShrink: 0,
  },
  topLeft: { display: 'flex', alignItems: 'center' },
  timerArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
    maxWidth: '300px',
  },
  timerBar: {
    width: '100%',
    height: '4px',
    background: 'rgba(0, 0, 0, 0.06)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6B46C1, #9F7AEA)',
    borderRadius: '2px',
    transition: 'width 1s linear',
  },
  timerText: {
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  endBtn: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    borderRadius: '10px',
    padding: '8px 16px',
    fontSize: '0.82rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  loadingSkeleton: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ffffff',
    color: '#6b7280',
    gap: '16px',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid rgba(107, 70, 193, 0.15)',
    borderTopColor: '#6B46C1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '0.88rem',
    fontWeight: '500',
    color: '#374151',
  },
  retryProblemBtn: {
    background: '#F3E8FF',
    border: '1px solid rgba(107, 70, 193, 0.3)',
    borderRadius: '10px',
    color: '#6B46C1',
    padding: '8px 18px',
    fontSize: '0.82rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
};
