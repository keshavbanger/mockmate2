const SECTION_META = {
  summary:    { icon: '👤', label: 'Summary / Objective' },
  skills:     { icon: '🛠', label: 'Skills / Technologies' },
  experience: { icon: '💼', label: 'Work Experience' },
  projects:   { icon: '🚀', label: 'Projects / Portfolio' },
  education:  { icon: '🎓', label: 'Education' },
};

const STATUS_STYLES = {
  present: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', label: 'Present' },
  weak:    { badge: 'bg-amber-50  text-amber-700  border-amber-200',  dot: 'bg-amber-400',  label: 'Weak'    },
  missing: { badge: 'bg-red-50    text-red-600    border-red-200',    dot: 'bg-red-400',    label: 'Missing' },
};

const DEPTH_LABELS = { 1: 'Basic', 2: 'Intermediate', 3: 'Expert' };
const DEPTH_STYLES = {
  1: 'bg-slate-100 text-slate-500 border-slate-200',
  2: 'bg-blue-50 text-blue-600 border-blue-200',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function SectionHealth({ sectionFeedback = {}, skillDepthMap = {} }) {
  const sections = Object.entries(SECTION_META);

  return (
    <div className="premium-card h-full">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">
        Section Health
      </p>

      <div className="space-y-3">
        {sections.map(([key, meta]) => {
          const status = sectionFeedback[key] || 'missing';
          const style  = STATUS_STYLES[status] || STATUS_STYLES.missing;

          return (
            <div key={key}
              className="flex items-center justify-between gap-3 p-3.5
                         bg-[#fafafa] border border-black/[0.04] rounded-2xl">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg flex-shrink-0">{meta.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111] leading-tight">{meta.label}</p>
                  {/* Skill depth badges — only for skills section */}
                  {key === 'skills' && skillDepthMap && Object.keys(skillDepthMap).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Object.entries(skillDepthMap).slice(0, 5).map(([skill, depth]) => (
                        <span
                          key={skill}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${DEPTH_STYLES[depth] || DEPTH_STYLES[1]}`}
                        >
                          {skill} · {DEPTH_LABELS[depth] || 'Basic'}
                        </span>
                      ))}
                      {Object.keys(skillDepthMap).length > 5 && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-200">
                          +{Object.keys(skillDepthMap).length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <span className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${style.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                {style.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-5 pt-4 border-t border-black/[0.04]">
        {Object.entries(STATUS_STYLES).map(([status, s]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
