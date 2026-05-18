export default function HesitationInsights({ data }) {
  if (!data) return null;

  const {
    totalFillerWords = 0,
    fillerRate = 0,
    pauseCount = 0,
    topFillers = [],
    hesitationPattern = '',
    impactOnDelivery = '',
  } = data;

  const rateColor =
    fillerRate <= 5  ? 'text-emerald-600' :
    fillerRate <= 12 ? 'text-amber-600'   : 'text-red-500';

  const rateLabel =
    fillerRate <= 5  ? 'Excellent' :
    fillerRate <= 12 ? 'Moderate'  : 'High';

  // Max filler count for relative bar widths
  const fillerEntries = topFillers.map((f, i) => ({ word: f, rank: i }));
  const maxRank = Math.max(fillerEntries.length - 1, 1);

  return (
    <div className="premium-card h-full">
      <h3 className="section-title">Pause &amp; Hesitation Insights</h3>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Filler count */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
          <p className="text-2xl font-black text-slate-900">{totalFillerWords}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Filler Words</p>
        </div>
        {/* Filler rate */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
          <p className={`text-2xl font-black ${rateColor}`}>{Number(fillerRate).toFixed(1)}%</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{rateLabel} Rate</p>
        </div>
        {/* Pause count */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
          <p className="text-2xl font-black text-slate-900">{pauseCount}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Pauses</p>
        </div>
      </div>

      {/* Top filler words — horizontal rank bars */}
      {topFillers.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Top Filler Words</p>
          <div className="space-y-2.5">
            {topFillers.slice(0, 5).map((word, i) => {
              const barWidth = Math.round(((maxRank - i) / maxRank) * 100);
              const intensity = i === 0 ? 'bg-red-400' : i === 1 ? 'bg-amber-400' : 'bg-slate-300';
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-16 text-xs font-bold text-slate-700 text-right flex-shrink-0">"{word}"</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${intensity}`} style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 w-6 text-right">#{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hesitation pattern */}
      {hesitationPattern && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Hesitation Pattern</p>
          <p className="text-xs text-slate-700 font-semibold leading-relaxed">{hesitationPattern}</p>
        </div>
      )}

      {/* Impact on delivery */}
      {impactOnDelivery && (
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Impact on Delivery</p>
          <p className="text-xs text-slate-600 font-semibold leading-relaxed">{impactOnDelivery}</p>
        </div>
      )}
    </div>
  );
}
