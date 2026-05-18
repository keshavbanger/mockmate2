export default function AnswerCompleteness({ data }) {
  if (!data) return null;

  const { overallCompletenessScore = 0, perAnswer = [] } = data;

  const tierLabel =
    overallCompletenessScore >= 80 ? 'Strong' :
    overallCompletenessScore >= 55 ? 'Moderate' : 'Incomplete';

  const tierColor =
    overallCompletenessScore >= 80 ? 'text-emerald-600' :
    overallCompletenessScore >= 55 ? 'text-amber-600'  : 'text-red-500';

  const barColor = (pct) =>
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 55 ? 'bg-amber-400'  : 'bg-red-400';

  return (
    <div className="premium-card h-full">
      <h3 className="section-title">Answer Completeness</h3>

      {/* Overall score */}
      <div className="flex items-center gap-5 mb-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
        <div className="text-center flex-shrink-0">
          <p className={`text-4xl font-black ${tierColor}`}>{overallCompletenessScore}<span className="text-sm text-slate-300 font-bold">%</span></p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{tierLabel}</p>
        </div>
        <div className="flex-1">
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor(overallCompletenessScore)}`}
              style={{ width: `${overallCompletenessScore}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
            Measures how thoroughly the candidate addressed each question asked.
          </p>
        </div>
      </div>

      {/* Per-answer rows */}
      {perAnswer.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Per-Question Breakdown</p>
          {perAnswer.map((item, i) => {
            const pct = item.completenessPercent ?? 0;
            return (
              <div key={i} className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-6 flex-shrink-0">Q{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-600 leading-tight line-clamp-1">
                      {item.note || `Question ${i + 1}`}
                    </span>
                    <span className={`text-xs font-black flex-shrink-0 ml-2 ${
                      pct >= 80 ? 'text-emerald-600' : pct >= 55 ? 'text-amber-600' : 'text-red-500'
                    }`}>{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
