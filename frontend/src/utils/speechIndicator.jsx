/**
 * Speech Indicator - Shows when audio is being detected
 * Can be used in header or floating UI to indicate active listening
 */

import { useEffect, useRef, useState } from 'react';

function SpeechIndicator({ audioStream, label = 'Listening' }) {
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const audioContextRef = useRef(null);
  const rafRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!audioStream) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(audioStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      // Threshold for speech detection
      const SPEECH_THRESHOLD = 30;

      const detectSpeech = () => {
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);

          // Calculate average frequency
          const average = dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length;
          setVolume(Math.min(100, (average / 255) * 100));
          setIsSpeaking(average > SPEECH_THRESHOLD);
        }
        rafRef.current = requestAnimationFrame(detectSpeech);
      };

      rafRef.current = requestAnimationFrame(detectSpeech);
    } catch (error) {
      console.warn('Speech detection unavailable:', error);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [audioStream]);

  return (
    <div className="flex items-center gap-2">
      {/* Pulsing dot indicator */}
      <div className="relative">
        {isSpeaking ? (
          <>
            {/* Outer pulsing ring */}
            <div className="absolute inset-0 rounded-full bg-brand-400/30 animate-pulse" />
            {/* Inner solid dot */}
            <div className="w-3 h-3 rounded-full bg-brand-400" />
          </>
        ) : (
          <div className="w-3 h-3 rounded-full bg-slate-600" />
        )}
      </div>

      {/* Label and volume indicator */}
      <div className="flex items-center gap-1">
        <span className={`text-xs font-medium ${isSpeaking ? 'text-brand-400' : 'text-slate-500'}`}>
          {label}
        </span>

        {/* Mini volume bars */}
        <div className="flex items-end gap-0.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-1 rounded-sm transition-all duration-100 ${
                volume > i * 25
                  ? isSpeaking
                    ? 'h-3 bg-brand-400'
                    : 'h-3 bg-slate-500'
                  : 'h-1 bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default SpeechIndicator;
