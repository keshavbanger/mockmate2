import { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';

// SVG/2D avatar — the original AvatarProvider implementation. Superseded as
// the active renderer by VideoAvatarFace.jsx (see AvatarStage.jsx), kept
// here rather than deleted so the provider stays swappable per the design
// brief ("AvatarFace isolated enough that swapping later doesn't touch the
// state machine contract") — this is that swap already having happened
// once, with this file as the fallback/alternate provider.
//
// state: 'idle' | 'listening' | 'thinking' | 'speaking'
export default function AvatarFace({ state, mouthPulse = 0 }) {
  const mouthControls = useAnimation();
  const blinkControls = useAnimation();
  const lastPulseRef = useRef(mouthPulse);

  useEffect(() => {
    if (state !== 'idle' && state !== 'listening') return;
    let cancelled = false;
    const blinkLoop = async () => {
      while (!cancelled) {
        const delay = 2200 + Math.random() * 2600;
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        await blinkControls.start({ scaleY: 0.08, transition: { duration: 0.08 } });
        if (cancelled) return;
        await blinkControls.start({ scaleY: 1, transition: { duration: 0.12 } });
      }
    };
    blinkLoop();
    return () => { cancelled = true; };
  }, [state, blinkControls]);

  useEffect(() => {
    if (mouthPulse === lastPulseRef.current) return;
    lastPulseRef.current = mouthPulse;
    if (state !== 'speaking') return;
    mouthControls.start({
      scaleY: [1, 1.9, 0.7, 1],
      transition: { duration: 0.2, times: [0, 0.35, 0.7, 1] },
    });
  }, [mouthPulse, state, mouthControls]);

  useEffect(() => {
    if (state !== 'speaking') {
      mouthControls.start({ scaleY: 1, transition: { duration: 0.15 } });
    }
  }, [state, mouthControls]);

  const headAnimate =
    state === 'thinking'
      ? { rotate: [0, -2.5, 0, 2.5, 0], y: 0 }
      : state === 'listening'
      ? { rotate: 0, y: [0, -2, 0] }
      : state === 'speaking'
      ? { rotate: 0, y: [0, -1, 0] }
      : { rotate: 0, y: [0, -3, 0] };

  const headTransition =
    state === 'thinking'
      ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
      : { duration: state === 'idle' ? 3.4 : 1.8, repeat: Infinity, ease: 'easeInOut' };

  const eyeAnimate =
    state === 'thinking' ? { x: 3, y: -1 } : { x: 0, y: 0 };

  const glow =
    state === 'listening' ? 'rgba(107,70,193,0.35)' :
    state === 'speaking' ? 'rgba(107,70,193,0.5)' :
    state === 'thinking' ? 'rgba(107,70,193,0.2)' : 'rgba(107,70,193,0)';

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        animate={{ backgroundColor: glow, scale: state === 'speaking' ? [1, 1.08, 1] : 1 }}
        transition={{ duration: 1.2, repeat: state === 'speaking' ? Infinity : 0, ease: 'easeInOut' }}
        style={{ width: 220, height: 220 }}
      />
      <motion.svg
        width="200" height="200" viewBox="0 0 200 200"
        animate={headAnimate}
        transition={headTransition}
        className="relative z-10"
      >
        <circle cx="100" cy="100" r="78" fill="url(#faceGradient)" />
        <defs>
          <linearGradient id="faceGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7C5CD6" />
            <stop offset="100%" stopColor="#5B3DA6" />
          </linearGradient>
        </defs>

        <motion.path
          d="M 62 78 Q 72 70 84 76"
          stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none"
          animate={{ y: state === 'listening' ? -3 : 0 }}
          opacity="0.9"
        />
        <motion.path
          d="M 116 76 Q 128 70 138 78"
          stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none"
          animate={{ y: state === 'listening' ? -3 : 0 }}
          opacity="0.9"
        />

        <motion.g animate={eyeAnimate} transition={{ duration: 0.4 }}>
          <motion.ellipse cx="73" cy="96" rx="9" ry="11" fill="#fff" animate={blinkControls} style={{ originX: '73px', originY: '96px' }} />
          <motion.ellipse cx="127" cy="96" rx="9" ry="11" fill="#fff" animate={blinkControls} style={{ originX: '127px', originY: '96px' }} />
          <circle cx="73" cy="97" r="3.5" fill="#3D2A70" />
          <circle cx="127" cy="97" r="3.5" fill="#3D2A70" />
        </motion.g>

        <motion.rect
          x="82" y="128" width="36" height="10" rx="5"
          fill="#3D2A70"
          animate={mouthControls}
          style={{ originX: '100px', originY: '133px' }}
          opacity={state === 'thinking' ? 0.7 : 1}
        />
      </motion.svg>
    </div>
  );
}
