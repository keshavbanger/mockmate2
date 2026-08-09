import React from 'react';
import { Target } from 'lucide-react';

const ExecutiveSummary = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="premium-card mb-6">
      <div className="flex items-center gap-3 mb-4 border-b border-black/[0.04] pb-4">
        <div className="p-2 bg-[var(--brand-light)] rounded-lg">
          <Target className="w-6 h-6 text-[var(--brand-primary)]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#111]">Recruiter's Honest Assessment</h2>
          <p className="text-sm text-slate-500 font-medium">Executive Summary</p>
        </div>
      </div>
      <div className="text-slate-700 font-medium leading-relaxed text-lg italic border-l-4 border-[var(--brand-primary)] pl-4 py-2">
        "{summary}"
      </div>
    </div>
  );
};

export default ExecutiveSummary;
