import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useInterview } from '../context/InterviewContext.jsx';
import { countFillers, totalFillerCount, highlightFillers, calcWPM } from '../utils/fillerWords.js';
import VideoRecorder from '../utils/videoRecorder.js';
import { AudioVisualizer } from '../utils/audioVisualizer.jsx';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const WASM_URL   = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const DETECT_MS  = 500;    // run detection every 500 ms
const SNAP_MS    = 5000;   // push emotion snapshot every 5 s

// ─── Classify emotion from blendshape scores ──────────────────────────────────
function classifyEmotion(blendshapes) {
  const get = (name) =>
    blendshapes.find((b) => b.categoryName === name)?.score ?? 0;

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

  return {
    emotion,
    confidence: parseFloat(confidence.toFixed(3)),
    scores: { smile, browDown, eyeContact, jawOpen },
    emotions: {
      confident: smile > 0.4 ? smile : 0,
      nervous:   browDown,
      neutral:   emotion === 'Neutral' ? 1 - Math.max(smile, browDown) : 0,
    },
  };
}

// ─── Emotion badge colors ─────────────────────────────────────────────────────
const EMOTION_STYLE = {
  Confident: 'badge-green',
  Nervous:   'badge-amber',
  Neutral:   'badge-blue',
};

// ─── CandidatePanel ───────────────────────────────────────────────────────────
export default function CandidatePanel({ audioStream }) {
  const ctx = useInterview();
  const videoRef    = useRef(null);
  const landmarkerRef = useRef(null);
  const lastDetectRef = useRef(0);
  const lastSnapRef   = useRef(0);
  const lastWpmRef    = useRef(0);       // track transcript length for WPM
  const animFrameRef  = useRef(null);
  const transcriptRef = useRef('');      // local mirror for WPM calc
  const startTimeRef  = useRef(Date.now());
  const recorderRef   = useRef(null);    // video recorder instance

  const [camError,    setCamError]    = useState('');
  const [mpReady,     setMpReady]     = useState(false);
  const [currentData, setCurrentData] = useState({ emotion: 'Neutral', confidence: 0, scores: {} });
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // ── 1. Start webcam ────────────────────────────────────────────────────────
  useEffect(() => {
    let activeStream;
    (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Your browser does not support webcam access or is in an insecure context (need HTTPS or localhost).');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playErr) {
            // Ignore AbortError if the video element gets unmounted quickly
            if (playErr.name !== 'AbortError') throw playErr;
          }
        }
      } catch (e) {
        let msg = 'Camera access denied. Please enable webcam permissions.';
        if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
          msg = 'No webcam found. Please connect a camera.';
        } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
          msg = 'Webcam is already in use by another application.';
        } else if (e.name === 'OverconstrainedError') {
          msg = 'Camera does not meet requirements.';
        } else if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          msg = 'Camera access denied. Please enable webcam permissions.';
        } else {
          msg = `Camera Error: ${e.name}: ${e.message}`;
        }
        setCamError(msg);
        console.error('getUserMedia error:', e);
      }
    })();
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── 2. Load MediaPipe FaceLandmarker ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode:         'VIDEO',
          numFaces:            1,
          outputFaceBlendshapes: true,
        });
        setMpReady(true);
      } catch (e) {
        console.warn('MediaPipe GPU failed, retrying CPU:', e);
        try {
          const vision = await FilesetResolver.forVisionTasks(WASM_URL);
          landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode:         'VIDEO',
            numFaces:            1,
            outputFaceBlendshapes: true,
          });
          setMpReady(true);
        } catch (e2) {
          console.error('MediaPipe failed to load:', e2);
        }
      }
    })();
    return () => landmarkerRef.current?.close?.();
  }, []);

  // ── 3. Detection loop ──────────────────────────────────────────────────────
  const runDetection = useCallback(() => {
    const video    = videoRef.current;
    const lm       = landmarkerRef.current;
    const now      = performance.now();

    if (
      lm &&
      video?.readyState === 4 &&
      video.videoWidth > 0 &&
      now - lastDetectRef.current >= DETECT_MS
    ) {
      lastDetectRef.current = now;
      const result = lm.detectForVideo(video, now);
      const blendshapes = result?.faceBlendshapes?.[0]?.categories ?? [];

      if (blendshapes.length > 0) {
        const data = classifyEmotion(blendshapes);
        setCurrentData(data);
        ctx.setCurrentEmotion(data.emotion, data.confidence);

        // Push snapshot every SNAP_MS
        if (now - lastSnapRef.current >= SNAP_MS) {
          lastSnapRef.current = now;
          const snap = {
            timestamp_ms:    Math.round(now),
            emotions:        data.emotions,
            gaze:            data.scores.eyeContact > 0.6 ? 'center' : 'away',
            confidence_score: data.confidence,
          };
          ctx.pushEmotionSnapshot(snap);
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(runDetection);
  }, [ctx]);

  useEffect(() => {
    if (!mpReady) return;
    animFrameRef.current = requestAnimationFrame(runDetection);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [mpReady, runDetection]);

  // ── 4. Video recording lifecycle ───────────────────────────────────────────
  const uploadRecordingToServer = useCallback(async (blob, sessionId) => {
    try {
      setUploadingVideo(true);
      const formData = new FormData();
      formData.append('file', blob, `interview-${sessionId}.webm`);
      formData.append('session_id', sessionId);
      formData.append('timestamp_ms', new Date().getTime());

      const response = await fetch('/api/upload-recording', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const data = await response.json();
      console.log('Recording uploaded successfully:', data);
      ctx.setRecordingUploaded(data.file_path);
      return data;
    } catch (error) {
      console.error('Failed to upload recording:', error);
      // Don't break the interview end flow, just log the error
    } finally {
      setUploadingVideo(false);
    }
  }, [ctx]);

  useEffect(() => {
    const initRecorder = async () => {
      if (!recorderRef.current) {
        recorderRef.current = new VideoRecorder();
      }

      const status = ctx.sessionMetrics?.status;

      if (status === 'active' && !recorderRef.current.getIsRecording()) {
        // Start recording when interview becomes active
        const result = await recorderRef.current.start();
        if (result.success) {
          console.log('[VideoRecorder] Started recording');
        } else {
          console.warn('[VideoRecorder] Failed to start:', result.error);
        }
      } else if (status === 'completed' && recorderRef.current.getIsRecording()) {
        // Stop recording when interview completes
        try {
          const { blob, duration, mimeType } = await recorderRef.current.stop();
          console.log(
            `[VideoRecorder] Stopped recording. Duration: ${(duration / 1000).toFixed(1)}s, Size: ${(blob.size / 1024 / 1024).toFixed(1)}MB`
          );

          // Upload to server
          await uploadRecordingToServer(blob, ctx.sessionId);
        } catch (error) {
          console.error('[VideoRecorder] Error stopping recorder:', error);
        }
      }
    };

    initRecorder();
  }, [ctx.sessionMetrics?.status, ctx.sessionId, uploadRecordingToServer]);

  // ── 5. Sync transcript from context + filler detection ────────────────────
  useEffect(() => {
    const text = ctx.sessionMetrics.transcript;
    if (!text || text === transcriptRef.current) return;
    transcriptRef.current = text;

    // Filler counts
    const counts = countFillers(text);
    const total  = totalFillerCount(counts);
    ctx.updateFillerCounts(counts, total);

    // WPM
    const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
    const wpm = calcWPM(text, elapsedSec);
    ctx.updateWPM(wpm);
  }, [ctx.sessionMetrics.transcript]); // eslint-disable-line

  // ── 6. Manual Submission Logic ─────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [lastTranscriptLen, setLastTranscriptLen] = useState(0);

  const handleSubmitAnswer = async () => {
    const { sessionId, questions, sessionMetrics, setCurrentQuestion, pushTurn, updateTranscript, setInterimTranscript } = ctx;
    const { currentQuestionIndex, transcript, interimTranscript } = sessionMetrics;

    if (currentQuestionIndex >= questions.length) return;

    setSubmitting(true);
    try {
      // If there's any remaining active interim transcript, finalize it first!
      let finalTranscript = transcript;
      if (interimTranscript && interimTranscript.trim().length > 0) {
        updateTranscript(interimTranscript.trim());
        setInterimTranscript('');
        finalTranscript = transcript + ' ' + interimTranscript.trim();
      }

      // Extract the text spoken for THIS question
      const currentAnswer = finalTranscript.slice(lastTranscriptLen).trim();
      
      const turnData = {
        role: 'candidate',
        text: currentAnswer || '(No speech detected)',
        question_index: currentQuestionIndex,
        timestamp_ms: Date.now(),
      };

      // 1. Save to backend
      const { saveTurn } = await import('../utils/api.js');
      await saveTurn(sessionId, turnData);

      // 2. Update local context
      pushTurn(turnData);
      setLastTranscriptLen(finalTranscript.length);
      
      // 3. Move to next
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestion(currentQuestionIndex + 1);
      } else {
        // Last question finished
        setCurrentQuestion(questions.length); // Mark as all done
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── 7. Render ──────────────────────────────────────────────────────────────
  const { currentEmotion, totalFillers, wpm, transcript, interimTranscript, revealedQuestionIndex, currentQuestionIndex } = ctx.sessionMetrics;
  const { questions } = ctx;

  const currentAnswerText = transcript ? transcript.slice(lastTranscriptLen) : '';
  const highlightedParts = currentAnswerText
    ? highlightFillers(currentAnswerText)
    : [];

  return (
    <div className="flex flex-col gap-6 h-full">

      {/* ── Webcam feed ─────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden border border-black/[0.03] bg-white shadow-lg
                      aspect-video w-full flex-shrink-0">
        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="text-3xl">📷</span>
            <p className="text-amber-600 text-xs font-bold">{camError}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}

        {/* Live metrics overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t
                        from-black/50 to-transparent flex items-end justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/20 text-white ${
              currentEmotion === 'Confident' ? 'bg-purple-500/80' : 
              currentEmotion === 'Nervous' ? 'bg-amber-500/80' : 'bg-slate-500/80'
            }`}>
              {currentEmotion === 'Confident' ? '😊' : currentEmotion === 'Nervous' ? '😟' : '😐'}
              {' '}{currentEmotion}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-black/40 backdrop-blur-md text-white border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              ~{wpm} WPM
            </span>
          </div>
        </div>
      </div>

      {/* ── Live Transcript & Spoken Answer ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 premium-card p-6">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <span className="step-label">Live Transcript / Your Spoken Answer</span>
          <span className="text-[10px] text-purple-500 font-bold uppercase tracking-[0.2em]">
            {currentQuestionIndex < questions.length 
              ? `Question ${currentQuestionIndex + 1} of ${questions.length}`
              : 'DONE'}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto text-sm font-medium text-slate-500 leading-relaxed custom-scrollbar min-h-[120px] p-4 bg-slate-50/50 border border-black/[0.03] rounded-2xl mb-6">
          {highlightedParts.length === 0 && !interimTranscript ? (
            <span className="text-slate-300 italic font-normal">
              🎙️ Speak your answer... (Waiting for speech input)
            </span>
          ) : (
            <>
              {highlightedParts.map((part, i) =>
                typeof part === 'string' ? (
                  <span key={i}>{part}</span>
                ) : (
                  <mark key={part.key} className="bg-amber-100 text-amber-700 rounded px-1 font-bold">{part.filler}</mark>
                )
              )}
              {interimTranscript && (
                <span className="text-purple-500/80 italic ml-1 animate-pulse">
                  {interimTranscript}
                </span>
              )}
            </>
          )}
        </div>

        {currentQuestionIndex < questions.length && (
          <button
            onClick={handleSubmitAnswer}
            disabled={submitting}
            className="w-full btn-black flex items-center justify-center gap-2 group text-xs py-3.5 flex-shrink-0"
          >
            {submitting ? (
              <>
                <Spinner />
                <span>Submitting Answer...</span>
              </>
            ) : (
              <>
                <span>Submit Answer &amp; Next</span>
                <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>

    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
