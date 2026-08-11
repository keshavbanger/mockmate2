import { useState, useEffect, useRef } from 'react';
import { useInterview } from '../context/InterviewContext.jsx';
import { saveTurn } from '../utils/api.js';

// ─── Loading Overlay ──────────────────────────────────────────────────────────
function ConnectingOverlay({ visible }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center
                    bg-white/95 backdrop-blur-sm rounded-[32px] z-10 gap-6">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-2 border-purple-500/10 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-purple-500 animate-ping" />
        </div>
        <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-black font-bold tracking-tight">Connecting to MockMate</p>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Initializing Persona</p>
      </div>
    </div>
  );
}

// ─── TavusAvatar ──────────────────────────────────────────────────────────────
export default function TavusAvatar({ conversationUrl }) {
  const ctx = useInterview();
  const [loaded,   setLoaded]   = useState(false);
  const [isMock,   setIsMock]   = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  const iframeRef      = useRef(null);
  // Guard: track which mock question index has already been spoken
  const spokenUpToRef  = useRef(-1);

  const { currentQuestionIndex } = ctx.sessionMetrics;
  const { questions } = ctx;

  useEffect(() => {
    if (!conversationUrl) return;
    if (conversationUrl.includes('test-room')) {
      setIsMock(true);
      setLoaded(true);
    } else {
      setIsMock(false);
    }
  }, [conversationUrl]);

  // ── Speech synthesis cleanup on unmount or completion ─────────────────────
  useEffect(() => {
    if ('speechSynthesis' in window && ctx.sessionMetrics?.status === 'completed') {
      window.speechSynthesis.cancel();
    }
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [ctx.sessionMetrics?.status]);


  // ── 2. Tavus iframe messages (live mode only) ────────────────────────────
  // Tavus iframe messages - captures BOTH AI and candidate transcript turns.
  // In live Tavus mode, Tavus owns the microphone. Candidate speech comes
  // through Tavus transcript events, NOT Web SpeechRecognition (which conflicts).
  useEffect(() => {
    // Without this, a forged postMessage from any origin (e.g. this page
    // embedded in a hostile frame, or another script in the same window)
    // could inject fake transcript turns straight into the interview record
    // that feeds scoring. The iframe's own src IS the only origin a
    // legitimate Tavus/daily.co message can come from, so derive the
    // allowlist from it directly rather than hardcoding a domain guess.
    let expectedOrigin = null;
    try {
      expectedOrigin = conversationUrl ? new URL(conversationUrl).origin : null;
    } catch {
      expectedOrigin = null;
    }

    const handleMessage = (event) => {
      if (!expectedOrigin || event.origin !== expectedOrigin) return;

      const payload = event.data;
      if (!payload || typeof payload !== 'object') return;

      const { type, data, event: evtName } = payload;

      // Log all Tavus messages so we can see what event format is used
      if (type || evtName) {
        const logRole = (data || payload)?.role;
        console.log('[Tavus MSG] type=' + type + ' event=' + evtName + ' role=' + logRole);
      }

      // Match all known Tavus transcript event formats
      const isTranscriptEvent =
        type === 'transcript' ||
        evtName === 'conversation.transcript' ||
        type === 'conversation.transcript' ||
        evtName === 'transcript';

      if (!isTranscriptEvent) return;

      const transcriptData = data || payload.data || payload;
      const text = (transcriptData?.text || transcriptData?.content || '').trim();
      const role = (transcriptData?.role || transcriptData?.speaker || '').toLowerCase();

      if (!text || text.length < 2) return;

      if (role === 'assistant' || role === 'ai' || role === 'replica') {
        // AI interviewer spoke
        console.log('[Tavus] AI turn (' + text.length + ' chars):', text.substring(0, 80));
        ctx.updateTranscript('[AI] ' + text);
        saveTurn(ctx.sessionId, {
          role: 'interviewer',
          text,
          timestamp_ms: Date.now(),
        }).catch((err) => console.error('[Tavus] Failed to save interviewer turn:', err));

      } else if (role === 'user' || role === 'human' || role === 'candidate' || role === 'participant') {
        // CANDIDATE spoke - this path was MISSING before, causing empty reports
        console.log('[Tavus] CANDIDATE turn (' + text.length + ' chars):', text.substring(0, 80));
        ctx.updateTranscript(text);

        const qIdx = ctx.sessionMetrics?.currentQuestionIndex ?? 0;
        const questions = ctx.questions || [];
        const questionText = typeof questions[qIdx] === 'string'
          ? questions[qIdx]
          : (questions[qIdx]?.text ?? '');

        saveTurn(ctx.sessionId, {
          role: 'candidate',
          question_index: qIdx,
          question_text: questionText,
          text,
          timestamp_ms: Date.now(),
        }).catch((err) => console.error('[Tavus] Failed to save candidate turn:', err));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [ctx]);

  // ── 3. Mock mode TTS helper ──────────────────────────────────────────────
  const speakMock = (text, revealIndex = -1, onEnd = null) => {
    if (!('speechSynthesis' in window)) { onEnd?.(); return; }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = 0.95;
    utterance.pitch = 1.0;

    // Prefer a natural English voice
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      return (
        voices.find((v) => v.lang.startsWith('en-') && v.name.toLowerCase().includes('google')) ||
        voices.find((v) => v.lang.startsWith('en-')) ||
        null
      );
    };
    const voice = loadVoices();
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      setIsAISpeaking(true);
      ctx.setAIAsking(true);
      if (revealIndex !== -1) ctx.setRevealedQuestionIndex(revealIndex);
    };
    utterance.onend = () => {
      setIsAISpeaking(false);
      ctx.setAIAsking(false);
      onEnd?.();
    };
    utterance.onerror = () => {
      setIsAISpeaking(false);
      ctx.setAIAsking(false);
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  };

  // ── 4. Mock interview flow ───────────────────────────────────────────────
  useEffect(() => {
    if (!isMock || !questions.length) return;

    // Greeting + first question
    if (currentQuestionIndex === 0 && spokenUpToRef.current < 0) {
      spokenUpToRef.current = 0;
      const name    = ctx.resumeData?.name || 'there';
      const greeting = `Hello ${name}! Welcome to your mock interview. I'll ask you ${questions.length} questions. Let's begin. ${questions[0]}`;
      ctx.setRevealedQuestionIndex(-1);
      speakMock(greeting, 0);
      saveTurn(ctx.sessionId, { role: 'interviewer', text: greeting, timestamp_ms: Date.now() });
    }
    // Subsequent questions triggered by currentQuestionIndex advancing
    else if (
      currentQuestionIndex > 0 &&
      currentQuestionIndex < questions.length &&
      currentQuestionIndex > spokenUpToRef.current
    ) {
      spokenUpToRef.current = currentQuestionIndex;
      const text = questions[currentQuestionIndex];
      ctx.setRevealedQuestionIndex(-1);
      speakMock(text, currentQuestionIndex);
      saveTurn(ctx.sessionId, { role: 'interviewer', text, timestamp_ms: Date.now() });
    }
    // Closing
    else if (currentQuestionIndex >= questions.length && spokenUpToRef.current < questions.length) {
      spokenUpToRef.current = questions.length;
      const closing = 'That concludes the interview. Excellent work! Please click End Interview to generate your performance report.';
      speakMock(closing, -1);
      saveTurn(ctx.sessionId, { role: 'interviewer', text: closing, timestamp_ms: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMock, currentQuestionIndex, questions.length]);

  // ── 5. Advance to next question (called by "Next Question" button) ────────
  const handleNextQuestion = () => {
    if (isAISpeaking) {
      window.speechSynthesis.cancel();
    }
    if (isMock) {
      ctx.setTriggerSubmit(true);
    } else {
      const next = currentQuestionIndex + 1;
      ctx.setCurrentQuestion(next <= questions.length ? next : questions.length);
    }
  };

  // ── Render guard ─────────────────────────────────────────────────────────
  if (!conversationUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-[32px] border border-black/[0.03]">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Waiting for Session...</p>
      </div>
    );
  }

  const isLastQuestion = currentQuestionIndex >= questions.length;
  const noAvatar = ctx.interviewConfig?.noAvatar;

  const soundwaveStyle = (
    <style>{`
      @keyframes soundwave-bounce {
        0%, 100% { transform: scaleY(0.2); }
        50% { transform: scaleY(1); }
      }
      .soundwave-bar {
        animation: soundwave-bounce 1s ease-in-out infinite;
      }
    `}</style>
  );

  if (noAvatar) {
    return (
      <div className="flex flex-col h-full gap-4">
        {soundwaveStyle}
        
        {/* Render the hidden Tavus iframe in the background for live mode */}
        {!isMock && (
          <iframe
            ref={iframeRef}
            src={conversationUrl}
            allow="camera; microphone; autoplay; display-capture; fullscreen"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            className="absolute pointer-events-none"
            style={{ position: 'absolute', bottom: '10px', right: '10px', width: '200px', height: '150px', opacity: 0.001, zIndex: -1 }}
            title="InterviewBot AI Interviewer (Hidden)"
          />
        )}

        <div className="relative flex-1 bg-gradient-to-br from-[#1A103C] to-[#0A051A] rounded-[32px] overflow-hidden border border-purple-500/10 shadow-2xl p-8 flex flex-col items-center justify-between text-white text-center">
          <ConnectingOverlay visible={!loaded} />

          {/* Glowing gradient background elements */}
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-purple-600/10 blur-[80px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-72 h-72 rounded-full bg-violet-600/10 blur-[80px] pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 shrink-0">
            <span className="bg-purple-500/15 border border-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full backdrop-blur-md">
              Focus Mode Activated
            </span>
          </div>

          {/* Core visual soundwave / status */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 my-6 max-w-md w-full">
            <div className="flex items-end justify-center gap-1.5 h-16 w-32">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const delays = ['0.1s', '0.3s', '0.5s', '0.2s', '0.4s', '0.6s', '0.15s'];
                const heights = ['h-8', 'h-12', 'h-16', 'h-14', 'h-10', 'h-12', 'h-8'];
                const isSpeaking = isMock ? isAISpeaking : loaded;
                return (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-violet-400 ${heights[i]} ${
                      isSpeaking ? 'soundwave-bar' : 'opacity-40 transition-all duration-500 scale-y-[0.3]'
                    }`}
                    style={{
                      animationDelay: delays[i],
                      transformOrigin: 'center',
                    }}
                  />
                );
              })}
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-bold tracking-tight text-white/95">
                {isMock ? (
                  isAISpeaking ? 'MockMate is speaking…' : isLastQuestion ? 'Interview Complete' : 'Listening to you…'
                ) : (
                  loaded ? 'Connected to MockMate' : 'Connecting…'
                )}
              </h3>
              <p className="text-purple-200/60 text-xs font-semibold uppercase tracking-wider">
                {isMock ? (
                  isAISpeaking ? 'Reading next question' : isLastQuestion ? 'Generating report' : 'Speak clearly into your microphone'
                ) : (
                  loaded ? 'Voice session in progress' : 'Initializing replica'
                )}
              </p>
            </div>

            {/* Display Active Question Text directly in the Focus Mode panel! */}
            {!isLastQuestion && questions[currentQuestionIndex] && (
              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md mt-2 shadow-inner">
                <span className="block text-purple-300 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                  Current Question
                </span>
                <p className="text-white text-sm font-medium leading-relaxed italic">
                  "{questions[currentQuestionIndex]}"
                </p>
              </div>
            )}
          </div>

          {/* Progress & Next Button */}
          <div className="relative z-10 shrink-0 w-full flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1.5">
                {questions.map((_, i) => (
                  <div key={i} className="h-1 w-6 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className={`h-full bg-purple-500 transition-all duration-700 ${
                        i < currentQuestionIndex ? 'w-full' :
                        i === currentQuestionIndex ? 'w-1/2' : 'w-0'
                      }`}
                    />
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-purple-300/50 font-bold uppercase tracking-[0.2em]">
                {isLastQuestion ? 'Done' : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
              </span>
            </div>

            {/* Mock Next button moved to CandidatePanel */}
          </div>
        </div>

        {/* Interviewer label bar */}
        <div className="flex items-center justify-between px-6 py-4
                        bg-white rounded-[24px] border border-black/[0.03] shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center
                            border border-black/[0.03] text-black font-black text-xs shadow-sm">
              MM
            </div>
            <div>
              <p className="text-black text-sm font-bold tracking-tight">MockMate</p>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                {isMock ? 'Mock Voice Persona' : 'Live Voice Persona'}
              </p>
            </div>
          </div>

          {loaded ? (
            <div className="flex items-center gap-2 bg-purple-50 px-4 py-1.5 rounded-full border border-purple-500/10">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-purple-600 text-[10px] font-black uppercase tracking-widest">Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-1.5 rounded-full border border-black/[0.03]">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Idle</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── Avatar / iframe wrapper ─────────────────────────────────────── */}
      <div className="relative flex-1 bg-white rounded-[32px] overflow-hidden border border-black/[0.03] shadow-lg">
        <ConnectingOverlay visible={!loaded} />

        {isMock ? (
          /* ── Mock AI persona card ──────────────────────────────────────── */
          <div className="w-full h-full flex flex-col items-center justify-between bg-[#f8f9fa] p-10 text-center relative">
            
            {/* Warning banner indicating Tavus credits exhausted */}
            <div className="w-full max-w-sm mx-auto bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-sm mb-4">
              <span className="text-base shrink-0">⚠️</span>
              <div className="text-left leading-tight">
                <p className="font-bold text-slate-800">Tavus Credits Exhausted</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  Your configured Tavus API key is out of conversational credits. Falling back to Mock Mode using local Speech Synthesis.
                </p>
              </div>
            </div>

            {/* Avatar + pulse animation */}
            <div className="flex-1 flex flex-col items-center justify-center gap-8">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center border border-black/[0.03] shadow-2xl">
                  <span className="text-6xl">🤖</span>
                </div>
                {isAISpeaking && (
                  <div className="absolute -inset-4 rounded-full border border-purple-500/20 animate-ping opacity-60" />
                )}
              </div>

              <h3 className="text-black text-2xl font-black tracking-tighter">
                Mock<span className="text-purple-500">Mate</span>
              </h3>

              {/* Status bubble */}
              <div className="bg-white border border-black/[0.04] rounded-3xl px-8 py-5 max-w-sm w-full shadow-sm">
                <p className="text-slate-600 text-sm font-medium leading-relaxed italic">
                  {isAISpeaking
                    ? '🎙️ MockMate is speaking…'
                    : isLastQuestion
                    ? '✅ Interview complete! Click End Session.'
                    : '👂 Listening to your answer…'}
                </p>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex flex-col items-center gap-3 mt-6">
              <div className="flex gap-1.5">
                {questions.map((_, i) => (
                  <div key={i} className="h-1.5 w-6 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full bg-black transition-all duration-700 ${
                        i < currentQuestionIndex ? 'w-full' :
                        i === currentQuestionIndex ? 'w-1/2' : 'w-0'
                      }`}
                    />
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                {isLastQuestion ? 'Done' : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
              </span>
            </div>

            {/* ── "Next Question" button moved to CandidatePanel ── */}
          </div>

        ) : (
          /* ── Real Tavus iframe ─────────────────────────────────────────── */
          <iframe
            ref={iframeRef}
            src={conversationUrl}
            allow="camera; microphone; autoplay; display-capture; fullscreen"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            className="w-full h-full border-0"
            style={{ minHeight: '440px' }}
            title="InterviewBot AI Interviewer"
          />
        )}
      </div>

      {/* ── Interviewer label bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4
                      bg-white rounded-[24px] border border-black/[0.03] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center
                          border border-black/[0.03] text-black font-black text-xs shadow-sm">
            MM
          </div>
          <div>
            <p className="text-black text-sm font-bold tracking-tight">MockMate</p>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              {isMock ? 'Mock Persona' : 'Live Persona'}
            </p>
          </div>
        </div>

        {loaded ? (
          <div className="flex items-center gap-2 bg-purple-50 px-4 py-1.5 rounded-full border border-purple-500/10">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-purple-600 text-[10px] font-black uppercase tracking-widest">Connected</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-1.5 rounded-full border border-black/[0.03]">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Idle</span>
          </div>
        )}
      </div>
    </div>
  );
}
