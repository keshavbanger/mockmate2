import { useRef, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

// Video-loop avatar — the active AvatarProvider (see AvatarStage.jsx).
// Supersedes AvatarFace.jsx (the original SVG provider, kept but unused)
// per the "swap only the mouth/face-drive source, state machine stays
// identical" contract the original design brief called out.
//
// thinking intentionally maps to the same clip as idle — there's no
// dedicated "thinking" clip; the THINKING status badge/dots text carries
// that distinction instead, matching the source material's own note.
const CLIP_SOURCES = {
  man: {
    idle: '/avatar/Man_sitting_and_looking_forward_202608201649.mp4',
    listening: '/avatar/Man_listening_to_camera_202608201651.mp4',
    speaking: '/avatar/Man_talking_in_studio_1080p_202608201705.mp4',
  },
  woman: {
    idle: '/avatar/Woman_seated_in_neutral_expression_202608201755.mp4',
    // Same clip as idle by request — no separate listening clip for this
    // avatar set. Woman_listening_to_camera_202608201756.mp4 still exists
    // on disk (unused) if that's reversed later.
    listening: '/avatar/Woman_seated_in_neutral_expression_202608201755.mp4',
    // .mov, not .mp4 — QuickTime container. Chrome/Firefox generally won't
    // play .mov in a <video> tag even if the underlying codec is H.264,
    // since they gate on file extension/MIME type. If this doesn't play
    // for you, rename it back to .mp4 (works if it's actually H.264/AAC
    // inside, just mislabeled) or re-export as a real .mp4.
    speaking: '/avatar/Woman_talking_in_studioq.mov',
  },
};

const FADE_MS = 250;

// avatarSet: 'man' | 'woman' — picked once at setup (see AIInterviewBetaPage),
// not switchable mid-interview.
export default function VideoAvatarFace({ state, avatarSet = 'man' }) {
  const videoRefs = useRef({});
  const sources = CLIP_SOURCES[avatarSet] || CLIP_SOURCES.man;

  // One <video> per UNIQUE src, not per state slot — grouped dynamically so
  // that whenever two states point at the same file (thinking always rides
  // along with idle; some avatar sets reuse one clip for idle AND listening
  // too, e.g. the woman set), they share a single decoder instead of two
  // <video> elements silently double-decoding the same file.
  const clips = useMemo(() => {
    const bySrc = new Map();
    const addState = (stateKey, src) => {
      if (!bySrc.has(src)) bySrc.set(src, new Set());
      bySrc.get(src).add(stateKey);
    };
    addState('idle', sources.idle);
    addState('listening', sources.listening);
    addState('speaking', sources.speaking);
    bySrc.get(sources.idle)?.add('thinking'); // no dedicated thinking clip — always rides with idle

    return Array.from(bySrc.entries()).map(([src, statesSet], i) => ({
      id: `clip-${i}`,
      src,
      matchesState: (s) => statesSet.has(s),
    }));
  }, [sources]);

  // Whichever clip is active the moment this component first mounts —
  // computed once via the lazy initializer, not re-derived on every render,
  // so it stays fixed even after `state` moves on. On interview start this
  // is almost always "speaking" (the intro plays immediately), which is
  // also the largest file (1080p) of the three — exactly the one that most
  // needs to not be fighting the other two for bandwidth.
  const [priorityClipId] = useState(() => clips.find((c) => c.matchesState(state))?.id ?? null);
  const [priorityLoadDone, setPriorityLoadDone] = useState(false);
  // First real frame from ANY clip — flips once and never resets, so the
  // loading spinner only ever covers that initial gap, not later transitions.
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);

  // Muted programmatically, not just via the JSX attribute — some browsers
  // evaluate autoplay eligibility off the DOM property before React's
  // attribute commit is guaranteed to have landed, and a play() rejection
  // here used to be swallowed with zero trace, which is exactly what made
  // "the box is just black" impossible to diagnose without DevTools.
  const attemptPlay = (el, src) => {
    if (!el) return;
    el.muted = true;
    el.play().catch((err) => {
      console.warn('[VideoAvatarFace] play() blocked for', src, '—', err?.name || err);
    });
  };

  useEffect(() => {
    // Play the incoming clip immediately as its fade-in starts; pause the
    // outgoing one only after its fade-out has actually finished, so we
    // don't run three decoders at once but also don't cut it mid-crossfade.
    const activeClip = clips.find((c) => c.matchesState(state));
    const activeEl = videoRefs.current[activeClip?.id];
    if (activeEl && activeEl.paused) {
      activeEl.currentTime = activeEl.currentTime || 0;
      attemptPlay(activeEl, activeClip.src);
    }

    const timeout = setTimeout(() => {
      clips.forEach((clip) => {
        const el = videoRefs.current[clip.id];
        if (!el) return;
        if (clip.matchesState(state)) {
          attemptPlay(el, clip.src);
        } else {
          el.pause();
        }
      });
    }, FADE_MS);

    return () => clearTimeout(timeout);
  }, [state, clips]);

  // Preload all three on mount (and whenever avatarSet changes) regardless
  // of initial state, per the spec — switching states should never trigger
  // a load, only a crossfade. But NOT all three at once: loading them
  // together made the one clip that's actually visible on interview start
  // (see priorityClipId above) compete for bandwidth with two the candidate
  // won't see for a while, which is what produced a multi-second blank gap
  // before the very first frame appeared. Load the priority clip alone
  // first, then bring the rest in shortly after.
  useEffect(() => {
    const priorityEl = videoRefs.current[priorityClipId];
    if (priorityEl) priorityEl.load();

    const timer = setTimeout(() => {
      setPriorityLoadDone(true);
      clips.forEach((clip) => {
        if (clip.id === priorityClipId) return;
        const el = videoRefs.current[clip.id];
        if (el) {
          // Set imperatively before load() — React's re-render (from the
          // setPriorityLoadDone above) that would otherwise flip the
          // preload="auto" JSX attribute lands a tick later, and load()
          // reads whatever preload value is on the element right now.
          el.preload = 'auto';
          el.load();
        }
      });
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips]);

  return (
    <div className="relative w-full max-w-2xl aspect-video rounded-[28px] overflow-hidden bg-slate-900 shadow-xl">
      {!hasRenderedFrame && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-9 w-9 rounded-full border-[3px] border-white/15 border-t-white/70 animate-spin" />
        </div>
      )}
      {clips.map((clip) => (
        <motion.video
          key={clip.id}
          ref={(el) => { videoRefs.current[clip.id] = el; }}
          src={clip.src}
          muted
          autoPlay
          loop
          playsInline
          preload={clip.id === priorityClipId || priorityLoadDone ? 'auto' : 'metadata'}
          onPlaying={() => setHasRenderedFrame(true)}
          onError={(e) => {
            const err = e.currentTarget.error;
            console.error('[VideoAvatarFace] failed to load', clip.src, '— code', err?.code, err?.message);
          }}
          className="absolute inset-0 w-full h-full object-cover"
          initial={false}
          animate={{ opacity: clip.matchesState(state) ? 1 : 0 }}
          transition={{ duration: FADE_MS / 1000 }}
        />
      ))}
    </div>
  );
}
