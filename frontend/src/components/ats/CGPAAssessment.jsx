import { motion } from 'framer-motion';

export default function CGPAAssessment({ report }) {
  if (!report || !report.originalText) return null;

  const text = report.originalText;
  const match = text.match(/\b(?:cgpa|gpa)\b\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*\/?\s*(?:10|4)?/i);
  const cgpaVal = match ? parseFloat(match[1]) : null;

  if (!cgpaVal) return null;

  const isLow = cgpaVal < 7.0;
  const isModerate = cgpaVal >= 7.0 && cgpaVal < 8.0;

  return (
    <div className={`premium-card border-l-4 ${isLow ? 'border-l-red-500 bg-red-50/20' : isModerate ? 'border-l-amber-500 bg-amber-50/20' : 'border-l-emerald-500 bg-emerald-50/20'}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xl">{isLow ? '⚠️' : isModerate ? '📊' : '🎯'}</span>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Academic Cutoff Assessment</p>
          <h4 className="text-base font-extrabold text-[#111]">
            CGPA Reality Check: <span className="font-mono text-purple-700">{cgpaVal} / 10.0</span>
          </h4>
        </div>
      </div>

      <p className="text-xs text-slate-700 font-medium leading-relaxed mb-3">
        {isLow ? (
          <>
            A CGPA of <strong className="text-red-700">{cgpaVal}</strong> is below the screening cutoff (typically 7.0+) at most Tier-1 & Tier-2 product engineering teams in India.
          </>
        ) : isModerate ? (
          <>
            A CGPA of <strong>{cgpaVal}</strong> meets baseline requirements for most corporate shortlists, but product teams will still inspect project depth & proof-of-work.
          </>
        ) : (
          <>
            A CGPA of <strong className="text-emerald-700">{cgpaVal}</strong> passes initial automated filters with ease.
          </>
        )}
      </p>

      {isLow && (
        <div className="p-3 bg-white rounded-xl border border-red-100 shadow-sm">
          <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1.5">Mandatory Compensation Strategy</p>
          <ul className="text-xs space-y-1 text-slate-700">
            <li className="flex items-start gap-2"><span className="text-red-500">1.</span> Highlight quantifiable impact in projects & open-source contributions.</li>
            <li className="flex items-start gap-2"><span className="text-red-500">2.</span> Feature production internship experience or national competition ranks at the top.</li>
            <li className="flex items-start gap-2"><span className="text-red-500">3.</span> Ensure live GitHub repositories demonstrate system architectural depth.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
