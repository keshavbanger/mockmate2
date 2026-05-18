const VERDICT_CONFIG = {
  'Strong fit':   { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: '🟢' },
  'Good fit':     { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-500',    icon: '🔵' },
  'Moderate fit': { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400',   icon: '🟡' },
  'Weak fit':     { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-600',     dot: 'bg-red-400',     icon: '🔴' },
};

export default function VerdictBanner({ verdict = 'Moderate fit', verdictReason = '', strengthLines = [] }) {
  const cfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG['Moderate fit'];

  return (
    <div className="premium-card h-full">
      <h3 className="section-title">Overall Verdict</h3>

      {/* Verdict badge */}
      <div className={`flex items-center gap-4 p-5 rounded-2xl border ${cfg.bg} ${cfg.border} mb-6`}>
        <span className="text-3xl">{cfg.icon}</span>
        <div>
          <p className={`text-xl font-black ${cfg.text}`}>{verdict}</p>
          {verdictReason && (
            <p className="text-xs text-slate-600 font-semibold leading-relaxed mt-1 max-w-xl">
              {verdictReason}
            </p>
          )}
        </div>
      </div>

      {/* Strength lines */}
      {strengthLines.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">
            Top Resume Strengths
          </p>
          <ul className="space-y-2.5">
            {strengthLines.map((line, i) => (
              <li key={i} className="flex gap-3 items-start p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="h-5 w-5 mt-0.5 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black">
                  {i + 1}
                </span>
                <span className="text-xs text-slate-700 font-semibold leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
