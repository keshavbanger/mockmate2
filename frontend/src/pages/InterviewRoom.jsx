import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterview } from '../context/InterviewContext.jsx';
import TavusAvatar from '../components/TavusAvatar.jsx';
import CandidatePanel from '../components/CandidatePanel.jsx';
import { useToast } from '../components/Toast.jsx';
import { endInterview, generateReport, saveEmotionSnapshots } from '../utils/api.js';
import { useAudioStream } from '../utils/audioVisualizer.jsx';
import SpeechIndicator from '../utils/speechIndicator.jsx';

// ─── Timer ────────────────────────────────────────────────────────────────────
function useTimer(startTime) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 'sm' }) {
  const cls = size === 'lg' ? 'h-8 w-8' : 'h-4 w-4';
  return (
    <svg className={`${cls} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Report generation overlay stages ────────────────────────────────────────
const REPORT_STAGES = [
  { delay: 0,    text: 'Ending interview session…' },
  { delay: 2000, text: 'Processing transcript data…' },
  { delay: 3500, text: 'Analysing your performance…' },
  { delay: 5000, text: 'Generating your report ✨' },
];

// ─── InterviewRoom ────────────────────────────────────────────────────────────
export default function InterviewRoom() {
  const navigate = useNavigate();
  const ctx      = useInterview();
  const timer    = useTimer(ctx.sessionMetrics.startTime ?? Date.now());
  const { addToast, ToastContainer } = useToast();
  const { audioStream } = useAudioStream();

  const [ending,      setEnding]      = useState(false);
  const [stageText,   setStageText]   = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const lastSyncRef   = useRef(0);  // Track last emotion sync time

  // Guard: redirect if session is missing
  useEffect(() => {
    if (!ctx.sessionId || !ctx.conversationUrl) {
      navigate('/', { replace: true });
    }
  }, [ctx.sessionId, ctx.conversationUrl, navigate]);

  // ── Periodic emotion snapshot sync ────────────────────────────────────────
  // Send unsent emotion snapshots to backend every 5 seconds
  useEffect(() => {
    if (!ctx.sessionId || ctx.sessionMetrics.status !== 'active') return;

    const syncInterval = setInterval(async () => {
      const snapshots = ctx.sessionMetrics.emotionSnapshots || [];
      const lastSent = lastSyncRef.current;
      
      // Send only new snapshots
      const newSnapshots = snapshots.slice(lastSent);
      
      if (newSnapshots.length > 0) {
        try {
          await saveEmotionSnapshots(ctx.sessionId, newSnapshots);
          lastSyncRef.current = snapshots.length;
          console.log(`[EmotionSync] Sent ${newSnapshots.length} snapshots to backend`);
        } catch (err) {
          console.warn('[EmotionSync] Failed to send snapshots:', err);
          // Continue anyway - don't break the interview
        }
      }
    }, 5000); // Every 5 seconds

    return () => clearInterval(syncInterval);
  }, [ctx.sessionId, ctx.sessionMetrics.emotionSnapshots, ctx.sessionMetrics.status]);

  // ── Handle End Interview ──────────────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    setStageText(REPORT_STAGES[0].text);

    // Advance stage text on a schedule
    const timers = REPORT_STAGES.slice(1).map(({ delay, text }) =>
      setTimeout(() => setStageText(text), delay)
    );

    const clearTimers = () => timers.forEach(clearTimeout);

    try {
      // 1. Mark end time and status
      ctx.setEndTime(Date.now());
      ctx.setStatus('completed');

      // 2. Send any remaining emotion snapshots before ending interview
      const snapshots = ctx.sessionMetrics.emotionSnapshots || [];
      const lastSent = lastSyncRef.current;
      const remainingSnapshots = snapshots.slice(lastSent);
      if (remainingSnapshots.length > 0) {
        try {
          await saveEmotionSnapshots(ctx.sessionId, remainingSnapshots);
          console.log(`[EmotionSync] Sent final ${remainingSnapshots.length} snapshots before report generation`);
        } catch (err) {
          console.warn('[EmotionSync] Failed to send final snapshots:', err);
        }
      }

      // 3. End Tavus conversation
      await endInterview(ctx.sessionId, ctx.conversationId);

      // 4. Wait 2 seconds for the Tavus webhook to fire & store final transcript
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 5. Generate report (now with complete data)
      setStageText('Generating your report ✨');
      const { data: report } = await generateReport(ctx.sessionId);
      ctx.setReportData(report);

      clearTimers();
      navigate('/report');
    } catch (e) {
      clearTimers();
      console.error('End interview error:', e);
      const msg = e?.response?.data?.detail ?? 'Failed to generate report. Please try again.';
      addToast(msg, 'error', 6000);
      setEnding(false);
      setStageText('');
    }
  }, [ctx, ending, navigate, addToast]);

  if (!ctx.conversationUrl) return null;

  return (
    <div className="h-screen bg-surface-900 flex flex-col overflow-hidden">
      <ToastContainer />

      {/* ── Report generation full-screen overlay ─────────────────────────── */}
      {ending && (
        <div className="fixed inset-0 bg-surface-900/95 backdrop-blur-md z-50
                        flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-2 border-brand-500/20
                            flex items-center justify-center">
              <Spinner size="lg" />
            </div>
            <div className="absolute inset-0 rounded-full border-t-2 border-brand-400
                            animate-spin" style={{ animationDuration: '1.5s' }} />
          </div>
          <div className="text-center">
            <p className="text-white text-xl font-bold">{stageText}</p>
            <p className="text-slate-500 text-sm mt-1">
              This takes about 15–30 seconds
            </p>
          </div>
          {/* Animated dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-brand-400"
                style={{ animation: `pulse 1.4s ${i * 0.2}s ease-in-out infinite` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Top nav bar ───────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between
                         px-6 py-3 bg-surface-800 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-brand-400 font-bold text-lg tracking-tight">🎙️ InterviewBot</span>
          {ctx.interviewConfig && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="badge-purple text-[10px]">{ctx.interviewConfig.type}</span>
              <span className="badge bg-white/5 text-slate-400 border border-white/10 text-[10px]">
                {ctx.interviewConfig.difficulty}
              </span>
              <span className="badge bg-white/5 text-slate-400 border border-white/10 text-[10px]">
                {ctx.interviewConfig.language}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Recording indicator + timer + speech indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <span className="h-2 w-2 rounded-full bg-red-500 live-dot" />
              <span className="font-mono">{timer}</span>
            </div>
            {audioStream && <SpeechIndicator audioStream={audioStream} />}
          </div>

          {/* End button */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={ending}
            className="btn-danger flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1v-2a1 1 0 00-1-1H9z" />
            </svg>
            End Interview
          </button>
        </div>
      </header>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT — Tavus avatar (60%) */}
        <div className="w-[60%] flex-shrink-0 p-5 border-r border-white/5 overflow-hidden">
          <TavusAvatar conversationUrl={ctx.conversationUrl} />
        </div>

        {/* RIGHT — Candidate panel (40%) */}
        <div className="flex-1 p-5 overflow-y-auto">
          <CandidatePanel audioStream={audioStream} />
        </div>
      </main>

      {/* ── Confirm End modal ─────────────────────────────────────────────── */}
      {showConfirm && !ending && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40
                        flex items-center justify-center p-4">
          <div className="card-glow p-8 max-w-md w-full animate-slide-up text-center">
            <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center
                            mx-auto mb-5 text-2xl">
              🛑
            </div>
            <h2 className="text-xl font-bold text-white mb-2">End the Interview?</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              This will stop the session and generate your AI performance report.
              <br />
              <span className="text-slate-500">You cannot return once ended.</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-ghost px-8"
              >
                Continue Interview
              </button>
              <button
                onClick={() => { setShowConfirm(false); handleEnd(); }}
                className="btn-danger px-8"
              >
                End & Get Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
