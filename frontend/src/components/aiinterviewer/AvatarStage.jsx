import { motion } from 'framer-motion';
import VideoAvatarFace from './VideoAvatarFace.jsx';
import AudioVisualizer from './AudioVisualizer.jsx';
import InterviewStatusBadge from './InterviewStatusBadge.jsx';

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 h-4">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

const TURN_BADGES = {
  REPEAT_REQUEST: { label: 'Repeating', color: 'bg-amber-500/90 text-white' },
  CLARIFICATION_REQUEST: { label: 'Clarifying', color: 'bg-blue-500/90 text-white' },
  // Not an interview question — the engine checking whether the candidate is
  // still there after several answers didn't come through.
  ENGAGEMENT_CHECK: { label: 'Checking in', color: 'bg-slate-600/90 text-white' },
};

// avatarState: 'idle' | 'listening' | 'thinking' | 'speaking'
export default function AvatarStage({
  avatarState, message, micStream, mouthPulse, statusDetail, turnType, avatarSet,
}) {
  const visualizerMode =
    avatarState === 'listening' ? 'mic' :
    avatarState === 'speaking' ? 'boundary' : 'idle';
  const turnBadge = TURN_BADGES[turnType];

  return (
    <div className="relative w-full">
      <VideoAvatarFace state={avatarState} avatarSet={avatarSet} />

      {/* Status + mini waveform, overlaid top-left on the video */}
      <div className="absolute top-4 left-4 bg-black/55 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center gap-3">
        <InterviewStatusBadge state={avatarState} detail={statusDetail} light />
        {avatarState === 'thinking' ? (
          <ThinkingDots />
        ) : (
          <AudioVisualizer mode={visualizerMode} stream={micStream} pulseSignal={mouthPulse} compact />
        )}
      </div>

      {turnBadge && (
        <span className={`absolute top-4 right-4 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full backdrop-blur-md ${turnBadge.color}`}>
          {turnBadge.label}
        </span>
      )}

      {/* Message, overlaid bottom-on-video. No fixed-total progress bar
          here — the adaptive engine has no known question count, so a
          segmented "X of N" bar would misrepresent an unknowable total. */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent rounded-b-[28px] px-6 sm:px-8 pt-14 pb-6">
        <p className="text-white text-sm sm:text-base font-medium leading-relaxed text-center max-w-xl mx-auto">
          {message || 'Getting ready…'}
        </p>
      </div>
    </div>
  );
}
