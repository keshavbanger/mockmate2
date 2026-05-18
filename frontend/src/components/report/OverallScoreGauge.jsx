import React from 'react';

export default function OverallScoreGauge({ score }) {
  const getLabel = (s) => {
    if (s >= 90) return 'Exceptional';
    if (s >= 75) return 'Strong';
    if (s >= 60) return 'Competent';
    return 'Developing';
  };

  const getLabelColor = (s) => {
    if (s >= 90) return 'text-emerald-600 bg-emerald-50';
    if (s >= 75) return 'text-indigo-600 bg-indigo-50';
    if (s >= 60) return 'text-amber-600 bg-amber-50';
    return 'text-slate-600 bg-slate-50';
  };

  return (
    <div className="premium-card flex flex-col justify-between">
      <div>
        <p className="kpi-label mb-6">Overall Assessment Score</p>
        <div className="flex items-baseline gap-3">
          <span className="kpi-value">{score}</span>
          <span className="text-xl font-bold text-slate-300">/ 100</span>
        </div>
      </div>
      
      <div className="mt-8 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${getLabelColor(score)}`}>
            {getLabel(score)}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified by AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
