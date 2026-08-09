const FIELD_LABELS = [
  { key: 'detectedName',     label: 'Name',     icon: '👤', critical: true },
  { key: 'detectedEmail',    label: 'Email',    icon: '📧', critical: true },
  { key: 'detectedPhone',    label: 'Phone',    icon: '📱', critical: true },
  { key: 'detectedGithub',   label: 'GitHub',   icon: '💻', critical: true },
  { key: 'detectedLinkedin', label: 'LinkedIn', icon: '🔗', critical: false },
  { key: 'detectedLocation', label: 'Location', icon: '📍', critical: false },
  { key: 'detectedEducation', label: 'Education', icon: '🎓', critical: false },
];

const isDetected = (val) => val && !val.includes('NOT DETECTED');

export default function ATSParserPreview({ parserPreview }) {
  if (!parserPreview) return null;
  const { detectedSkills, detectedExperience, detectedProjects, totalKeywordsDetected, parsingWarnings } = parserPreview;

  const detected = FIELD_LABELS.filter(f => isDetected(parserPreview[f.key]));
  const missing  = FIELD_LABELS.filter(f => !isDetected(parserPreview[f.key]));

  return (
    <div className="premium-card">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">ATS Parser Preview</p>
      <p className="text-xs text-slate-500 mb-5">What Workday, Taleo, and Greenhouse actually extract from your resume</p>

      {/* Contact info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {FIELD_LABELS.map(({ key, label, icon, critical }) => {
          const val = parserPreview[key];
          const ok  = isDetected(val);
          return (
            <div key={key} className={`p-2 rounded-xl border text-xs ${
              ok ? 'border-emerald-200 bg-emerald-50' : critical ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'
            }`}>
              <div className="flex items-center gap-1 mb-1">
                <span>{icon}</span>
                <span className={`text-[9px] font-black uppercase tracking-widest ${ok ? 'text-emerald-600' : critical ? 'text-red-600' : 'text-slate-500'}`}>{label}</span>
                <span className="ml-auto text-[10px]">{ok ? '✅' : critical ? '❌' : '⚠️'}</span>
              </div>
              <p className={`font-mono text-[10px] truncate ${ok ? 'text-emerald-800' : 'text-slate-400 italic'}`}>
                {ok ? val : 'Not found'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Keyword count */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="px-3 py-1.5 rounded-full border border-purple-200 bg-purple-50 text-xs font-bold text-purple-700">
          🔑 {totalKeywordsDetected} keywords detected
        </div>
        {detectedSkills?.slice(0, 5).map(s => (
          <span key={s} className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{s}</span>
        ))}
        {detectedSkills?.length > 5 && (
          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">+{detectedSkills.length - 5} more</span>
        )}
      </div>

      {/* Experience/Projects detected */}
      {(detectedExperience?.length > 0 || detectedProjects?.length > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {detectedExperience?.length > 0 && (
            <div className="p-3 rounded-xl bg-[#fafafa] border border-black/[0.04]">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Experience Entries</p>
              {detectedExperience.map((e, i) => <p key={i} className="text-xs text-slate-700 truncate mb-0.5">· {e}</p>)}
            </div>
          )}
          {detectedProjects?.length > 0 && (
            <div className="p-3 rounded-xl bg-[#fafafa] border border-black/[0.04]">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Projects Detected</p>
              {detectedProjects.map((p, i) => <p key={i} className="text-xs text-slate-700 truncate mb-0.5">· {p}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Parsing warnings */}
      {parsingWarnings?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black text-red-600 uppercase tracking-widest">⚠️ ATS Parsing Warnings</p>
          {parsingWarnings.map((w, i) => (
            <div key={i} className="flex gap-2 p-2.5 rounded-lg border border-red-200 bg-red-50">
              <span className="text-red-500 text-sm flex-shrink-0">!</span>
              <p className="text-xs text-red-700">{w}</p>
            </div>
          ))}
        </div>
      )}

      {parsingWarnings?.length === 0 && (
        <div className="flex gap-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
          <span className="text-lg">✅</span>
          <p className="text-xs text-emerald-700 font-medium">No ATS parsing warnings detected. Resume format is compatible.</p>
        </div>
      )}
    </div>
  );
}
