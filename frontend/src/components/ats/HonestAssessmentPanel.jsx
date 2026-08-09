import { motion } from 'framer-motion';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
});

const BAND_STYLE = {
  Excellent:  'text-emerald-700 bg-emerald-50 border-emerald-200',
  Good:       'text-[var(--brand-primary)] bg-[var(--brand-light)] border-purple-200',
  Borderline: 'text-amber-700 bg-amber-50 border-amber-200',
  Weak:       'text-orange-700 bg-orange-50 border-orange-200',
  Poor:       'text-red-600 bg-red-50 border-red-200',
};

const SEVERITY_STYLE = {
  blocking: 'border-l-red-500 bg-red-50/40 text-red-700',
  high:     'border-l-orange-500 bg-orange-50/40 text-orange-700',
  medium:   'border-l-amber-500 bg-amber-50/40 text-amber-700',
  low:      'border-l-slate-400 bg-slate-50/60 text-slate-600',
};

const IMPACT_STYLE = {
  high:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low:    'bg-slate-50 text-slate-500 border-slate-200',
};

const DIMENSION_LABELS = [
  { key: 'eligibility',        label: 'Eligibility & Availability' },
  { key: 'skillCoverage',      label: 'JD Skill Coverage' },
  { key: 'projectEvidence',    label: 'Project / Delivery Evidence' },
  { key: 'relevantExperience', label: 'Relevant Experience' },
  { key: 'resumeCraft',        label: 'Resume Craft & Parseability' },
  { key: 'softSkills',         label: 'Soft Skills & Collaboration' },
];

