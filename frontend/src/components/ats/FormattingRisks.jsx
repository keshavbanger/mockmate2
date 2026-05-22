const ATS_TIPS = [
  'Use a single-column layout — most ATS systems read left-to-right, top-to-bottom.',
  'Avoid headers and footers — ATS parsers frequently skip them entirely.',
  'Use standard section headings like "Experience", "Skills", and "Education".',
  'Save and submit as .docx or plain .pdf — never as an image-based PDF.',
  'Avoid tables, text boxes, and graphics — they confuse most ATS parsers.',
];

const RISK_ICONS = [
  '🔲', // tables / pipes
  '🗂',  // columns
  '📏', // long lines
  '🔣', // symbols
  '📄', // too long
];

export default function FormattingRisks({ risks = [] }) {
  return (
    <div className="premium-card h-full flex flex-col gap-5">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
        Formatting Safety
      </p>

      {risks.length === 0 ? (
        <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-sm font-bold text-emerald-700">No Formatting Issues Detected</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Your resume appears ATS-friendly. Good job keeping it clean!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {risks.map((risk, i) => (
            <div key={i}
              className="flex items-start gap-3 p-3.5 bg-amber-50/60 border border-amber-200/70 rounded-2xl">
              <span className="text-lg flex-shrink-0 mt-0.5">{RISK_ICONS[i] ?? '⚠️'}</span>
              <p className="text-sm text-amber-800 font-semibold leading-relaxed">{risk}</p>
            </div>
          ))}
        </div>
      )}

      {/* ATS Formatting Tips */}
      <div className="mt-auto pt-4 border-t border-black/[0.04]">
        <p className="text-[9px] font-black text-[var(--brand-primary)] uppercase tracking-widest mb-3">
          💡 ATS Formatting Best Practices
        </p>
        <ul className="space-y-2">
          {ATS_TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-[var(--brand-primary)] text-xs font-black flex-shrink-0 mt-0.5">▸</span>
              <span className="text-xs text-slate-500 font-medium leading-relaxed">{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
