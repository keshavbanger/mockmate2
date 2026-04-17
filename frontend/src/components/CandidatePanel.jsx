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

  // ── 6. Render ──────────────────────────────────────────────────────────────
  const { currentEmotion, totalFillers, wpm, transcript } = ctx.sessionMetrics;

  const highlightedParts = transcript
    ? highlightFillers(transcript.slice(-600))  // last 600 chars
    : [];

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Webcam feed ─────────────────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden border border-white/5 bg-surface-800
                      aspect-video w-full flex-shrink-0">
        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="text-3xl">📷</span>
            <p className="text-amber-400 text-sm font-medium">{camError}</p>
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

        {/* MP status overlay */}
        {!mpReady && !camError && (
          <div className="absolute top-3 right-3">
            <span className="badge bg-surface-800/90 text-slate-400 border border-white/10 text-[10px] gap-1">
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading AI
            </span>
          </div>
        )}

        {/* Live metrics overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t
                        from-black/70 to-transparent flex items-end justify-between">
          <span className={`badge text-[11px] ${EMOTION_STYLE[currentEmotion] || 'badge-blue'}`}>
            {currentEmotion === 'Confident' ? '😊' : currentEmotion === 'Nervous' ? '😟' : '😐'}
            {' '}{currentEmotion}
          </span>
          <div className="flex items-center gap-2">
            <span className="badge bg-black/50 text-slate-300 border border-white/10 text-[10px]">
              Fillers: {totalFillers}
            </span>
            <span className="badge bg-black/50 text-slate-300 border border-white/10 text-[10px]">
              ~{wpm} WPM
            </span>
          </div>
        </div>
      </div>

      {/* ── Confidence bar ───────────────────────────────────────────────── */}
      <div className="px-1">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>Confidence</span>
          <span>{Math.round(currentData.confidence * 100)}%</span>
        </div>
        <div className="h-1.5 bg-surface-500 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${currentData.confidence * 100}%`,
              background: currentData.confidence > 0.6
                ? '#10b981'
                : currentData.confidence > 0.35
                  ? '#f59e0b'
                  : '#6366f1',
            }}
          />
        </div>
      </div>

      {/* ── Audio Input Visualizer ───────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="metric-label text-sm">🎤 Listening</p>
          <span className="text-[10px] text-slate-500">Real-time audio input</span>
        </div>
        <div className="h-16 overflow-hidden rounded-lg border border-white/5">
          {audioStream ? (
            <AudioVisualizer audioStream={audioStream} isActive={true} />
          ) : (
            <div className="w-full h-full bg-surface-700 rounded-lg flex items-center justify-center">
              <span className="text-slate-500 text-sm">🎤 Requesting microphone access...</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Live transcript ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        <p className="metric-label mb-2">Live Transcript</p>
        <div className="flex-1 bg-surface-800/60 rounded-xl border border-white/5 p-4
                        overflow-y-auto text-sm text-slate-400 leading-relaxed max-h-48">
          {highlightedParts.length === 0 ? (
            <span className="text-slate-600 italic">
              Your speech will appear here once the interview starts…
            </span>
          ) : (
            <>
              {highlightedParts.map((part, i) =>
                typeof part === 'string' ? (
                  <span key={i}>{part}</span>
                ) : (
                  <mark key={part.key} className="filler-highlight">{part.filler}</mark>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Filler word breakdown ────────────────────────────────────────── */}
      {totalFillers > 0 && (
        <div className="bg-surface-800/40 rounded-xl border border-white/5 p-3">
          <p className="metric-label mb-2">Filler Words Detected</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ctx.sessionMetrics.fillerCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([word, count]) => (
                <span key={word}
                  className="badge bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                  "{word}" ×{count}
                </span>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
