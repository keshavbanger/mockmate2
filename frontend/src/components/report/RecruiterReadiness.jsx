export default function RecruiterReadiness({ data }) {
  if (!data) return null;

  const { readinessScore = 0, verdict = '', mustImproveBefore = [], readyStrengths = [] } = data;

  const tier =
    readinessScore >= 80 ? { label: 'Ready to Interview', color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' } :
    readinessScore >= 55 ? { label: 'Almost There',        color: 'amber',   bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500'   } :
                           { label: 'Needs Preparation',   color: 'red',     bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-500'     };

  return (
    <div className="premium-card h-full">
      <h3 className="section-title">Recruiter Readiness</h3>

      {/* Score + tier badge */}
      <div className={`flex items-center justify-between p-5 rounded-2xl border ${tier.bg} ${tier.border} mb-6`}>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Readiness Score</p>
          <p className={`text-4xl font-black ${tier.text}`}>{readinessScore}<span className="text-base font-bold text-slate-300 ml-1">/100</span></p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border ${tier.bg} ${tier.border} ${tier.text}`}>
            <span className={`h-2 w-2 rounded-full ${tier.dot}`} />
            {tier.label}
          </span>
          {verdict && <p className="text-xs text-slate-500 font-semibold text-right max-w-xs leading-relaxed">{verdict}</p>}
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-6">
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              readinessScore >= 80 ? 'bg-emerald-500' : readinessScore >= 55 ? 'bg-amber-500' : 'bg-red-400'
            }`}
            style={{ width: `${readinessScore}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* What's ready */}
        {readyStrengths.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">✓ Interview-Ready</p>
            <ul className="space-y-2">
              {readyStrengths.map((s, i) => (
                <li key={i} className="flex gap-2 items-start text-xs font-semibold text-slate-700 leading-relaxed">
                  <span className="h-4 w-4 mt-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 text-[9px] font-black">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Must improve before real interview */}
        {mustImproveBefore.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3">⚠ Fix Before Interview</p>
            <ul className="space-y-2">
              {mustImproveBefore.map((s, i) => (
                <li key={i} className="flex gap-2 items-start text-xs font-semibold text-slate-700 leading-relaxed">
                  <span className="h-4 w-4 mt-0.5 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 text-[9px] font-black">!</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
