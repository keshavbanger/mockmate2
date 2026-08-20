const STATE_LABELS = {
  idle: 'Ready',
  listening: 'Listening to you',
  thinking: 'Thinking',
  speaking: 'AI is speaking',
};

const STATE_DOT = {
  idle: 'bg-slate-300',
  listening: 'bg-emerald-500',
  thinking: 'bg-amber-500',
  speaking: 'bg-[#6B46C1]',
};

export default function InterviewStatusBadge({ state, detail, light }) {
  const pulsing = state === 'listening' || state === 'speaking';
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider ${light ? 'text-white' : 'text-purple-700'}`}>
      <span className="relative flex h-2 w-2">
        {pulsing && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${STATE_DOT[state]}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${STATE_DOT[state]}`} />
      </span>
      {detail || STATE_LABELS[state] || STATE_LABELS.idle}
    </span>
  );
}
