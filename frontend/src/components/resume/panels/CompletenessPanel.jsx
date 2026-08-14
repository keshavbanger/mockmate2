import React from 'react';
import { CheckCircle2, Circle, TrendingUp } from 'lucide-react';
import { getCompletenessScore } from '../../../utils/atsAnalyzer';

export default function CompletenessPanel({ resumeData }) {
  const { percent, checks, suggestions } = getCompletenessScore(resumeData);

  const color = percent >= 80 ? 'text-emerald-600' : percent >= 50 ? 'text-amber-600' : 'text-red-600';
  const barColor = percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
      {/* Score header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" /> Resume Completeness
        </h3>
        <span className={`text-xl font-extrabold ${color}`}>{percent}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="space-y-2.5 pt-1">
        {checks.map((check) => (
          <div key={check.key} className="flex items-center gap-2.5 text-xs">
            {check.done
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              : <Circle className="w-4 h-4 text-slate-300 shrink-0" />}
            <span className={check.done ? 'text-slate-800 font-semibold' : 'text-slate-500'}>{check.label}</span>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suggestions to reach 100%</p>
          {suggestions.map((sug, idx) => (
            <p key={idx} className="text-xs text-purple-900 bg-purple-50 px-3 py-2 rounded-xl border border-purple-200/80 font-medium">
              💡 {sug}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
