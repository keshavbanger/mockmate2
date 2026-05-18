export default function CoachingPlan({ coaching }) {
  return (
    <div className="premium-card h-full">
      <h3 className="section-title">Development Roadmap</h3>
      
      {/* CEFR Level Banner */}
      <div className="flex items-center justify-between mb-10 bg-slate-50 border border-slate-100 p-6 rounded-xl">
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">
            Communication Proficiency
          </span>
          <p className="text-xs text-slate-500 font-medium">Based on CEFR standard evaluation</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-3xl font-black text-slate-900">{coaching.cefrLevel || 'B2'}</span>
          <div className="h-8 w-px bg-slate-200" />
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded">Target: C1</span>
        </div>
      </div>

      <div className="space-y-6 mb-10">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">7-Day Action Plan</h4>
        {coaching.weekPlan?.map((item, idx) => (
          <div key={idx} className="flex gap-6 group">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-indigo-600 bg-white" />
              {idx !== coaching.weekPlan.length - 1 && <div className="w-px flex-1 bg-slate-100 my-2" />}
            </div>
            <div className="flex-1 pb-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.day || item.days}</span>
              </div>
              <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                {item.task}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-8 border-t border-slate-100">
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Key Strengths</h4>
          <ul className="space-y-3">
            {coaching.strengths?.map((s, i) => (
              <li key={i} className="text-xs text-slate-600 font-medium flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em]">Growth Areas</h4>
          <ul className="space-y-3">
            {coaching.weaknesses?.map((w, i) => (
              <li key={i} className="text-xs text-slate-600 font-medium flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
