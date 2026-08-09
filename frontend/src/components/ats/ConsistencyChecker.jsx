import { motion } from 'framer-motion';

const STATUS_CONFIG = {
  PASS: { icon: '✅', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  FAIL: { icon: '❌', cls: 'text-red-600 bg-red-50 border-red-200' },
};

export default function ConsistencyChecker({ consistencyCheck }) {
  if (!consistencyCheck) return null;

  const { consistencyScore, passedChecks, totalChecks, checks } = consistencyCheck;
  const pct = Math.round((passedChecks / totalChecks) * 100);
  const color = pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="premium-card">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Consistency Checker</p>
          <p className="text-xs text-slate-500">6 deterministic formatting and style checks</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-black ${color}`}>{consistencyScore}</p>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest">/100</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>{passedChecks}/{totalChecks} checks passed</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
      </div>

      {/* Checks */}
      <div className="space-y-2">
        {checks?.map((check, i) => {
          const cfg = STATUS_CONFIG[check.status] || STATUS_CONFIG.FAIL;
          return (
            <div key={i} className={`rounded-xl border p-3 ${cfg.cls}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{cfg.icon}</span>
                <span className="text-xs font-bold">{check.checkName}</span>
              </div>
              <p className="text-xs ml-6">{check.detail}</p>
              {check.examples?.length > 0 && (
                <ul className="mt-2 ml-6 space-y-1">
                  {check.examples.map((ex, j) => (
                    <li key={j} className="text-[11px] font-mono bg-white/60 rounded px-2 py-1">{ex}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
