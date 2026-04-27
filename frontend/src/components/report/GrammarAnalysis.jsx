export default function GrammarAnalysis({ analysis }) {
  return (
    <div className="col-6 premium-card">
      <h3 className="section-header">Grammar Analysis</h3>
      
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Grammar Score" value={analysis.score} icon="🎯" color="purple" />
        <StatCard label="Total Errors" value={analysis.errors} icon="❌" color="red" />
        <StatCard label="Tense Issues" value={analysis.tenseIssues} icon="⏳" color="amber" />
        <StatCard label="Complexity" value={`${analysis.complexity}%`} icon="🧠" color="blue" />
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {analysis.corrections.map((item, idx) => (
          <div key={idx} className="bg-bg-primary/50 border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 font-mono">[{item.timestamp}]</span>
              <span className="badge badge-purple">{item.rule}</span>
            </div>
            
            <div className="space-y-3 font-medium text-sm leading-relaxed">
              <div className="relative pl-4 border-l-2 border-red-500/30">
                <p className="text-slate-400 line-through decoration-red-500/50">{item.original}</p>
                <div className="absolute top-0 left-[-2px] bottom-0 w-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              </div>
              
              <div className="relative pl-4 border-l-2 border-green-500/30">
                <p className="text-white">{item.corrected}</p>
                <div className="absolute top-0 left-[-2px] bottom-0 w-[2px] bg-green-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  const colors = {
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  };

  return (
    <div className={`p-4 rounded-2xl border ${colors[color]} text-center space-y-1`}>
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-lg font-black tracking-tight">{value}</div>
      <div className="text-[8px] font-black uppercase tracking-widest opacity-60">{label}</div>
    </div>
  );
}
