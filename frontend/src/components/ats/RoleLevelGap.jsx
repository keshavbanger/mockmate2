const LEVEL_ORDER = { Junior: 1, Mid: 2, Senior: 3 };

const LEVEL_COLORS = {
  Junior: { bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-700',     pill: 'bg-sky-100 text-sky-700 border-sky-200'     },
  Mid:    { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  pill: 'bg-violet-100 text-violet-700 border-violet-200'  },
  Senior: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   pill: 'bg-amber-100 text-amber-700 border-amber-200'   },
};

export default function RoleLevelGap({ roleLevelGap = null }) {
  if (!roleLevelGap) return null;

  const { detectedLevel = 'Mid', requiredLevel = 'Mid', gaps = [] } = roleLevelGap;

  const detected    = LEVEL_COLORS[detectedLevel] || LEVEL_COLORS['Mid'];
  const required    = LEVEL_COLORS[requiredLevel] || LEVEL_COLORS['Mid'];
  const isMatch     = detectedLevel === requiredLevel;
  const hasGap      = !isMatch && gaps.length > 0;

  const detectedRank = LEVEL_ORDER[detectedLevel] ?? 2;
  const requiredRank = LEVEL_ORDER[requiredLevel] ?? 2;
  const overqualified = detectedRank > requiredRank;

  return (
    <div className="premium-card">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">
        Role Level Assessment
      </p>

      {/* Level comparison row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Detected */}
        <div className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border ${detected.bg} ${detected.border}`}>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Detected Level</p>
          <span className="text-2xl">
            {detectedLevel === 'Junior' ? '🌱' : detectedLevel === 'Mid' ? '🔷' : '🚀'}
          </span>
          <span className={`px-4 py-1.5 rounded-full text-sm font-black border uppercase tracking-wide ${detected.pill}`}>
            {detectedLevel}
          </span>
        </div>

        {/* Required */}
        <div className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border ${required.bg} ${required.border}`}>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">JD Requires</p>
          <span className="text-2xl">
            {requiredLevel === 'Junior' ? '🌱' : requiredLevel === 'Mid' ? '🔷' : '🚀'}
          </span>
          <span className={`px-4 py-1.5 rounded-full text-sm font-black border uppercase tracking-wide ${required.pill}`}>
            {requiredLevel}
          </span>
        </div>
      </div>

      {/* Status banner */}
      {isMatch ? (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-sm font-bold text-emerald-700">Level Match — Great news!</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Your experience level aligns with what this job requires.
            </p>
          </div>
        </div>
      ) : overqualified ? (
        <div className="flex items-center gap-3 p-4 bg-sky-50 border border-sky-200 rounded-2xl">
          <span className="text-2xl">⬆️</span>
          <div>
            <p className="text-sm font-bold text-sky-700">You may be overqualified</p>
            <p className="text-xs text-sky-600 mt-0.5">
              Your profile appears more senior than the role requires. Consider tailoring your resume
              to highlight relevant scope rather than seniority.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-sm font-bold text-red-700">Level gap detected</p>
            <p className="text-xs text-red-600 mt-0.5">
              This role requires a {requiredLevel}-level candidate. Bridge the gaps below to strengthen your application.
            </p>
          </div>
        </div>
      )}

      {/* Gap list */}
      {hasGap && (
        <div className="mt-5">
          <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-3">Specific Gaps to Bridge</p>
          <ul className="space-y-2">
            {gaps.map((gap, i) => (
              <li key={i} className="flex items-start gap-3 p-3 bg-red-50/60 border border-red-100 rounded-xl">
                <span className="text-red-400 mt-0.5 flex-shrink-0">▸</span>
                <span className="text-sm text-slate-700 font-medium leading-relaxed">{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
