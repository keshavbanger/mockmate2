import { motion } from 'framer-motion';

export default function HonestScoreBreakdown({ report }) {
  if (!report) return null;

  const components = [
    { label: 'Content Quality', weight: '25%', score: report.contentQualityScore ?? 70, color: 'bg-indigo-600', desc: 'Verb strength, clarity, and depth' },
    { label: 'Keyword Relevance', weight: '20%', score: report.semanticScore ?? report.keywordOverlapScore, color: 'bg-purple-600', desc: 'Semantic match to job domain' },
    { label: 'Keyword Match', weight: '15%', score: report.keywordOverlapScore ?? 0, color: 'bg-blue-500', desc: 'Direct skill & term overlaps' },
    { label: 'Section Completeness', weight: '15%', score: report.sectionScore ?? 0, color: 'bg-emerald-500', desc: 'Presence of vital sections' },
    { label: 'Formatting', weight: '10%', score: report.formattingScore ?? 0, color: 'bg-amber-500', desc: 'ATS parser legibility' },
    { label: 'Quantification', weight: '10%', score: report.quantificationScore ?? 0, color: 'bg-orange-500', desc: 'Metrics & measurable impact' },
    { label: 'Credibility', weight: '5%', score: report.consistencyScore ?? 100, color: 'bg-cyan-500', desc: 'Verifiable metrics & consistency' },
  ];

  return (
    <div className="premium-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hard Truth Scoring Engine</p>
          <h3 className="text-lg font-extrabold text-[#111]">100-Point Senior Recruiter Breakdown</h3>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-purple-700">{report.finalScore}</span>
          <span className="text-xs font-bold text-slate-400"> / 100</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3 mt-4">
        {components.map((item, idx) => (
          <div key={idx} className="p-3 bg-[#fafafa] border border-black/[0.04] rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.weight}</span>
                <span className="text-xs font-extrabold text-slate-800">{item.score}</span>
              </div>
              <p className="text-xs font-bold text-[#111] mb-0.5 leading-snug">{item.label}</p>
              <p className="text-[10px] text-slate-500 leading-tight mb-3">{item.desc}</p>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${item.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${item.score}%` }}
                transition={{ duration: 0.8, delay: idx * 0.05 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
