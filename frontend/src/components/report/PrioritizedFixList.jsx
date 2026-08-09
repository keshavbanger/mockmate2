import React from 'react';
import { ListOrdered, Clock, Zap } from 'lucide-react';

const PrioritizedFixList = ({ fixes = [] }) => {
  if (!fixes || fixes.length === 0) return null;

  const sortedFixes = [...fixes].sort((a, b) => a.priority - b.priority);

  const getImpactColor = (impact) => {
    switch (impact?.toLowerCase()) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'medium': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'low': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="premium-card mb-8">
      <div className="flex items-center gap-3 mb-6 border-b border-black/[0.04] pb-4">
        <ListOrdered className="w-6 h-6 text-[var(--brand-primary)]" />
        <div>
          <h2 className="text-xl font-bold text-[#111]">Action Plan</h2>
          <p className="text-sm text-slate-500 font-medium">Prioritized step-by-step fix list</p>
        </div>
      </div>

      <div className="space-y-4">
        {sortedFixes.map((fix, idx) => (
          <div key={idx} className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white text-[var(--brand-primary)] font-black border border-slate-200 shadow-sm">
              {fix.priority}
            </div>
            
            <div className="flex-grow">
              <p className="text-slate-800 font-bold text-lg mb-2">{fix.action}</p>
              
              <div className="flex flex-wrap gap-3 mt-2">
                {fix.impact && (
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1 ${getImpactColor(fix.impact)}`}>
                    <Zap size={14} />
                    {fix.impact.toUpperCase()} IMPACT
                  </span>
                )}
                {fix.timeToFix && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-white text-slate-600 border border-slate-200 flex items-center gap-1 shadow-sm">
                    <Clock size={14} />
                    {fix.timeToFix}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrioritizedFixList;
