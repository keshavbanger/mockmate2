export default function ResumeGapAnalysis({ gaps }) {
  return (
    <div className="col-12 premium-card">
      <h3 className="section-header">Resume-Answer Gap Analysis</h3>
      
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Skill on Resume</th>
              <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Mentioned in Answers</th>
              <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Demonstrated Depth</th>
              <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((gap, idx) => (
              <tr key={idx} className="border-b border-border/50 group hover:bg-bg-primary/30 transition-colors">
                <td className="py-5 font-bold text-sm text-white">{gap.skill}</td>
                <td className="py-5">
                  <span className={`badge ${
                    gap.mentioned.includes('Never') ? 'badge-red' : 
                    gap.mentioned.includes('Briefly') ? 'badge-amber' : 'badge-green'
                  }`}>
                    {gap.mentioned}
                  </span>
                </td>
                <td className="py-5">
                  <span className={`text-[11px] font-bold ${
                    gap.depth === 'Strong' ? 'text-green-400' :
                    gap.depth === 'Shallow' ? 'text-amber-400' : 'text-slate-600'
                  }`}>
                    {gap.depth || '—'}
                  </span>
                </td>
                <td className="py-5 text-[11px] text-slate-400 font-medium">
                  {gap.recommendation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
