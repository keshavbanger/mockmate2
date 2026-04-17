/**
 * Audio Visualizer - Shows real-time audio input visualization
 * Displays animated bars that react to microphone input
 */

import { useEffect, useRef, useState } from 'react';

export function AudioVisualizer({ audioStream, isActive = true }) {
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize audio analysis
  useEffect(() => {
    if (!audioStream || !isActive) return;

    try {
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(audioStream);

      // Create analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(analyser);

      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      setIsReady(true);
    } catch (error) {
      console.warn('Audio visualization unavailable:', error);
    }

    return () => {
      // Don't disconnect on unmount - keep audio flowing
    };
  }, [audioStream, isActive]);

  // Animation loop
  useEffect(() => {
    if (!isReady || !canvasRef.current || !analyserRef.current || !isActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      // Get frequency data
      analyser.getByteFrequencyData(dataArray);

      // Clear canvas with background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw bars
      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        // Color gradient based on height
        if (barHeight < 30) {
          ctx.fillStyle = '#6366f1'; // Indigo when quiet
        } else if (barHeight < 80) {
          ctx.fillStyle = '#8b5cf6'; // Purple when speaking
        } else {
          ctx.fillStyle = '#ec4899'; // Pink when loud
        }

        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        // Add gap between bars
        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isReady, isActive]);

  if (!isReady) {
    return (
      <div className="w-full h-full bg-surface-700 rounded-lg flex items-center justify-center">
        <span className="text-slate-500 text-sm">🎤 Listening...</span>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-lg bg-surface-700"
      style={{ minHeight: '60px' }}
    />
  );
}

/**
 * Hook to get microphone stream for audio analysis
 * Separate from camera stream to avoid conflicts
 */
export function useAudioStream() {
  const [audioStream, setAudioStream] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream;

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } })
      .then((s) => {
        stream = s;
        setAudioStream(s);
      })
      .catch((err) => {
        console.warn('Could not access microphone for visualization:', err);
        setError(err.message);
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return { audioStream, error };
}
