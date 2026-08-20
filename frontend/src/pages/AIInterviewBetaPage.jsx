import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ResumeSourcePicker from '../components/shared/ResumeSourcePicker.jsx';
import AIInterviewer from '../components/aiinterviewer/AIInterviewer.jsx';
import AudioRecorder from '../utils/audioRecorder.js';
import { speak, cancelSpeech } from '../utils/ttsProvider.js';
import { useToast } from '../components/Toast.jsx';
import {
  createSession, parseResume,
  startAiEngine, transcribeAiEngineAudio, sendAiEngineMessage, endAiEngine, generateReport,
} from '../utils/api.js';

const INTERVIEW_TYPES = ['Technical', 'Behavioral', 'HR', 'Mixed'];
const DIFFICULTIES = ['Junior', 'Mid Level', 'Senior'];
const LANGUAGES = ['English', 'Hindi', 'Hinglish'];
const AVATAR_SETS = [
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
];
// No fixed question count anymore — the interview ends when the adaptive
// engine decides enough has been assessed (see InterviewEngineService),
// gated by roughly this many minutes rather than a question tally.
const DURATION_OPTIONS = [
  { value: 15, label: 'Short (~15 min)' },
  { value: 25, label: 'Standard (~25–30 min)' },
  { value: 45, label: 'Deep (~40–45 min)' },
];
// Floor for the THINKING state so a fast response doesn't feel like an
// instant, jarring cut — per the avatar design brief's state machine.
// Skipped entirely for REPEAT_REQUEST (see submitAnswer): that's a replay,
// not new content, so there's nothing to "think" about.
const MIN_THINKING_MS = 700;

