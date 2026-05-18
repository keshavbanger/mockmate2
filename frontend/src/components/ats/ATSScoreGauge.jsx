export default function ATSScoreGauge({ score = 0 }) {
  const clamp = Math.max(0, Math.min(100, score));

  const { color, label, bg } =
    clamp >= 85 ? { color: '#10B981', label: 'Strong Match',   bg: '#ECFDF5' } :
    clamp >= 70 ? { color: '#3B82F6', label: 'Good Match',     bg: '#EFF6FF' } :
    clamp >= 50 ? { color: '#F59E0B', label: 'Moderate Match', bg: '#FFFBEB' } :
                  { color: '#EF4444', label: 'Weak Match',      bg: '#FEF2F2' };

  // SVG circle gauge
  const radius  = 54;
  const circ    = 2 * Math.PI * radius;
  const dash    = (clamp / 100) * circ;
  const gap     = circ - dash;

  return (
    <div className="premium-card h-full flex flex-col items-center justify-center gap-4 py-8">
      <h3 className="section-title w-full">ATS Score</h3>

      <div className="relative flex items-center justify-center">
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* Track */}
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#F1F5F9" strokeWidth="12" />
          {/* Progress */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={circ / 4}
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-black text-slate-900">{clamp}</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">/100</span>
        </div>
      </div>

      <div className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest"
           style={{ backgroundColor: bg, color }}>
        {label}
      </div>

      {/* Sub-score legend */}
      <div className="w-full mt-2 grid grid-cols-2 gap-2 text-center">
        {[
          { label: 'Semantic',    key: 'semanticScore' },
          { label: 'Role Fit',   key: 'roleAlignmentScore' },
          { label: 'Keywords',   key: 'keywordOverlapScore' },
          { label: 'Sections',   key: 'sectionScore' },
        ].map(({ label }) => (
          <div key={label} className="p-2 bg-slate-50 border border-slate-100 rounded-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
