export default function RoleFitAssessment({ data }) {
  if (!data) return null;

  const { roleFitScore = 0, summary = '', evidence = [], gaps = [] } = data;

  const color =
    roleFitScore >= 75 ? 'indigo' :
    roleFitScore >= 50 ? 'amber'  : 'red';

  const trackColor = {
    indigo: 'bg-indigo-600',
    amber:  'bg-amber-500',
    red:    'bg-red-400',
  }[color];

  const scoreColor = {
    indigo: 'text-indigo-600',
    amber:  'text-amber-600',
    red:    'text-red-500',
  }[color];

  return (
    <div className="premium-card h-full">
      <h3 className="section-title">Role Fit Assessment</h3>

      {/* Score row */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex-shrink-0 text-center">
          <p className={`text-5xl font-black ${scoreColor}`}>{roleFitScore}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">/ 100</p>
        </div>
        <div className="flex-1">
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div className={`h-full rounded-full transition-all duration-700 ${trackColor}`} style={{ width: `${roleFitScore}%` }} />
          </div>
          {summary && <p className="text-xs text-slate-600 font-semibold leading-relaxed">{summary}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Evidence */}
        {evidence.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Supporting Evidence</p>
            <ul className="space-y-2">
              {evidence.map((e, i) => (
                <li key={i} className="text-xs text-slate-700 font-semibold leading-relaxed flex gap-2 items-start">
                  <span className="text-indigo-400 mt-0.5 flex-shrink-0">▸</span>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gaps */}
        {gaps.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">Role Gaps Identified</p>
            <ul className="space-y-2">
              {gaps.map((g, i) => (
                <li key={i} className="text-xs text-slate-700 font-semibold leading-relaxed flex gap-2 items-start">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">▸</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
