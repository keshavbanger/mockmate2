import { motion } from 'framer-motion';

export default function RecruiterSimulation({ recruiterSimulation }) {
  if (!recruiterSimulation) return null;
  const {
    firstImpression, mostImpressiveSection, weakestSection,
    likelihoodToContinueReading, estimatedReadingTime,
    topConcerns, redFlags, positiveSignals, likelyQuestions,
    timeline, finalDecision, decisionReason, whatWouldChangeDecision, totalReadSeconds
  } = recruiterSimulation;

  const readColor = likelihoodToContinueReading === 'High' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : likelihoodToContinueReading === 'Medium' ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';

  const verdictBadge = (verdict) => {
    const v = (verdict || '').toLowerCase();
    if (v === 'continue' || v === 'shortlist' || v === 'pass') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">Continue</span>;
    }
    if (v === 'concern' || v === 'maybe') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-700 border border-amber-200">Concern</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-red-100 text-red-700 border border-red-200">Reject Signal</span>;
  };

  const decisionPill = (decision) => {
    const d = (decision || '').toLowerCase();
    if (d === 'shortlist') return <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500 text-white shadow-sm">🎯 Shortlist</span>;
    if (d === 'maybe') return <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500 text-white shadow-sm">🤔 Maybe / On Hold</span>;
    return <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-600 text-white shadow-sm">❌ Reject</span>;
  };

  return (
    <div className="premium-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recruiter Simulation</p>
          <h3 className="text-lg font-extrabold text-[#111]">10-Second Senior Recruiter Read-Through</h3>
        </div>
        {finalDecision && decisionPill(finalDecision)}
      </div>

      {/* First impression */}
      <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">⏱ First Impression</p>
          {totalReadSeconds > 0 && (
            <span className="text-[10px] font-bold text-purple-300">Spent ~{totalReadSeconds} seconds reviewing</span>
          )}
        </div>
        <p className="text-sm font-medium leading-relaxed">{firstImpression}</p>
        {decisionReason && (
          <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-300">
            <span className="font-bold text-amber-400">Decision Context:</span> {decisionReason}
          </div>
        )}
      </div>

      {/* Timeline Steps */}
      {timeline?.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Timeline Walkthrough</p>
          <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 pl-4">
            {timeline.map((step, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-purple-600 border-2 border-white shadow-sm" />
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-black text-purple-700 font-mono">{step.seconds}</span>
                  {verdictBadge(step.verdict)}
                </div>
                <p className="text-xs font-bold text-slate-800 mb-0.5">{step.action}</p>
                <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">"{step.thought}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className={`rounded-xl border p-3 text-center ${readColor}`}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1">Continue Reading</p>
          <p className="text-sm font-black">{likelihoodToContinueReading}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Est. Read Time</p>
          <p className="text-sm font-black text-slate-700">{estimatedReadingTime}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Best Section</p>
          <p className="text-xs font-bold text-emerald-700 leading-tight">{mostImpressiveSection}</p>
        </div>
      </div>

      {/* What would flip decision */}
      {whatWouldChangeDecision?.length > 0 && (
        <div className="mb-5 p-4 rounded-xl bg-purple-50 border border-purple-100">
          <p className="text-[10px] font-black text-purple-800 uppercase tracking-widest mb-2">💡 What Would Flip This Rejection to Shortlist</p>
          <ul className="space-y-1.5">
            {whatWouldChangeDecision.map((item, i) => (
              <li key={i} className="text-xs text-purple-900 font-medium flex gap-2">
                <span className="text-purple-600 font-bold">✓</span> {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Signals grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {positiveSignals?.length > 0 && (
          <div>
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">✅ Positive Signals</p>
            <ul className="space-y-1">
              {positiveSignals.map((s, i) => (
                <li key={i} className="text-xs text-slate-700 flex gap-2">
                  <span className="text-emerald-500 flex-shrink-0">›</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {redFlags?.length > 0 && (
          <div>
            <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-2">🚩 Red Flags</p>
            <ul className="space-y-1">
              {redFlags.map((f, i) => (
                <li key={i} className="text-xs text-slate-700 flex gap-2">
                  <span className="text-red-500 flex-shrink-0">›</span>{f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Top concerns */}
      {topConcerns?.length > 0 && (
        <div className="mb-5">
          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">⚠️ Recruiter Concerns</p>
          <div className="space-y-2">
            {topConcerns.map((c, i) => (
              <div key={i} className="flex gap-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <span className="text-[10px] font-black text-amber-600 bg-amber-100 rounded-full h-4 w-4 flex-shrink-0 flex items-center justify-center">{i + 1}</span>
                <p className="text-xs text-amber-800">{c}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Likely questions */}
      {likelyQuestions?.length > 0 && (
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">🎤 Questions You'll Be Asked</p>
          <div className="space-y-3">
            {likelyQuestions.map((q, i) => (
              <div key={i} className="p-3 rounded-xl bg-[#fafafa] border border-black/[0.04]">
                <p className="text-xs text-slate-500 mb-1 italic">Because: {q.reason}</p>
                <p className="text-sm font-bold text-slate-800">"{q.question}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
