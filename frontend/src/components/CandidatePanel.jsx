import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useInterview } from '../context/InterviewContext.jsx';
import { countFillers, totalFillerCount, highlightFillers, calcWPM } from '../utils/fillerWords.js';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition.js';
import { saveTurn, saveAudioTurn, sendMockChat } from '../utils/api.js';
import AudioRecorder from '../utils/audioRecorder.js';
import { useToast } from './Toast.jsx';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const WASM_URL  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const DETECT_MS = 500;
const SNAP_MS   = 5000;

// ─── Classify emotion from blendshape scores ──────────────────────────────────
function classifyEmotion(blendshapes) {
  const get = (name) => blendshapes.find((b) => b.categoryName === name)?.score ?? 0;
  const smileLeft  = get('mouthSmileLeft');
  const smileRight = get('mouthSmileRight');
  const browDown   = (get('browDownLeft') + get('browDownRight')) / 2;
  const eyeLookOut = (get('eyeLookOutLeft') + get('eyeLookOutRight')) / 2;
  const jawOpen    = get('jawOpen');
  const smile      = (smileLeft + smileRight) / 2;
  const eyeContact = 1 - eyeLookOut;
  const confidence = Math.min(1, (smile * 0.4 + eyeContact * 0.4 + (1 - browDown) * 0.2));
  let emotion = 'Neutral';
  if (smile > 0.4 && browDown < 0.2) emotion = 'Confident';
  else if (browDown > 0.35)           emotion = 'Nervous';
  // The breakdown must agree with `emotion` above — it used to be computed
  // from independent thresholds (e.g. `smile > 0.4` for confident regardless
  // of browDown), so a frame labeled "Nervous" could still show a nonzero
  // "confident" share, contradicting the headline label shown to the user
  // and skewing the backend's weighted confidenceScore (ReportGeneratorService
  // .computeEmotionScore sums these fields directly across all snapshots).
  return {
    emotion,
    confidence: parseFloat(confidence.toFixed(3)),
    scores: { smile, browDown, eyeContact, jawOpen },
    emotions: {
      confident: emotion === 'Confident' ? confidence : 0,
      nervous:   emotion === 'Nervous'   ? confidence : 0,
      neutral:   emotion === 'Neutral'   ? confidence : 0,
    },
  };
}

