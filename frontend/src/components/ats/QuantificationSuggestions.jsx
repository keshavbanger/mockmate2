import { useState } from 'react';

const WHY_IT_MATTERS =
  'Hiring managers and ATS systems both favour quantified achievements. Numbers prove impact — ' +
  '"increased sales by 35%" is far stronger than "increased sales".';

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-block cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64
                         bg-[#111] text-white text-xs font-medium rounded-xl px-3 py-2
                         shadow-xl leading-relaxed pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2
                           border-4 border-transparent border-t-[#111]" />
        </span>
      )}
    </span>
  );
}

export default function QuantificationSuggestions({ suggestions = [] }) {
  if (!suggestions || suggestions.length === 0) return (
    <div className="premium-card flex flex-col items-center justify-center gap-4 py-12">
      <div className="h-14 w-14 rounded-2xl bg-[var(--brand-light)] flex items-center justify-center text-2xl">📊</div>
      <p className="text-sm font-bold text-slate-500">No Quantification Suggestions</p>
      <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed">
        Your resume already uses strong quantified language, or AI analysis was not available.
      </p>
    </div>
  );

  return (
    <div className="premium-card">
      <div className="flex items-center gap-3 mb-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Quantification Improvements
        </p>
        <Tooltip text={WHY_IT_MATTERS}>
          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full
                           bg-slate-100 text-slate-400 text-[9px] font-black border border-slate-200">?</span>
        </Tooltip>
      </div>
      <p className="text-sm text-slate-500 font-medium mb-6">
        Add numbers and metrics to these bullet points — AI has suggested how to reframe them.
      </p>

      <div className="space-y-4">
        {suggestions.map((item, i) => (
          <div key={i} className="border border-black/[0.05] rounded-2xl overflow-hidden bg-[#fafafa]">
            {/* Original */}
            <div className="p-4 border-b border-black/[0.04]">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Original (weak)
              </p>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{item.original}</p>
            </div>
            {/* Suggestion */}
            <div className="p-4 bg-emerald-50/50">
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">
                📊 With Quantification
              </p>
              <p className="text-sm text-[#111] font-semibold leading-relaxed">{item.suggestion}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Why it matters callout */}
      <div className="flex items-start gap-3 mt-5 p-3 bg-amber-50 border border-amber-200/60 rounded-xl">
        <span className="text-base mt-0.5">💡</span>
        <p className="text-xs text-amber-700 font-semibold leading-relaxed">
          <strong>Why this matters:</strong> {WHY_IT_MATTERS}
        </p>
      </div>
    </div>
  );
}
