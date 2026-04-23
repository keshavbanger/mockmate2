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
    <div className="h-screen bg-[#f8f9fa] flex flex-col overflow-hidden">
      <ToastContainer />

      {/* ── Report generation full-screen overlay ─────────────────────────── */}
      {ending && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-50
                        flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-2 border-purple-200
                            flex items-center justify-center">
              <div className="h-8 w-8 text-[#6B46C1]"><Spinner size="lg" /></div>
            </div>
            <div className="absolute inset-0 rounded-full border-t-2 border-[#6B46C1]
                            animate-spin" style={{ animationDuration: '1.5s' }} />
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-full bg-[#6B46C1] flex items-center justify-center text-white">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
              </div>
              <span className="text-black font-bold text-sm tracking-tight">MockMate</span>
            </div>
            <p className="text-black text-xl font-bold">{stageText}</p>
            <p className="text-slate-400 text-sm mt-1">This takes about 15–30 seconds</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-[#6B46C1]"
                style={{ animation: `pulse 1.4s ${i * 0.2}s ease-in-out infinite` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Top nav bar ───────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between
                         px-6 py-4 bg-white border-b border-black/[0.03] shadow-sm">
        <div className="flex items-center gap-3">
          {/* MockMate logo */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[#6B46C1] flex items-center justify-center text-white">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
            <span className="text-black font-bold text-base tracking-tight">MockMate</span>
          </div>
          {ctx.interviewConfig && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="badge-purple text-[10px]">{ctx.interviewConfig.type}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 font-semibold">
                {ctx.interviewConfig.difficulty}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100 font-semibold">
                {ctx.interviewConfig.language}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Recording indicator + timer + speech indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-black/[0.03] px-3 py-1.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-xs font-bold text-slate-500">{timer}</span>
            </div>
            {audioStream && <SpeechIndicator audioStream={audioStream} />}
          </div>

          {/* End button */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={ending}
            className="btn-black flex items-center gap-2 py-2 px-6 text-xs disabled:opacity-40"
          >
            End Session
          </button>
        </div>
      </header>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT — Tavus avatar (60%) */}
        <div className="w-[60%] flex-shrink-0 p-5 border-r border-black/[0.03] overflow-hidden">
          <TavusAvatar conversationUrl={ctx.conversationUrl} />
        </div>

        {/* RIGHT — Candidate panel (40%) */}
        <div className="flex-1 p-5 overflow-y-auto">
          <CandidatePanel audioStream={audioStream} />
        </div>
      </main>

      {/* ── Confirm End modal ─────────────────────────────────────────────── */}
      {showConfirm && !ending && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40
                        flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 max-w-md w-full text-center">
            <div className="h-14 w-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center
                            mx-auto mb-5 text-2xl">
              🛑
            </div>
            <h2 className="text-xl font-bold text-black mb-2">End the Interview?</h2>
            <p className="text-slate-500 text-sm mb-1 leading-relaxed">
              This will stop the session and generate your AI performance report.
            </p>
            <p className="text-red-400 text-xs font-semibold mb-6">You cannot return once ended.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-6 py-2.5 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Continue Interview
              </button>
              <button
                onClick={() => { setShowConfirm(false); handleEnd(); }}
                className="px-6 py-2.5 rounded-full bg-[#6B46C1] text-white text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md"
              >
                End &amp; Get Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
