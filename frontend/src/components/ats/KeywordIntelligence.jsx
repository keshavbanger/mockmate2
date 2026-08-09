import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IMPORTANCE_COLORS = {
  'Critical':     { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700' },
  'Important':    { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700' },
  'Nice-to-have': { bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-600',  badge: 'bg-slate-100 text-slate-600' },
};

const COVERAGE_COLOR = (pct) =>
  pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';

export default function KeywordIntelligence({ categoryKeywords }) {
  const [expanded, setExpanded] = useState(null);
  if (!categoryKeywords?.length) return null;

  const critCount = categoryKeywords.filter(c => c.importance === 'Critical').length;
  const avgCoverage = Math.round(
    categoryKeywords.reduce((s, c) => s + c.coveragePercent, 0) / categoryKeywords.length
  );

  return (
    <div className="premium-card">
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Keyword Intelligence</p>
        <span className="text-[10px] font-bold text-slate-500">{categoryKeywords.length} categories · avg {avgCoverage}% coverage</span>
      </div>
      <p className="text-xs text-slate-500 mb-5">Keyword gap analysis by category, ranked by importance</p>

      <div className="space-y-2">
        {categoryKeywords.map((cat) => {
          const cl = IMPORTANCE_COLORS[cat.importance] || IMPORTANCE_COLORS['Nice-to-have'];
          const isOpen = expanded === cat.category;
          return (
            <div key={cat.category} className={`rounded-xl border overflow-hidden ${cl.border} ${cl.bg}`}>
              <button className="w-full flex items-center gap-3 p-3 text-left"
                onClick={() => setExpanded(isOpen ? null : cat.category)}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-800">{cat.category}</span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${cl.badge}`}>{cat.importance}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/70 rounded-full overflow-hidden">
                      <motion.div className={`h-full rounded-full ${COVERAGE_COLOR(cat.coveragePercent)}`}
                        initial={{ width: 0 }} animate={{ width: `${cat.coveragePercent}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }} />
                    </div>
                    <span className="text-[10px] font-black text-slate-600 w-10 text-right">{cat.coveragePercent}%</span>
                    <span className="text-[10px] text-slate-400">{cat.matchedCount}/{cat.totalInJD}</span>
                  </div>
                </div>
                <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden">
                    <div className="px-4 pb-4 space-y-3">
                      {cat.matchedKeywords?.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">✅ Matched</p>
                          <div className="flex flex-wrap gap-1">
                            {cat.matchedKeywords.map(kw => (
                              <span key={kw} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {cat.missingKeywords?.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-2">❌ Missing from Resume</p>
                          <div className="flex flex-wrap gap-1">
                            {cat.missingKeywords.map(kw => (
                              <span key={kw} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
