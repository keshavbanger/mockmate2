import { motion } from 'framer-motion';

export default function CoachingPlan({ coaching }) {
  return (
    <div className="col-6 premium-card">
      <h3 className="section-header">7-Day Coaching Plan</h3>
      
      <div className="flex items-center justify-between mb-8 bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl">
        <span className="text-[11px] font-black text-purple-400 uppercase tracking-widest">
          English Proficiency (CEFR)
        </span>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-white">{coaching.cefrLevel}</span>
          <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="text-2xl font-black text-purple-500">B2</span>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        {coaching.weekPlan.map((item, idx) => (
          <div key={idx} className="flex gap-4 group">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
              {idx !== coaching.weekPlan.length - 1 && <div className="w-0.5 flex-1 bg-border my-1" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.day || item.days}</span>
                <span className="text-xs">{item.icon || '📝'}</span>
              </div>
              <p className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
                {item.task}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border">
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-green-500 uppercase tracking-widest">✅ Key Strengths</h4>
          <ul className="space-y-2">
            {coaching.strengths.map((s, i) => (
              <li key={i} className="text-[11px] text-slate-400 font-medium flex items-start gap-2">
                <span className="text-green-500 mt-0.5">●</span> {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest">⚠️ Areas to Improve</h4>
          <ul className="space-y-2">
            {coaching.weaknesses.map((w, i) => (
              <li key={i} className="text-[11px] text-slate-400 font-medium flex items-start gap-2">
                <span className="text-red-500 mt-0.5">●</span> {w}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
