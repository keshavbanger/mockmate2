export default function KeywordPanel({ matched = [], missing = [] }) {
  return (
    <div className="premium-card">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Keyword Analysis</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Matched */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">✓ Matched</p>
            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {matched.length}
            </span>
          </div>
          {matched.length === 0
            ? <p className="text-xs text-slate-300 italic">None detected</p>
            : <div className="flex flex-wrap gap-2">
                {matched.map((kw, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {kw}
                  </span>
                ))}
              </div>
          }
        </div>

        {/* Missing */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">✗ Missing</p>
            <span className="text-xs font-black text-red-500 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
              {missing.length}
            </span>
          </div>
          {missing.length === 0
            ? <p className="text-xs text-slate-300 italic">No major gaps found</p>
            : <div className="flex flex-wrap gap-2">
                {missing.map((kw, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                    {kw}
                  </span>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  );
}
