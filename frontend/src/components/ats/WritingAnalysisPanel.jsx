import { motion } from 'framer-motion';

const SCORE_LABELS = [
  { key: 'grammarScore',         label: 'Grammar',        color: 'bg-emerald-400' },
  { key: 'professionalToneScore', label: 'Professional Tone', color: 'bg-blue-400' },
  { key: 'actionVerbScore',      label: 'Action Verbs',   color: 'bg-purple-400' },
  { key: 'readabilityScore',     label: 'Readability',    color: 'bg-indigo-400' },
];

export default function WritingAnalysisPanel({ writingAnalysis }) {
  if (!writingAnalysis) return null;
  const {
    grammarScore, professionalToneScore, actionVerbScore, readabilityScore,
    buzzwordOveruse, passiveVoiceInstances, conciseness, grammarErrors
  } = writingAnalysis;

  const scores = { grammarScore, professionalToneScore, actionVerbScore, readabilityScore };
  const avgScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 4);

  return (
    <div className="premium-card">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Writing Quality Analysis</p>
          <p className="text-xs text-slate-500">Grammar, tone, and readability assessment</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-black ${avgScore >= 75 ? 'text-emerald-600' : avgScore >= 55 ? 'text-amber-600' : 'text-red-600'}`}>{avgScore}</p>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest">Avg</p>
        </div>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {SCORE_LABELS.map(({ key, label, color }) => {
          const val = scores[key] ?? 0;
          return (
            <div key={key} className="p-3 bg-[#fafafa] border border-black/[0.04] rounded-xl">
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
                <span className="text-sm font-black text-slate-800">{val}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div className={`h-full rounded-full ${color}`}
                  initial={{ width: 0 }} animate={{ width: `${val}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Conciseness + buzzwords */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="px-3 py-1.5 rounded-full border text-xs font-bold border-slate-200 text-slate-600">
          📏 Conciseness: <span className="text-[var(--brand-primary)]">{conciseness}</span>
        </div>
        {buzzwordOveruse?.length > 0 && buzzwordOveruse.map(bw => (
          <div key={bw} className="px-3 py-1.5 rounded-full border text-xs font-bold border-amber-200 bg-amber-50 text-amber-700">
            ⚠️ "{bw}" overused
          </div>
        ))}
      </div>

      {/* Passive voice */}
      {passiveVoiceInstances?.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">🔄 Passive → Active Voice</p>
          <div className="space-y-2">
            {passiveVoiceInstances.map((pv, i) => (
              <div key={i} className="flex gap-2 text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-red-500 line-through text-[11px]">{pv.original}</span>
                <span className="text-slate-400">→</span>
                <span className="text-emerald-600 font-bold">{pv.suggested}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grammar errors */}
      {grammarErrors?.length > 0 && (
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">📝 Grammar Corrections</p>
          <div className="space-y-2">
            {grammarErrors.map((ge, i) => (
              <div key={i} className="p-2 rounded-lg border border-red-100 bg-red-50">
                <p className="text-[10px] text-red-500 line-through">{ge.original}</p>
                <p className="text-xs text-emerald-700 font-bold">✓ {ge.correction}</p>
                {ge.rule && <p className="text-[9px] text-slate-400 mt-0.5">Rule: {ge.rule}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
