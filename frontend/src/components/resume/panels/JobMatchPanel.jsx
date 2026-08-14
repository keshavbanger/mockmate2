import React, { useState } from 'react';
import { Briefcase, CheckCircle2, XCircle, Loader2, Search } from 'lucide-react';
import { analyzeJobMatch } from '../../../utils/atsAnalyzer';

export default function JobMatchPanel({ resumeData }) {
  const [jd, setJd] = useState('');
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = () => {
    if (!jd.trim()) return;
    setAnalyzing(true);
    setTimeout(() => {
      const res = analyzeJobMatch(resumeData, jd);
      setResult(res);
      setAnalyzing(false);
    }, 400);
  };

  const matchColor = result
    ? result.matchPercentage >= 70 ? 'text-emerald-600'
    : result.matchPercentage >= 45 ? 'text-amber-600'
    : 'text-red-600'
    : '';

  const barColor = result
    ? result.matchPercentage >= 70 ? 'bg-emerald-500'
    : result.matchPercentage >= 45 ? 'bg-amber-500'
    : 'bg-red-500'
    : 'bg-purple-600';

  return (
    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
      <div className="flex items-center gap-2 text-purple-600 font-bold text-sm border-b border-slate-100 pb-3">
        <Briefcase className="w-4 h-4" /> Tailor Resume to Job Description
      </div>

      <p className="text-xs text-slate-500 leading-relaxed font-medium">
        Paste a target job description below to calculate keyword overlap and identify critical missing skills.
      </p>

      <textarea
        rows={5}
        className="w-full bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 leading-relaxed resize-none transition"
        placeholder="Paste target job description here...&#10;&#10;e.g. We are looking for a Senior Software Engineer with experience in React, Node.js, AWS, and Distributed Systems..."
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />

      <button
        onClick={handleAnalyze}
        disabled={!jd.trim() || analyzing}
        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-[#6B46C1] hover:bg-[#5a3aa6] disabled:opacity-50 text-white rounded-full text-xs font-semibold shadow-md shadow-purple-900/15 transition active:scale-95"
      >
        {analyzing
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing Overlap...</>
          : <><Search className="w-4 h-4" /> Calculate Job Match</>
        }
      </button>

      {result && (
        <div className="space-y-4 pt-3 border-t border-slate-100">
          {/* Match percentage */}
          <div className="text-center space-y-2 bg-slate-50/70 p-4 rounded-xl border border-slate-200/60">
            <p className={`text-3xl font-extrabold ${matchColor}`}>{result.matchPercentage}%</p>
            <p className="text-xs text-slate-600 font-bold">Target Job Match Score</p>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className={`h-full transition-all duration-700 ${barColor}`} style={{ width: `${result.matchPercentage}%` }} />
            </div>
          </div>

          {/* Matched keywords */}
          {result.matched.length > 0 && (
            <div>
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Matched Keywords ({result.matched.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.matched.map((kw, i) => (
                  <span key={i} className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing keywords */}
          {result.missing.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-600" /> Missing Keywords ({result.missing.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.missing.map((kw, i) => (
                  <span key={i} className="text-xs bg-red-50 text-red-800 border border-red-200 px-2.5 py-1 rounded-full font-semibold">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Recommendations</p>
              <div className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="text-xs text-slate-800 bg-amber-50 border border-amber-200/80 p-3 rounded-xl font-medium">
                    💡 {rec}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
