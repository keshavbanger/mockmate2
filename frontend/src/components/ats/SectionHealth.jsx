const STATUS_CONFIG = {
  present: { label: 'Present', pill: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  weak:    { label: 'Weak',    pill: 'text-amber-700 bg-amber-50 border-amber-200',       dot: 'bg-amber-400'   },
  missing: { label: 'Missing', pill: 'text-red-600 bg-red-50 border-red-200',             dot: 'bg-red-400'     },
};

const SECTION_META = {
  summary:    { label: 'Professional Summary', icon: '📋' },
  skills:     { label: 'Skills',               icon: '⚡' },
  experience: { label: 'Work Experience',      icon: '💼' },
  projects:   { label: 'Projects',             icon: '🛠️' },
  education:  { label: 'Education',            icon: '🎓' },
};

export default function SectionHealth({ sectionFeedback = {} }) {
  return (
    <div className="premium-card h-full">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Resume Section Health</p>

      <div className="space-y-3">
        {Object.entries(SECTION_META).map(([key, meta]) => {
          const status = (sectionFeedback[key] || 'missing').toLowerCase();
          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.missing;
          return (
            <div key={key} className="flex items-center justify-between px-4 py-3 bg-[#fafafa] border border-black/[0.04] rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="text-lg">{meta.icon}</span>
                <span className="text-sm font-semibold text-[#111]">{meta.label}</span>
              </div>
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${cfg.pill}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
