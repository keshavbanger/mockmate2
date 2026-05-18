export default function FormattingRisks({ risks = [] }) {
  if (risks.length === 0) return (
    <div className="premium-card h-full flex flex-col items-center justify-center gap-4 py-12">
      <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-2xl">✅</div>
      <p className="text-sm font-bold text-emerald-600">No Formatting Issues</p>
      <p className="text-xs text-slate-400 text-center max-w-[220px] leading-relaxed">
        Your resume appears ATS-safe with no problematic layout patterns.
      </p>
    </div>
  );

  return (
    <div className="premium-card h-full">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Formatting Risks</p>

      <div className="mb-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
        <span className="text-lg flex-shrink-0">⚠</span>
        <p className="text-xs font-semibold text-amber-700 leading-relaxed">
          {risks.length} potential ATS parsing issue{risks.length > 1 ? 's' : ''} detected.
          Fixing these will improve parse accuracy.
        </p>
      </div>

      <ul className="space-y-3">
        {risks.map((risk, i) => (
          <li key={i} className="flex gap-3 items-start p-3 bg-red-50 border border-red-100 rounded-2xl">
            <span className="text-red-400 text-sm flex-shrink-0 mt-0.5">●</span>
            <span className="text-xs font-medium text-slate-700 leading-relaxed">{risk}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 p-4 bg-[var(--brand-light)] border border-purple-100 rounded-2xl">
        <p className="text-[10px] font-black text-[var(--brand-primary)] uppercase tracking-widest mb-1">Tip</p>
        <p className="text-xs text-slate-600 font-medium leading-relaxed">
          Use a single-column layout with standard headings, plain bullets, and no tables, text boxes, or graphics for maximum ATS compatibility.
        </p>
      </div>
    </div>
  );
}
