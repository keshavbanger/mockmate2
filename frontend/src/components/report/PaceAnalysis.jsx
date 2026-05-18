const PACE_META = {
  'Too Fast':   { color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200',    bar: 'bg-red-400',    tip: 'Slow down — listeners need time to absorb your answers.' },
  'Ideal':      { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500', tip: 'Great pace — clear and easy to follow.' },
  'Moderate':   { color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  bar: 'bg-indigo-500',  tip: 'Comfortable pace with room to add more depth.' },
  'Too Slow':   { color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  bar: 'bg-amber-400',  tip: 'Pick up the pace slightly to maintain energy and engagement.' },
};

export default function PaceAnalysis({ data }) {
  if (!data) return null;

  const { wpm = 0, pacingLabel = 'Moderate', insight = '', timeDistribution = [] } = data;

  const meta = PACE_META[pacingLabel] || PACE_META['Moderate'];

  // Normalise wpm into a 0-100 bar (ideal range 120-160 wpm)
  const wpmBar = Math.min(100, Math.round((wpm / 180) * 100));

  return (
    <div className="premium-card h-full">
      <h3 className="section-title">Pace &amp; Time Analysis</h3>

      {/* WPM hero */}
      <div className={`flex items-center justify-between p-5 rounded-2xl border ${meta.bg} ${meta.border} mb-6`}>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Speaking Pace</p>
          <p className={`text-4xl font-black ${meta.color}`}>
            {Math.round(wpm)}
            <span className="text-sm font-bold text-slate-300 ml-1">WPM</span>
          </p>
        </div>
        <div className="text-right">
          <span className={`inline-block px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border ${meta.bg} ${meta.border} ${meta.color}`}>
            {pacingLabel}
          </span>
          <p className="text-[11px] text-slate-500 font-semibold mt-2 max-w-[200px] leading-relaxed">{meta.tip}</p>
        </div>
      </div>

      {/* WPM bar */}
      <div className="mb-6">
        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
          <span>0</span><span>Ideal Zone (120–160)</span><span>180+</span>
        </div>
        <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          {/* Ideal zone highlight */}
          <div className="absolute h-full bg-emerald-100 rounded-full" style={{ left: '66%', width: '22%' }} />
          {/* Actual bar */}
          <div className={`absolute h-full rounded-full transition-all duration-700 ${meta.bar}`} style={{ width: `${wpmBar}%` }} />
        </div>
      </div>

      {/* AI insight */}
      {insight && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-xl">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">AI Pacing Insight</p>
          <p className="text-xs text-slate-600 font-semibold leading-relaxed">{insight}</p>
        </div>
      )}

      {/* Per-question time distribution */}
      {timeDistribution.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Time Distribution</p>
          <div className="space-y-2.5">
            {timeDistribution.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex-shrink-0 mt-0.5">Q{i + 1}</span>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-tight">{item.label}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{item.durationNote}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