// ─── CandidatePanel ───────────────────────────────────────────────────────────
export default function CandidatePanel() {
  const ctx = useInterview();
  const { addToast, ToastContainer } = useToast();

  const audioRecorderRef = useRef(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedQuestions, setRecordedQuestions] = useState(new Set());

  useEffect(() => {
    audioRecorderRef.current = new AudioRecorder();
  }, []);

  useEffect(() => {
    let interval = null;
    if (isRecordingAudio) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecordingAudio]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStartRecording = async () => {
    if (!audioRecorderRef.current) return;
    const res = await audioRecorderRef.current.start();
    if (res.success) {
      setIsRecordingAudio(true);
    } else {
      addToast('Failed to access microphone: ' + res.error, 'error');
    }
  };

  const handleStopRecording = async () => {
    if (!audioRecorderRef.current || !isRecordingAudio) return;
    setIsRecordingAudio(false);
    setIsTranscribing(true);
    try {
      const { blob, duration } = await audioRecorderRef.current.stop();
      console.log(`[CandidatePanel] Audio recorded: ${blob.size} bytes, ${duration}ms`);

      const response = await saveAudioTurn(
        ctx.sessionId,
        ctx.sessionMetrics.currentQuestionIndex,
        blob
      );

      const transcribedText = response.data.transcript;
      console.log('[CandidatePanel] Transcribed answer:', transcribedText);

      // Save transcription to local transcript context
      ctx.updateTranscript(transcribedText);

      // Trigger dynamic next-question generation on backend. alreadySaved=true
      // because saveAudioTurn just above already created/updated this
      // question's candidate turn — without this, generateNextQuestion's own
      // saveTurn call below added a SECOND turn for the same question_index,
      // and the report builder merges duplicates by string-concatenating
      // them, so every avatar-mode answer ended up literally joined with
      // itself (inflating WPM, filler-word counts, and the score).
      await generateNextQuestion(transcribedText, true);

    } catch (error) {
      console.error('[CandidatePanel] Failed to save/transcribe audio:', error);
      addToast('Transcription failed. Please try again.', 'error');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Helper to generate the next question using mock-chat endpoint in mock mode
  const generateNextQuestion = async (answerText, alreadySaved = false) => {
    const qIdx = ctxRef.current.sessionMetrics.currentQuestionIndex;
    const isNoAvatar = !!ctxRef.current.interviewConfig?.noAvatar;

    if (!isNoAvatar) {
      // Static/Pre-planned mock mode: we already have 7 questions. No need to generate dynamic follow-up.
      ctx.setGeneratingQuestion(true);
      try {
        if (!alreadySaved) {
          const currentQText = ctxRef.current.questions[qIdx] || "";
          await saveTurn(ctxRef.current.sessionId, {
            role: 'candidate',
            question_index: qIdx,
            question_text: typeof currentQText === 'string' ? currentQText : (currentQText.text || ""),
            text: answerText,
            timestamp_ms: Date.now()
          });
        }
        setRecordedQuestions((prev) => {
          const next = new Set(prev);
          next.add(qIdx);
          return next;
        });
        resetForNextQuestion();
        questionStartTimeRef.current = Date.now();
        prevQuestionRef.current = qIdx + 1;
        ctxRef.current.setCurrentQuestion(qIdx + 1);
      } catch (err) {
        console.error('[CandidatePanel] Failed to save turn / advance question:', err);
      } finally {
        ctx.setGeneratingQuestion(false);
      }
      return;
    }

    // Focus Mode (noAvatar is true) -> Generate next question dynamically
    ctx.setGeneratingQuestion(true);
    try {
      console.log(`[CandidatePanel] Generating next question after Q${qIdx}. Answer:`, answerText);
      
      const response = await sendMockChat(ctxRef.current.sessionId, answerText);
      const nextQuestion = response.data.reply;
      console.log(`[CandidatePanel] Received next question/closing:`, nextQuestion);

      // Append the next question to the questions array in state
      const nextQuestionsList = [...ctxRef.current.questions, nextQuestion];
      ctxRef.current.setQuestions(nextQuestionsList);

      // Mark current index as recorded in our local set to bypass auto-save
      setRecordedQuestions((prev) => {
        const next = new Set(prev);
        next.add(qIdx);
        return next;
      });

      // Reset speech recognition for next question
      resetForNextQuestion();
      questionStartTimeRef.current = Date.now();
      prevQuestionRef.current = qIdx + 1;

      // Advance to the next question index
      ctxRef.current.setCurrentQuestion(qIdx + 1);
    } catch (err) {
      console.error('[CandidatePanel] Failed to generate next question:', err);
      addToast('Failed to get the next question from AI. Please try again.', 'error');
    } finally {
      ctx.setGeneratingQuestion(false);
    }
  };

  // Detect whether we are in live Tavus mode or mock mode.
  // In LIVE mode: Tavus iframe owns the microphone → Web SpeechRecognition WILL CONFLICT.
  //   We disable SpeechRecognition and instead read from ctx.sessionMetrics.transcript
  //   which is populated by TavusAvatar's postMessage handler when Tavus sends transcript events.
  // In MOCK mode: No Tavus iframe → Web SpeechRecognition works fine.
  const isLiveTavus = ctx.conversationUrl && !ctx.conversationUrl.includes('test-room') && !ctx.interviewConfig?.noAvatar;

  // ── Speech Recognition (mock mode only) ─────────────────────────────────
  const selectedLang = ctx.interviewConfig?.language || 'English';
  const speechLang = selectedLang === 'Hindi' ? 'hi-IN' : selectedLang === 'Hinglish' ? 'hi-IN' : 'en-US';
  const {
    finalText,
    interimText,
    isListening,
    error: speechError,
    startListening,
    stopListening,
    resetForNextQuestion,
    getCurrentAnswer,
  } = useSpeechRecognition(speechLang);

  // Keep a stable ref to ctx & speech state so async callbacks see latest
  const ctxRef          = useRef(ctx);
  const finalTextRef    = useRef(finalText);
  const interimTextRef  = useRef(interimText);
  useEffect(() => { ctxRef.current = ctx; },          [ctx]);
  useEffect(() => { finalTextRef.current = finalText; }, [finalText]);
  useEffect(() => { interimTextRef.current = interimText; }, [interimText]);

  // ── Listen for triggers to submit text answer (Done Answering → Next Question) ──
  useEffect(() => {
    if (isLiveTavus) return;
    if (ctx.triggerSubmit) {
      ctx.setTriggerSubmit(false);

      const hookFinal   = getCurrentAnswer();
      const refFinal    = finalTextRef.current;
      const refInterim  = interimTextRef.current;
      const bestFinal   = hookFinal.length >= refFinal.length ? hookFinal : refFinal;
      const spokenAnswer = (bestFinal + (refInterim ? ' ' + refInterim : '')).trim();

      const captured = spokenAnswer || 'No answer provided.';
      ctx.updateTranscript(captured);

      generateNextQuestion(captured);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.triggerSubmit, isLiveTavus]);

  // ── Start speech recognition ONLY in mock mode ────────────────────────
  // In live Tavus mode: Tavus owns the mic. Starting SpeechRecognition here
  // causes the 'aborted' error spam because the browser can't give us the mic.
  useEffect(() => {
    if (isLiveTavus) {
      console.log('[CandidatePanel] Live Tavus mode — skipping Web SpeechRecognition (Tavus owns mic)');
      return;
    }
    console.log('[CandidatePanel] Mock mode — starting Web SpeechRecognition');
    startListening();
    return () => stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveTavus]);

  // ── Per-question timing ──────────────────────────────────────────────────
  const questionStartTimeRef = useRef(Date.now());
  const prevQuestionRef      = useRef(ctx.sessionMetrics.currentQuestionIndex);

  // ── On completion: flush last answer (mock mode only) ────────────────────
  useEffect(() => {
    const { status } = ctx.sessionMetrics;

    if (status === 'completed') {
      // Stop speech recognition when interview ends (mock mode only — it's a no-op in live mode)
      stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.sessionMetrics.status, recordedQuestions]);

  // ── Filler / WPM (live, per question) — mock mode only ───────────────────
  const wpmTimerRef = useRef(Date.now());
  useEffect(() => { wpmTimerRef.current = Date.now(); }, [ctx.sessionMetrics.currentQuestionIndex]);

  useEffect(() => {
    if (!finalText || isLiveTavus) return;
    const counts = countFillers(finalText);
    ctx.updateFillerCounts(counts, totalFillerCount(counts));
    const elapsedSec = (Date.now() - wpmTimerRef.current) / 1000;
    ctx.updateWPM(calcWPM(finalText, elapsedSec));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalText]);

  // ── MediaPipe webcam ──────────────────────────────────────────────────────
  const videoRef      = useRef(null);
  const landmarkerRef = useRef(null);
  const lastDetectRef = useRef(0);
  const lastSnapRef   = useRef(0);
  const animFrameRef  = useRef(null);
  const [camError, setCamError] = useState('');
  const [mpReady,  setMpReady]  = useState(false);

  useEffect(() => {
    let activeStream;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('No camera API');
        // In live Tavus mode, Tavus iframe already has the camera.
        // We still request video-only here for the emotion detection feed.
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try { await videoRef.current.play(); } catch (e) { if (e.name !== 'AbortError') throw e; }
        }
      } catch (e) {
        const msg =
          e.name === 'NotFoundError'    ? 'No webcam found.' :
          e.name === 'NotReadableError' ? 'Webcam is in use by Tavus (emotion tracking unavailable).' :
          e.name === 'NotAllowedError'  ? 'Camera permission denied.' :
          `Camera Error: ${e.message}`;
        setCamError(msg);
        console.warn('[CandidatePanel] Camera error (non-critical):', msg);
      }
    })();
    return () => { if (activeStream) activeStream.getTracks().forEach((t) => t.stop()); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
        });
        setMpReady(true);
      } catch {
        try {
          const vision = await FilesetResolver.forVisionTasks(WASM_URL);
          landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
          });
          setMpReady(true);
        } catch (e2) { console.error('MediaPipe failed:', e2); }
      }
    })();
    return () => landmarkerRef.current?.close?.();
  }, []);

  const runDetection = useCallback(() => {
    const video = videoRef.current;
    const lm    = landmarkerRef.current;
    const now   = performance.now();
    if (lm && video?.readyState === 4 && video.videoWidth > 0 && now - lastDetectRef.current >= DETECT_MS) {
      lastDetectRef.current = now;
      const result = lm.detectForVideo(video, now);
      const blendshapes = result?.faceBlendshapes?.[0]?.categories ?? [];
      if (blendshapes.length > 0) {
        const data = classifyEmotion(blendshapes);
        ctxRef.current.setCurrentEmotion(data.emotion, data.confidence);
        if (now - lastSnapRef.current >= SNAP_MS) {
          lastSnapRef.current = now;
          ctxRef.current.pushEmotionSnapshot({
            timestamp_ms:     Math.round(now),
            emotions:         data.emotions,
            gaze:             data.scores.eyeContact > 0.6 ? 'center' : 'away',
            confidence_score: data.confidence,
          });
        }
      }
    }
    animFrameRef.current = requestAnimationFrame(runDetection);
  }, []);

  useEffect(() => {
    if (!mpReady) return;
    animFrameRef.current = requestAnimationFrame(runDetection);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [mpReady, runDetection]);

  // ── What text to show in Live Transcript area ─────────────────────────────
  // Live Tavus: use ctx.sessionMetrics.transcript (fed by TavusAvatar postMessage handler)
  // Mock: use finalText from Web SpeechRecognition
  const displayTranscript = isLiveTavus
    ? (ctx.sessionMetrics?.transcript || '')
    : finalText;

  // Filter out '[AI]' prefixed lines from display (those are interviewer turns)
  const candidateTranscript = displayTranscript
    .split(/\[AI\][^\n]*/g)
    .join('')
    .trim();

  const highlightedParts = candidateTranscript ? highlightFillers(candidateTranscript) : [];
  const { currentEmotion, wpm, currentQuestionIndex } = ctx.sessionMetrics;
  const { questions } = ctx;

  return (
    <div className="flex flex-col gap-6 h-full">
      <ToastContainer />

      {/* ── Webcam feed ─────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden border border-black/[0.03] bg-white shadow-lg aspect-video w-full flex-shrink-0">
        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="text-3xl">📷</span>
            <p className="text-amber-600 text-xs font-bold">{camError}</p>
            <p className="text-slate-400 text-[10px]">Emotion tracking unavailable, interview continues normally</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}

        {/* Live metrics overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/20 text-white ${
              currentEmotion === 'Confident' ? 'bg-purple-500/80' :
              currentEmotion === 'Nervous'   ? 'bg-amber-500/80'  : 'bg-slate-500/80'
            }`}>
              {currentEmotion === 'Confident' ? '😊' : currentEmotion === 'Nervous' ? '😟' : '😐'}
              {' '}{currentEmotion}
            </span>
            {/* Mic status: show Tavus mode or local SpeechRecognition mode */}
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/20 text-white ${
              isLiveTavus ? 'bg-purple-500/80' : isListening ? 'bg-green-500/80' : 'bg-red-500/80'
            }`}>
              {isLiveTavus ? '🎙 Tavus' : isListening ? '🎙 Live' : '🔇 Off'}
            </span>
          </div>
          <span className="bg-black/40 backdrop-blur-md text-white border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            ~{wpm} WPM
          </span>
        </div>
      </div>

      {/* ── Audio Answer Recording Control ── */}
      {currentQuestionIndex < questions.length && (
        <div className="premium-card p-6 bg-gradient-to-br from-[#6B46C1]/5 to-purple-500/[0.02] border border-[#6B46C1]/10 rounded-3xl shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-purple-600 uppercase tracking-widest">
              🎤 Audio Answer Recorder
            </span>
            <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-black">
              Q{currentQuestionIndex + 1} of {questions.length}
            </span>
          </div>

          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-black/[0.03] shadow-inner">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Question</p>
            <p className="text-sm font-bold text-slate-900 leading-relaxed">
              {typeof questions[currentQuestionIndex] === 'string'
                ? questions[currentQuestionIndex]
                : (questions[currentQuestionIndex]?.text ?? 'Loading question...')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              {isRecordingAudio ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="font-mono text-sm font-black text-red-500 animate-pulse">
                    Recording: {formatTime(recordingSeconds)}
                  </span>
                </>
              ) : isTranscribing ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold text-purple-600 uppercase tracking-wider animate-pulse">
                    Transcribing with Whisper...
                  </span>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Ready to record your answer
                </span>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {!isRecordingAudio && !isTranscribing && !ctx.sessionMetrics?.isGeneratingQuestion ? (
                <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
                  <button
                    onClick={handleStartRecording}
                    className="w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    <span>🎙️</span> Start Recording
                  </button>
                  <button
                    onClick={() => ctx.setTriggerSubmit(true)}
                    className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    Done Answering →
                  </button>
                </div>
              ) : isRecordingAudio ? (
                <button
                  onClick={handleStopRecording}
                  className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  <span>⏹️</span> Stop &amp; Submit
                </button>
              ) : (
                <button
                  disabled
                  className="w-full sm:w-auto px-6 py-3 bg-slate-100 text-slate-400 font-bold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <div className="h-3 w-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  {isTranscribing ? 'Transcribing...' : 'AI is thinking...'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Live Transcript ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 premium-card p-6">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <span className="step-label">Live Transcript</span>
          <span className="text-[10px] text-purple-500 font-bold uppercase tracking-[0.2em]">
            {currentQuestionIndex < questions.length
              ? `Question ${currentQuestionIndex + 1} of ${questions.length}`
              : 'Interview Complete'}
          </span>
        </div>

        {/* Mode notice for live Tavus */}
        {isLiveTavus && (
          <div className="mb-3 px-3 py-2 bg-purple-50 border border-purple-100 rounded-xl text-purple-600 text-[10px] font-semibold flex items-center gap-2">
            <span>🤖</span>
            <span>Transcript captured by Tavus AI — your answers are being recorded automatically</span>
          </div>
        )}

        {/* Speech error notice (mock mode only) */}
        {!isLiveTavus && speechError && (
          <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold">
            ⚠️ {speechError}
          </div>
        )}

        {/* Transcript display */}
        <div className="flex-1 overflow-y-auto text-sm font-medium text-slate-600 leading-relaxed custom-scrollbar p-4 bg-slate-50/50 border border-black/[0.03] rounded-2xl">
          {highlightedParts.length === 0 && !interimText ? (
            <span className="text-slate-300 italic font-normal">
              {isLiveTavus
                ? '🤖 Your speech is being captured by Tavus — it will appear here as the interview progresses…'
                : '🎙️ Speak your answer — transcript will appear here in real-time...'}
            </span>
          ) : (
            <>
              {/* Confirmed final text with filler word highlights */}
              {highlightedParts.map((part, i) =>
                typeof part === 'string' ? (
                  <span key={i}>{part}</span>
                ) : (
                  <mark key={part.key} className="bg-amber-100 text-amber-700 rounded px-0.5 font-bold">
                    {part.filler}
                  </mark>
                )
              )}
              {/* Interim text (mock mode only) */}
              {!isLiveTavus && interimText && (
                <span className="text-purple-400/60 italic ml-1">{interimText}</span>
              )}
            </>
          )}
        </div>

        {/* Subtle hint */}
        <p className="mt-3 text-center text-slate-300 text-[10px] font-bold uppercase tracking-[0.2em] flex-shrink-0">
          {isLiveTavus
            ? '✦ Tavus AI captures your answers automatically ✦'
            : '✦ AI interviewer advances questions automatically ✦'}
        </p>
      </div>
    </div>
  );
}