// Fully self-contained page for the AI Interview Engine (beta, no Tavus) —
// its own resume upload + session state (not the shared InterviewContext
// the Tavus flow uses), so there is zero shared-state risk with the
// existing AI Mock Interview. Not linked from any nav menu; reachable only
// via /ai-engine-beta directly, for local testing before any decision to
// replace Tavus is made.
export default function AIInterviewBetaPage() {
  const navigate = useNavigate();
  const { addToast, ToastContainer } = useToast();

  const [step, setStep] = useState('setup'); // setup | interview | ending
  const [starting, setStarting] = useState(false);

  // Either { mode: 'saved', savedResumeId } or
  // { mode: 'upload', file, saveAsResume, label } — see ResumeSourcePicker.
  const [resumeSource, setResumeSource] = useState(null);
  const [roleTitle, setRoleTitle] = useState('');
  const [jobDescription, setJobDescription] = useState(''); // optional — see spec §4
  const [interviewType, setInterviewType] = useState('Technical');
  const [difficulty, setDifficulty] = useState('Mid Level');
  const [language, setLanguage] = useState('English');
  const [durationMinutes, setDurationMinutes] = useState(25);
  // Chosen once at setup, not switchable mid-interview — see VideoAvatarFace.
  const [avatarSet, setAvatarSet] = useState('man');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [sessionId, setSessionId] = useState(null);
  const [message, setMessage] = useState('');
  const [turnType, setTurnType] = useState('AI_MESSAGE');
  // Total questions asked so far (primary + follow-up combined) — no fixed
  // denominator, since the adaptive engine has no fixed question count.
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [status, setStatus] = useState('active');

  // ── Avatar state machine: idle | listening | thinking | speaking ──────
  const [avatarState, setAvatarState] = useState('idle');
  const [micStream, setMicStream] = useState(null);
  const [mouthPulse, setMouthPulse] = useState(0);
  const [textAnswer, setTextAnswer] = useState('');

  const audioRecorderRef = useRef(null);
  useEffect(() => { audioRecorderRef.current = new AudioRecorder(); }, []);
  useEffect(() => () => cancelSpeech(), []);

  // Header's "Time Elapsed" — ticks for the whole interview step, stops
  // once the interview completes rather than continuing to run in the
  // background after the candidate is done answering.
  useEffect(() => {
    if (step !== 'interview' || status === 'completed') return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [step, status]);

  // Refs mirroring state read inside long-lived SpeechSynthesis callbacks
  // (onboundary/onend fire outside React's render cycle, so a plain closure
  // over state would see stale values — same pattern CandidatePanel.jsx
  // already uses for its own ctxRef).
  const micPermissionGrantedRef = useRef(false);
  const isLastQuestionRef = useRef(false);
  const thinkingStartedAtRef = useRef(0);

  // Both are terminal — "ended_due_to_no_engagement" means the engine gave up
  // because answers weren't coming through, which still ends the interview.
  const isLastQuestion = status === 'completed' || status === 'ended_due_to_no_engagement';
  useEffect(() => { isLastQuestionRef.current = isLastQuestion; }, [isLastQuestion]);

  // ── Recording ───────────────────────────────────────────────────────
  const beginRecording = async () => {
    if (avatarState === 'speaking') cancelSpeech();
    const res = await audioRecorderRef.current.start();
    if (res.success) {
      micPermissionGrantedRef.current = true;
      setMicStream(audioRecorderRef.current.getStream());
      setAvatarState('listening');
    } else {
      addToast('Microphone access failed: ' + res.error + ' — you can type your answer below instead.', 'error');
      setAvatarState('idle');
    }
  };

  const stopRecordingAndSubmit = async () => {
    setAvatarState('thinking');
    thinkingStartedAtRef.current = Date.now();
    setMicStream(null);
    try {
      const { blob } = await audioRecorderRef.current.stop();
      const { data } = await transcribeAiEngineAudio(sessionId, blob);
      const transcript = data.transcript;
      if (!transcript) {
        addToast('Could not transcribe that — please try again or type your answer.', 'error');
        setAvatarState('idle');
        return;
      }
      await submitAnswer(transcript);
    } catch (err) {
      console.error('[AIInterviewBeta] Transcription failed:', err);
      addToast('Transcription failed. Please try again.', 'error');
      setAvatarState('idle');
    }
  };

  // ── AI turn playback ────────────────────────────────────────────────
  const playAiMessage = (text) => {
    setAvatarState('speaking');
    speak(text, {
      onBoundary: () => setMouthPulse((n) => n + 1),
      onEnd: () => {
        if (isLastQuestionRef.current) {
          setAvatarState('idle');
        } else if (micPermissionGrantedRef.current) {
          // SPEAKING → LISTENING directly (skip IDLE) once the mic has
          // already been granted once — per the state machine's normal-flow
          // transition. The very first turn still needs a manual click
          // since mic permission hasn't been granted yet.
          beginRecording();
        } else {
          setAvatarState('idle');
        }
      },
    });
  };

  const submitAnswer = async (answerText) => {
    if (!answerText || !answerText.trim()) {
      setAvatarState('idle');
      return;
    }
    try {
      const { data } = await sendAiEngineMessage(sessionId, answerText.trim());
      if (data.success === false) {
        addToast(data.message || 'AI interviewer is temporarily unavailable.', 'error');
        setAvatarState('idle');
        return;
      }
      setMessage(data.response);
      setTurnType(data.turnType);
      setQuestionsAsked(data.questionsAsked);
      setStatus(data.status);

      // REPEAT_REQUEST is a verbatim replay, not new content — go straight
      // to SPEAKING with no artificial minimum delay. Everything else keeps
      // the MIN_THINKING_MS floor so a fast response doesn't feel jarring.
      if (data.turnType === 'REPEAT_REQUEST') {
        playAiMessage(data.response);
      } else {
        const elapsed = Date.now() - thinkingStartedAtRef.current;
        const delay = Math.max(0, MIN_THINKING_MS - elapsed);
        setTimeout(() => playAiMessage(data.response), delay);
      }
    } catch (err) {
      console.error('[AIInterviewBeta] Failed to send message:', err);
      addToast('Failed to reach the AI interviewer. Please try again.', 'error');
      setAvatarState('idle');
    }
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    const text = textAnswer;
    setTextAnswer('');
    if (avatarState === 'listening') {
      // Release the mic cleanly if they chose to type instead of finishing
      // the recording — ignore the returned blob, we're not using it.
      try { await audioRecorderRef.current.stop(); } catch { /* no-op */ }
      setMicStream(null);
    }
    setAvatarState('thinking');
    thinkingStartedAtRef.current = Date.now();
    await submitAnswer(text);
  };

  // Mirrors TechInterviewSetupPage's own check — resumeSource starts out
  // null, and upload-mode only becomes valid once a file is actually chosen.
  const hasResumeSource = (resumeSource?.mode === 'saved' && resumeSource.savedResumeId)
    || (resumeSource?.mode === 'upload' && resumeSource.file);

  // ── Setup → start ───────────────────────────────────────────────────
  const handleStart = async () => {
    if (!hasResumeSource) {
      addToast('Please choose a resume first — PDF or DOCX.', 'error');
      return;
    }
    setStarting(true);
    try {
      const { data: sessionRes } = await createSession();
      const newSessionId = sessionRes.session_id;

      await parseResume(resumeSource, newSessionId);

      const diffStr = difficulty === 'Mid Level' ? 'Mid' : difficulty;
      // Config goes straight to /start — no /generate-questions pre-call.
      // That endpoint exists to batch-generate a fixed question list up
      // front, which this engine must never do; it also used to seed a
      // throwaway "questions" entry that /start immediately overwrote.
      const { data: startRes } = await startAiEngine(newSessionId, {
        interviewType,
        difficulty: diffStr,
        language,
        jobDescription: jobDescription.trim() || undefined,
        durationMinutes,
      });
      if (startRes.success === false) {
        addToast(startRes.message || 'AI interviewer is unavailable right now.', 'error');
        setStarting(false);
        return;
      }

      setSessionId(newSessionId);
      setMessage(startRes.response);
      setTurnType(startRes.turnType);
      setQuestionsAsked(startRes.questionsAsked);
      setStatus(startRes.status);
      setStep('interview');
      playAiMessage(startRes.response);
    } catch (err) {
      console.error('[AIInterviewBeta] Failed to start:', err);
      addToast(err?.response?.data?.detail || err?.response?.data?.message || 'Failed to start interview.', 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleEndInterview = async () => {
    cancelSpeech();
    if (avatarState === 'listening') {
      try { await audioRecorderRef.current.stop(); } catch { /* no-op */ }
    }
    setStep('ending');
    try {
      await endAiEngine(sessionId);
      await generateReport(sessionId);
      navigate(`/report/${sessionId}`);
    } catch (err) {
      console.error('[AIInterviewBeta] Failed to end/generate report:', err);
      addToast('Failed to generate report.', 'error');
      setStep('interview');
    }
  };

  const inputHint = !micPermissionGrantedRef.current
    ? 'First answer needs a mic-permission click — after that, recording starts automatically between questions.'
    : 'Say "repeat that" to hear the question again, or ask "what do you mean?" for a clarification.';

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <Navbar />
      <ToastContainer />

      <main className={`max-w-6xl mx-auto px-6 ${step === 'interview' ? 'pt-24 pb-10' : 'pt-32 pb-24'}`}>
        {step === 'setup' && (
          <div className="w-full max-w-[1150px] mx-auto">
            {/* Background blobs, matching the Technical Interview Lab / other setup pages */}
            <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
              <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[120px]" />
              <div className="absolute top-1/2 -left-60 w-[400px] h-[400px] bg-indigo-200/15 rounded-full blur-[100px]" />
            </div>

            <div className="text-center max-w-3xl mx-auto mb-8">
              <span className="inline-flex items-center gap-2 bg-purple-100/70 text-[#6B46C1] px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest mb-6 border border-purple-200 shadow-sm">
                ⚡ AI Interview Engine · Beta
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#111] leading-[1.15] mb-4">
                Adaptive AI<br />
                <span className="bg-gradient-to-r from-[#6B46C1] via-[#8B5CF6] to-[#A855F7] bg-clip-text text-transparent">
                  Mock Interview
                </span>
              </h1>
              <p className="text-slate-500 text-base leading-relaxed max-w-xl mx-auto mb-2 font-medium">
                Reads your resume live, adapts every question to your actual answers, and decides when enough has been covered — no script, no fixed question count.
              </p>
            </div>

            {/* 3 Essential Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div className="bg-white border border-black/[0.06] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-7 w-7 shrink-0 rounded-full bg-[#6B46C1] text-white font-bold text-sm flex items-center justify-center">1</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Upload Resume <span className="text-red-500">*</span></h3>
                    <p className="text-xs text-slate-500 mt-0.5">Required — every question is built from your actual background, not a script</p>
                  </div>
                </div>
                <ResumeSourcePicker onChange={setResumeSource} />
              </div>

              <div className="bg-white border border-black/[0.06] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-7 w-7 shrink-0 rounded-full bg-[#6B46C1] text-white font-bold text-sm flex items-center justify-center">2</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Interview Type</h3>
                    <p className="text-xs text-slate-500 mt-0.5">What the interviewer should focus its questions on</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {INTERVIEW_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInterviewType(t)}
                      className={`text-left text-sm font-semibold px-3.5 py-2 rounded-xl border transition-colors ${
                        interviewType === t
                          ? 'border-[#6B46C1] bg-purple-50 text-[#6B46C1]'
                          : 'border-black/[0.06] bg-[#fafafa] text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 bg-white border border-black/[0.06] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-7 w-7 shrink-0 rounded-full bg-[#6B46C1] text-white font-bold text-sm flex items-center justify-center">3</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Job Description <span className="text-slate-300 normal-case font-medium">(optional)</span></h3>
                    <p className="text-xs text-slate-500 mt-0.5">Paste a JD and the engine will probe the gaps between it and your resume</p>
                  </div>
                </div>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here if you have one…"
                  rows={4}
                  className="w-full text-sm px-3.5 py-3 rounded-xl border border-black/10 bg-[#fafafa] resize-none focus:border-[#6B46C1] outline-none"
                />
              </div>
            </div>

            {/* Advanced Settings accordion */}
            <div className="bg-white border border-black/[0.06] rounded-2xl px-5 py-4 mb-6 shadow-sm">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between text-sm font-semibold text-slate-700"
              >
                <span>⚙️ Advanced Settings (Role, Difficulty, Language, Duration, Avatar)</span>
                <span className="text-xs text-slate-400 font-bold">{showAdvanced ? '▲ Hide' : '▼ Expand'}</span>
              </button>

              {showAdvanced && (
                <div className="mt-4 pt-4 border-t border-black/[0.06] space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Target Role <span className="text-slate-300 normal-case font-medium">(optional)</span></label>
                      <input
                        type="text"
                        value={roleTitle}
                        onChange={(e) => setRoleTitle(e.target.value)}
                        placeholder="e.g. Java Backend Developer"
                        className="w-full text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-[#fafafa] focus:border-[#6B46C1] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Difficulty</label>
                      <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-[#fafafa]">
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Language</label>
                      <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-[#fafafa]">
                        {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Interview Duration</label>
                      <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-[#fafafa]">
                        {DURATION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">AI Interviewer Avatar</label>
                    <div className="grid grid-cols-2 gap-3 max-w-xs">
                      {AVATAR_SETS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAvatarSet(opt.value)}
                          className={`text-sm font-bold py-2.5 rounded-xl border-2 transition-colors ${
                            avatarSet === opt.value
                              ? 'border-[#6B46C1] bg-purple-50 text-[#6B46C1]'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleStart}
                disabled={starting || !hasResumeSource}
                className="w-full max-w-md bg-[#6B46C1] hover:bg-[#5839a3] disabled:opacity-50 text-white font-bold py-3.5 rounded-full transition-colors shadow-[0_4px_20px_rgba(107,70,193,0.3)]"
              >
                {starting ? 'Starting…' : 'Start Interview (Beta) ✨'}
              </button>
            </div>
          </div>
        )}

        {step === 'interview' && (
          <div className="flex flex-col gap-3">
            <AIInterviewer
              avatarState={avatarState}
              message={message}
              turnType={turnType}
              micStream={micStream}
              mouthPulse={mouthPulse}
              avatarSet={avatarSet}
              roleTitle={roleTitle}
              interviewType={interviewType}
              difficulty={difficulty}
              elapsedSeconds={elapsedSeconds}
              questionsAsked={questionsAsked}
              isLastQuestion={isLastQuestion}
              onStartRecording={beginRecording}
              onStopRecording={stopRecordingAndSubmit}
              textAnswer={textAnswer}
              onTextAnswerChange={setTextAnswer}
              onTextSubmit={handleTextSubmit}
              inputHint={inputHint}
            />

            <button
              onClick={handleEndInterview}
              className="text-xs font-bold text-red-500 hover:text-red-600 self-center"
            >
              End Interview
            </button>
          </div>
        )}

        {step === 'ending' && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="h-10 w-10 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Generating your report…</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
