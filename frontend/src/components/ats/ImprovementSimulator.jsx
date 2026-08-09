import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ImprovementSimulator({ scenarios }) {
  const [applied, setApplied] = useState(new Set());
  if (!scenarios?.length) return null;

  const baseScore = scenarios[0]?.currentScore ?? 0;
  const projectedScore = Math.min(100,
    baseScore + Array.from(applied).reduce((sum, name) => {
      const sc = scenarios.find(s => s.scenarioName === name);
      return sum + (sc?.scoreGain ?? 0);
    }, 0)
  );
  const totalPossibleGain = scenarios.reduce((s, sc) => s + sc.scoreGain, 0);

  const toggle = (name) => {
    setApplied(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const EFFORT_COLOR = { '5 minutes': 'bg-emerald-100 text-emerald-700', '10 minutes': 'bg-emerald-100 text-emerald-700', '15 minutes': 'bg-blue-100 text-blue-700', '20 minutes': 'bg-blue-100 text-blue-700', '30 minutes': 'bg-amber-100 text-amber-700' };

  return (
    <div className="premium-card">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">What-If Improvement Simulator</p>
      <p className="text-xs text-slate-500 mb-5">Check fixes to see your projected score</p>

      {/* Score display */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-[#fafafa] border border-black/[0.04]">
        <div className="text-center">
          <p className="text-3xl font-black text-slate-700">{baseScore}</p>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest">Current</p>
        </div>
        <div className="flex items-center justify-center">
          <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <div className="text-center">
          <motion.p
            key={projectedScore}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-3xl font-black text-[var(--brand-primary)]">{projectedScore}</motion.p>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest">Projected</p>
        </div>
      </div>

      {applied.size > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-bold">
          +{projectedScore - baseScore} pts from {applied.size} fix{applied.size > 1 ? 'es' : ''} applied
        </div>
      )}

      {/* Scenario list */}
      <div className="space-y-2">
        {scenarios.map((sc) => {
          const isOn = applied.has(sc.scenarioName);
          const effortColor = EFFORT_COLOR[sc.effort] || 'bg-slate-100 text-slate-600';
          return (
            <label key={sc.scenarioName}
              className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                isOn ? 'border-[var(--brand-primary)] bg-[var(--brand-light)]' : 'border-slate-100 hover:border-purple-200'
              }`}>
              <input type="checkbox" className="mt-1 accent-purple-600 flex-shrink-0"
                checked={isOn} onChange={() => toggle(sc.scenarioName)} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-800">{sc.scenarioName}</span>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">+{sc.scoreGain} pts</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${effortColor}`}>{sc.effort}</span>
                  <span className="text-[10px] text-slate-400">{sc.confidence}% confidence</span>
                </div>
                <p className="text-xs text-slate-600">{sc.fix}</p>
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-4 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px] text-slate-500">
        💡 Apply all {scenarios.length} fixes to gain up to <strong className="text-[var(--brand-primary)]">+{totalPossibleGain} pts</strong>
      </div>
    </div>
  );
}
