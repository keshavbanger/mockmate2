import { useEffect, useRef, useState } from 'react';

const BAR_COUNT = 9;
const COMPACT_BAR_COUNT = 5;

// Dual source, per spec: LISTENING reads real amplitude off the candidate's
// own mic stream via AnalyserNode; SPEAKING has no real audio to analyze
// (window.speechSynthesis exposes no AnalyserNode-compatible output — there
// is no standard API to route synthesized speech into Web Audio), so it
// runs a synthetic envelope pulsed by `pulseSignal` (bumped once per TTS
// word-boundary event) instead, keyed to word timing rather than amplitude.
//
// compact: smaller bar count/size, for the status overlay on VideoAvatarFace
// rather than the full-size bar under the message bubble.
export default function AudioVisualizer({ mode, stream, pulseSignal = 0, compact = false }) {
  const barCount = compact ? COMPACT_BAR_COUNT : BAR_COUNT;
  const [levels, setLevels] = useState(() => Array(barCount).fill(0.08));
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const lastPulseRef = useRef(pulseSignal);

  // ── Mic mode: real amplitude ──────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'mic' || !stream) return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioCtx = new AudioContextCtor();
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const step = Math.floor(data.length / barCount) || 1;
      const next = Array.from({ length: barCount }, (_, i) => {
        const v = data[i * step] ?? 0;
        return Math.max(0.08, v / 255);
      });
      setLevels(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      audioCtx.close().catch(() => {});
    };
  }, [mode, stream, barCount]);

  // ── Boundary mode: synthetic, word-timed envelope ─────────────────────
  useEffect(() => {
    if (mode !== 'boundary') return;
    if (pulseSignal === lastPulseRef.current) return;
    lastPulseRef.current = pulseSignal;

    const peak = Array.from({ length: barCount }, () => 0.35 + Math.random() * 0.65);
    setLevels(peak);

    const start = performance.now();
    const duration = 260;
    const decay = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // Sine-based decay envelope so it reads as one smooth pulse, not a snap.
      const factor = Math.cos((t * Math.PI) / 2);
      setLevels(peak.map((v) => Math.max(0.08, v * factor)));
      if (t < 1) rafRef.current = requestAnimationFrame(decay);
    };
    rafRef.current = requestAnimationFrame(decay);

    return () => cancelAnimationFrame(rafRef.current);
  }, [mode, pulseSignal, barCount]);

  // ── Idle: settle to a quiet baseline ───────────────────────────────────
  useEffect(() => {
    if (mode === 'mic' || mode === 'boundary') return;
    setLevels(Array(barCount).fill(0.08));
  }, [mode, barCount]);

  return (
    <div className={`flex items-end justify-center gap-1.5 ${compact ? 'h-4' : 'h-10'}`}>
      {levels.map((v, i) => (
        <div
          key={i}
          className={`rounded-full bg-gradient-to-t from-[#6B46C1] to-violet-400 ${compact ? 'w-1' : 'w-1.5'}`}
          style={{
            height: `${Math.round(v * 100)}%`,
            transition: mode === 'mic' ? 'height 60ms linear' : 'height 40ms linear',
            opacity: mode === 'idle' ? 0.3 : 1,
          }}
        />
      ))}
    </div>
  );
}