function ScoreBar({ score }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <motion.div className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }} animate={{ width: `${score}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }} />
    </div>
  );
}

export default function HonestAssessmentPanel({ assessment }) {
  if (!assessment || !assessment.dimensionScores) return null;

  const { dimensionScores, blockers = [], strengths = [], weaknesses = [],
          coverage, actionPlan = [], parseWarnings = [], recruiterAssessment,
          band, seniority } = assessment;

  const bandCls = BAND_STYLE[band] || BAND_STYLE.Borderline;

  return (
    <div className="space-y-6">

      {/* Blockers — always first if present, per the band table's own rule */}
      {blockers.length > 0 && (
        <motion.div {...fade(0)} className="premium-card border-2 border-red-200 bg-red-50/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🚫</span>
            <h3 className="text-base font-extrabold text-red-700">Blocking Issues</h3>
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-auto">Caps fit at Borderline</span>
          </div>
          <div className="space-y-3">
            {blockers.map((b, i) => (
              <div key={i} className={`border-l-4 rounded-r-xl p-4 ${SEVERITY_STYLE[b.severity?.toLowerCase()] || SEVERITY_STYLE.medium}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest">{b.severity}</span>
                  <span className="text-sm font-bold text-[#111]">{b.issue}</span>
                </div>
                {b.evidence && <p className="text-xs text-slate-600 mb-1"><span className="font-semibold">Evidence:</span> {b.evidence}</p>}
                {b.fix && <p className="text-xs text-slate-700"><span className="font-semibold">Fix:</span> {b.fix}</p>}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Dimension scores — the actual weighted rubric, JD-calibrated */}
      <motion.div {...fade(0.05)} className="premium-card">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">JD-Calibrated Rubric</p>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${bandCls}`}>
            {band} · {seniority === 'MID_SENIOR' ? 'Mid/Senior weights' : 'Fresher weights'}
          </span>
        </div>
        <h3 className="text-lg font-extrabold text-[#111] mb-4">Dimension Scores</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DIMENSION_LABELS.map(({ key, label }) => {
            const d = dimensionScores[key];
            if (!d) return null;
            return (
              <div key={key} className="p-3 bg-[#fafafa] border border-black/[0.04] rounded-2xl">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#111]">{label}</span>
                  <span className="text-sm font-black text-slate-700">{d.score}</span>
                </div>
                <ScoreBar score={d.score} />
                {d.reasoning && <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{d.reasoning}</p>}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Strengths + Weaknesses side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {strengths.length > 0 && (
          <motion.div {...fade(0.10)} className="premium-card">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-3">Strengths</p>
            <div className="space-y-3">
              {strengths.map((s, i) => (
                <div key={i} className="border-l-4 border-l-emerald-400 bg-emerald-50/30 rounded-r-xl p-3">
                  <p className="text-sm font-bold text-[#111] mb-1">{s.point}</p>
                  {s.evidenceFromResume && <p className="text-xs text-slate-600 mb-0.5">"{s.evidenceFromResume}"</p>}
                  {s.jdRequirementMet && <p className="text-[11px] text-emerald-700 font-semibold">Meets: {s.jdRequirementMet}</p>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {weaknesses.length > 0 && (
          <motion.div {...fade(0.13)} className="premium-card">
            <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-3">Weaknesses</p>
            <div className="space-y-3">
              {weaknesses.map((w, i) => (
                <div key={i} className={`border-l-4 rounded-r-xl p-3 ${SEVERITY_STYLE[w.severity?.toLowerCase()] || SEVERITY_STYLE.medium}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest">{w.severity}</span>
                    <p className="text-sm font-bold text-[#111]">{w.point}</p>
                  </div>
                  {w.jdRequirement && <p className="text-xs text-slate-600 mb-1">JD asks for: {w.jdRequirement}</p>}
                  {w.fix && <p className="text-xs text-slate-700"><span className="font-semibold">Fix:</span> {w.fix}</p>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Coverage: satisfied / unsatisfied / quick wins */}
      {coverage && (coverage.satisfied?.length > 0 || coverage.unsatisfied?.length > 0 || coverage.quickWins?.length > 0) && (
        <motion.div {...fade(0.16)} className="premium-card">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">JD Requirement Coverage</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <p className="text-xs font-black text-emerald-600 uppercase tracking-wide mb-2">✓ Satisfied</p>
              <ul className="space-y-2">
                {(coverage.satisfied || []).map((c, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-bold text-[#111]">{c.jdRequirement}</span>
                    {c.resumeEvidence && <p className="text-slate-500 mt-0.5">{c.resumeEvidence}</p>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-black text-red-500 uppercase tracking-wide mb-2">✗ Unsatisfied</p>
              <ul className="space-y-2">
                {(coverage.unsatisfied || []).map((c, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-bold text-[#111]">{c.jdRequirement}</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${c.importance === 'required' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                      {c.importance}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-black text-[var(--brand-primary)] uppercase tracking-wide mb-2">⚡ Quick Wins</p>
              <ul className="space-y-2">
                {(coverage.quickWins || []).map((q, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-bold text-[#111]">{q.skill}</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${q.gain === 'high' ? 'bg-[var(--brand-light)] text-[var(--brand-primary)]' : 'bg-slate-100 text-slate-500'}`}>
                      {q.gain} gain
                    </span>
                    {q.whyLikelyPresent && <p className="text-slate-500 mt-0.5">{q.whyLikelyPresent}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* Action plan */}
      {actionPlan.length > 0 && (
        <motion.div {...fade(0.19)} className="premium-card">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Action Plan</p>
          <div className="space-y-2">
            {actionPlan.map((step, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-[#fafafa] border border-black/[0.04] rounded-xl">
                <span className="h-6 w-6 flex-shrink-0 rounded-full bg-[var(--brand-light)] text-[var(--brand-primary)] flex items-center justify-center text-[11px] font-black">{i + 1}</span>
                <p className="flex-1 text-sm font-medium text-[#111]">{step.step}</p>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${IMPACT_STYLE[step.impact] || IMPACT_STYLE.low}`}>{step.impact} impact</span>
                <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">{step.effort}</span>
                {step.expectedGainPoints > 0 && (
                  <span className="text-[10px] font-black text-emerald-600 whitespace-nowrap">+{step.expectedGainPoints} pts</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Parse warnings */}
      {parseWarnings.length > 0 && (
        <motion.div {...fade(0.22)} className="premium-card border border-amber-200 bg-amber-50/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚠️</span>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em]">Parsing Notes</p>
          </div>
          <div className="space-y-2">
            {parseWarnings.map((w, i) => (
              <div key={i} className="text-xs">
                <span className="font-bold text-[#111]">{w.field}</span>
                {w.observed && <span className="text-slate-500"> — observed: {w.observed}</span>}
                {w.likelyCause && <p className="text-slate-500 mt-0.5">Likely cause: {w.likelyCause}</p>}
                {w.userAction && <p className="text-amber-700 font-semibold mt-0.5">{w.userAction}</p>}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recruiter assessment — the narrative verdict */}
      {recruiterAssessment && (
        <motion.div {...fade(0.25)} className="premium-card">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Recruiter Assessment</p>
          <p className="text-sm text-slate-700 font-medium leading-relaxed">{recruiterAssessment}</p>
        </motion.div>
      )}
    </div>
  );
}
