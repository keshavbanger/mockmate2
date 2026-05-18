export default function GrammarAnalysis({ analysis }) {
  return (
    <div className="premium-card h-full">
      <h3 className="section-title">Linguistic Audit</h3>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Grammar Score" value={analysis.score} />
        <StatCard label="Detected Errors" value={analysis.errors} />
        <StatCard label="Tense Nuance" value={analysis.tenseIssues} />
        <StatCard label="Complexity" value={`${analysis.complexity}%`} />
      </div>

      <div className="space-y-4 max-h-[440px] overflow-y-auto pr-3 custom-scrollbar">
        {analysis.corrections?.map((item, idx) => (
          <div key={idx} className="border border-slate-100 rounded-xl p-6 bg-slate-50/30 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 font-mono tracking-tighter">TIMESTAMP: {item.timestamp}</span>
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded uppercase tracking-widest">{item.rule}</span>
            </div>
            
            <div className="space-y-3 font-medium text-sm leading-relaxed">
              <div className="relative pl-5 border-l-2 border-slate-200">
                <p className="text-slate-400 line-through decoration-slate-300">{item.original}</p>
                <div className="absolute top-0 left-[-2px] bottom-0 w-[2px] bg-slate-300" />
              </div>
              
              <div className="relative pl-5 border-l-2 border-indigo-500">
                <p className="text-slate-900 font-bold">{item.corrected}</p>
                <div className="absolute top-0 left-[-2px] bottom-0 w-[2px] bg-indigo-500" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="p-5 rounded-xl border border-slate-100 bg-white text-center space-y-1">
      <div className="text-2xl font-black text-slate-900 tracking-tight">{value}</div>
      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
    </div>
  );
}
