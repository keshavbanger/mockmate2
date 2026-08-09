import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TIER_COLORS = {
  Tier1:   { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', bar: 'bg-gradient-to-r from-purple-500 to-indigo-500' },
  Tier2:   { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',     bar: 'bg-gradient-to-r from-blue-500 to-cyan-500' },
  Service: { bg: 'bg-slate-50',  border: 'border-slate-200',  badge: 'bg-slate-100 text-slate-700',   bar: 'bg-gradient-to-r from-slate-400 to-slate-500' },
};

const FIT_EMOJI = (pct) => pct >= 80 ? '🟢' : pct >= 60 ? '🔵' : pct >= 40 ? '🟡' : '🔴';

export default function CompanyReadiness({ companies }) {
  const [tab, setTab] = useState('Tier1');
  const [expanded, setExpanded] = useState(null);

  if (!companies?.length) return null;

  const tiers = ['Tier1', 'Tier2', 'Service'];
  const filtered = companies.filter(c => c.tier === tab);
  const avg = filtered.length
    ? Math.round(filtered.reduce((s, c) => s + c.fitPercent, 0) / filtered.length)
    : 0;

  return (
    <div className="premium-card">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Company Readiness</p>
      <p className="text-xs text-slate-500 mb-5">How ready is your resume for these companies right now?</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {tiers.map(t => (
          <button key={t} onClick={() => { setTab(t); setExpanded(null); }}
            className={`px-4 py-1.5 rounded-full text-xs font-black border transition-all ${
              tab === t ? 'bg-[var(--brand-primary)] text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-purple-300'
            }`}>
            {t === 'Service' ? 'Service/IT' : t} · {companies.filter(c => c.tier === t).length}
          </button>
        ))}
      </div>

      {/* Avg banner */}
      <div className="mb-4 px-4 py-3 rounded-xl bg-[#fafafa] border border-black/[0.04] flex items-center gap-3">
        <span className="text-2xl">{FIT_EMOJI(avg)}</span>
        <div>
          <p className="text-xs font-black text-slate-700">Average {tab} Fit: <span className="text-[var(--brand-primary)]">{avg}%</span></p>
          <p className="text-[10px] text-slate-400">{avg >= 75 ? 'Strong match — apply now.' : avg >= 55 ? 'Moderate — address gaps first.' : 'Below bar — improve score before applying.'}</p>
        </div>
      </div>

      {/* Company list */}
      <div className="space-y-2">
        {filtered.map((co) => {
          const cl = TIER_COLORS[co.tier] || TIER_COLORS.Service;
          const isOpen = expanded === co.companyName;
          return (
            <div key={co.companyName}
              className={`rounded-xl border ${cl.border} ${cl.bg} overflow-hidden transition-all`}>
              <button onClick={() => setExpanded(isOpen ? null : co.companyName)}
                className="w-full flex items-center gap-3 p-3 text-left">
                <span className="text-base">{FIT_EMOJI(co.fitPercent)}</span>
                <span className="flex-1 text-sm font-bold text-slate-800">{co.companyName}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${cl.badge}`}>{co.fitPercent}%</span>
                <div className="w-24 h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <motion.div className={`h-full rounded-full ${cl.bar}`}
                    initial={{ width: 0 }} animate={{ width: `${co.fitPercent}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }} />
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden">
                    <div className="px-4 pb-4 space-y-2">
                      <p className="text-xs text-slate-600">{co.reason}</p>
                      {co.gaps?.length > 0 && (
                        <ul className="space-y-1">
                          {co.gaps.map((g, i) => (
                            <li key={i} className="flex gap-2 text-xs text-slate-600">
                              <span className="text-amber-500 mt-0.5 flex-shrink-0">›</span>{g}
                            </li>
                          ))}
                        </ul>
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
