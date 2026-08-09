import { motion } from 'framer-motion';

const STAR_LABELS = ['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent'];

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`text-lg ${i <= rating ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
      ))}
    </div>
  );
}

export default function EnhancedExecutiveSummaryCard({ enhancedSummary }) {
  if (!enhancedSummary) return null;
  const {
    overallQuality, atsReadinessPercent, recruiterConfidence,
    estimatedInterviewProbability, estimatedATSPassProbability,
    topStrengths, topWeaknesses, paragraphSummary
  } = enhancedSummary;

  const confColor = recruiterConfidence === 'High'
    ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : recruiterConfidence === 'Medium'
    ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';

  return (
    <div className="premium-card">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Executive Intelligence Summary</p>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
        <div className="p-3 rounded-xl bg-[#fafafa] border border-black/[0.04] text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Quality</p>
          <StarRating rating={overallQuality} />
          <p className="text-[10px] text-slate-500 mt-1">{STAR_LABELS[overallQuality] || ''}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#fafafa] border border-black/[0.04] text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ATS Pass Rate</p>
          <p className="text-2xl font-black text-[var(--brand-primary)]">{estimatedATSPassProbability}%</p>
        </div>
        <div className="p-3 rounded-xl bg-[#fafafa] border border-black/[0.04] text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Interview Odds</p>
          <p className="text-2xl font-black text-indigo-600">{estimatedInterviewProbability}%</p>
        </div>
        <div className={`p-3 rounded-xl border text-center ${confColor}`}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1">Recruiter Confidence</p>
          <p className="text-sm font-black">{recruiterConfidence}</p>
        </div>
      </div>

      {/* Paragraph summary */}
      {paragraphSummary && (
        <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-sm text-slate-700 leading-relaxed">{paragraphSummary}</p>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {(topStrengths?.length > 0 || topWeaknesses?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topStrengths?.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">✅ Key Strengths</p>
              <ul className="space-y-1">
                {topStrengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-700">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">›</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {topWeaknesses?.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-2">⚠️ Key Weaknesses</p>
              <ul className="space-y-1">
                {topWeaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-700">
                    <span className="text-red-500 mt-0.5 flex-shrink-0">›</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
