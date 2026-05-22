import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
});

const SCORE_COLOR = (s) =>
  s >= 85 ? { ring: 'border-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50' } :
  s >= 70 ? { ring: 'border-[var(--brand-primary)]', text: 'text-[var(--brand-primary)]', bg: 'bg-[var(--brand-light)]' } :
  s >= 50 ? { ring: 'border-amber-400', text: 'text-amber-600', bg: 'bg-amber-50' } :
            { ring: 'border-red-400', text: 'text-red-600', bg: 'bg-red-50' };

const VERDICT_ICONS = {
  'Strong fit': '🟢', 'Good fit': '🔵', 'Moderate fit': '🟡', 'Weak fit': '🔴',
};

const SUB_SCORES = [
  { label: 'Keyword',     key: 'keywordOverlapScore' },
  { label: 'Semantic',    key: 'semanticScore' },
  { label: 'Role Align',  key: 'roleAlignmentScore' },
  { label: 'Sections',    key: 'sectionScore' },
  { label: 'Format',      key: 'formattingScore' },
  { label: 'Metrics',     key: 'quantificationScore' },
];

function MiniScoreGauge({ score, label }) {
  const clamp  = Math.max(0, Math.min(100, score ?? 0));
  const radius = 36, circ = 2 * Math.PI * radius;
  const dash   = (clamp / 100) * circ;
  const c      = SCORE_COLOR(clamp);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="#F3E8FF" strokeWidth="10" />
          <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor"
            className={c.text}
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ / 4}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-black ${c.text}`}>{clamp}</span>
        </div>
      </div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">{label}</p>
    </div>
  );
}

function ReportColumn({ report, label, isWinner }) {
  if (!report) return null;
  const sc = SCORE_COLOR(report.finalScore ?? 0);

  return (
    <div className={`space-y-4 ${isWinner ? 'ring-2 ring-[var(--brand-primary)] ring-offset-4 rounded-3xl' : ''}`}>
      {/* Winner badge */}
      {isWinner && (
        <div className="flex justify-center">
          <span className="px-4 py-1.5 rounded-full text-xs font-black bg-[var(--brand-primary)] text-white uppercase tracking-widest shadow-lg shadow-purple-900/25">
            🏆 Winner
          </span>
        </div>
      )}

      {/* Score Card */}
      <div className={`premium-card flex flex-col items-center gap-4 py-8 border-2 ${sc.ring}`}>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <MiniScoreGauge score={report.finalScore} label="ATS Score" />
        <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border-2 ${sc.ring} ${sc.text} ${sc.bg}`}>
          {VERDICT_ICONS[report.verdict] || '⚪'} {report.verdict || 'N/A'}
        </div>
        {report.verdictReason && (
          <p className="text-xs text-slate-500 font-medium text-center leading-relaxed max-w-xs px-2">{report.verdictReason}</p>
        )}
      </div>

      {/* Sub-scores */}
      <div className="premium-card">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Score Breakdown</p>
        <div className="grid grid-cols-3 gap-3">
          {SUB_SCORES.map(({ label: lbl, key }) => {
            const val = report[key] ?? 0;
            return (
              <div key={key} className="flex flex-col items-center gap-1.5 p-2.5 bg-[#fafafa] rounded-xl border border-black/[0.04] text-center">
                <span className="text-xl font-black text-[#111]">{val}</span>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">{lbl}</p>
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[var(--brand-primary)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${val}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Keywords */}
      {(report.matchedKeywords?.length > 0 || report.missingKeywords?.length > 0) && (
        <div className="premium-card space-y-4">
          {report.matchedKeywords?.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">✓ Matched ({report.matchedKeywords.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {report.matchedKeywords.slice(0, 12).map((kw, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">{kw}</span>
                ))}
              </div>
            </div>
          )}
          {report.missingKeywords?.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-2">✗ Missing ({report.missingKeywords.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {report.missingKeywords.slice(0, 12).map((kw, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formatting risks */}
      {report.formattingRisks?.length > 0 && (
        <div className="premium-card">
          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-3">⚠ Formatting Risks</p>
          <ul className="space-y-2">
            {report.formattingRisks.map((risk, i) => (
              <li key={i} className="text-xs text-slate-600 font-medium flex items-start gap-2">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">▸</span>{risk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ATSComparePage() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const result    = state?.result;

  if (!result) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="text-center">
        <p className="text-2xl font-extrabold text-[#111] mb-3">No Comparison Data</p>
        <p className="text-slate-500 mb-8 text-sm">Please upload two resumes to compare.</p>
        <button onClick={() => navigate('/ats')}
          className="px-8 py-3 rounded-full bg-[var(--brand-primary)] text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-purple-900/20">
          ← Go to ATS Checker
        </button>
      </div>
    </div>
  );

  const { reportA, reportB, winner, keyDifferences } = result;

  return (
    <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif] overflow-x-hidden pb-28">

      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -left-60 w-[400px] h-[400px] bg-indigo-200/15 rounded-full blur-[100px]" />
      </div>

      {/* Navbar */}
      <div className="sticky top-0 z-50 flex justify-center pt-5 px-4 pointer-events-none">
        <nav className="w-full max-w-6xl pointer-events-auto floating-nav relative flex items-center justify-between bg-white/95 backdrop-blur-xl py-3 px-5 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          {/* Left: Logo & Back Button */}
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white text-sm font-bold">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
              </div>
              <span className="font-bold tracking-tight text-xl text-black">MockMate</span>
            </button>
            <div className="w-px h-6 bg-slate-200 hidden sm:block" />
            <button onClick={() => navigate(-1)} className="hidden sm:flex text-sm font-semibold text-slate-500 hover:text-black items-center gap-1 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back
            </button>
          </div>

          {/* Center: Page Title */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
              Resume Comparison
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/ats')}
              className="text-xs py-2.5 px-4 rounded-full border-[1.5px] border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-light)] transition-colors font-bold whitespace-nowrap">
              🔄 New Comparison
            </button>
          </div>
        </nav>
      </div>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        <motion.div {...fade(0)}>
          <p className="text-[10px] font-black text-[var(--brand-primary)] uppercase tracking-[0.25em] mb-3">⚖️ Resume Comparison</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#111] leading-tight mb-3">
            Head-to-Head <span className="gradient-text">Resume Battle</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium">Same job description · two resumes · one winner</p>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto px-6 space-y-8">

        {/* Winner Banner */}
        <motion.div {...fade(0.05)}>
          <div className={`premium-card text-center py-8 ${
            winner === 'tie'
              ? 'bg-slate-50 border-slate-200'
              : 'bg-gradient-to-br from-[var(--brand-light)] to-purple-50/60 border-purple-200/60'
          }`}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Result</p>
            {winner === 'tie' ? (
              <>
                <span className="text-5xl mb-3 block">🤝</span>
                <p className="text-2xl font-extrabold text-[#111]">It's a Tie!</p>
                <p className="text-sm text-slate-500 font-medium mt-2">Both resumes perform similarly for this job.</p>
              </>
            ) : (
              <>
                <span className="text-5xl mb-3 block">🏆</span>
                <p className="text-2xl font-extrabold text-[#111]">Resume {winner} Wins</p>
                <p className="text-sm text-slate-500 font-medium mt-2">
                  Resume {winner} is the stronger match for this job description.
                </p>
              </>
            )}
          </div>
        </motion.div>

        {/* Key Differences */}
        {keyDifferences?.length > 0 && (
          <motion.div {...fade(0.1)}>
            <div className="premium-card">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5">Key Differences</p>
              <ul className="space-y-3">
                {keyDifferences.map((diff, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 bg-[#fafafa] border border-black/[0.04] rounded-xl">
                    <span className="text-[var(--brand-primary)] font-black text-sm flex-shrink-0 mt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm text-slate-700 font-medium leading-relaxed">{diff}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

        {/* Side by side reports */}
        <motion.div {...fade(0.15)} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <ReportColumn report={reportA} label="Resume A" isWinner={winner === 'A'} />
          <ReportColumn report={reportB} label="Resume B" isWinner={winner === 'B'} />
        </motion.div>

        {/* CTA */}
        <motion.div {...fade(0.2)} className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button onClick={() => navigate('/ats')}
            className="px-8 py-3.5 rounded-full border border-black/10 text-slate-700 font-semibold text-sm hover:bg-zinc-50 transition-all">
            🔄 Check Another Resume
          </button>
          <button onClick={() => navigate('/setup')}
            className="px-8 py-3.5 rounded-full bg-[var(--brand-primary)] text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-purple-900/20">
            🎤 Practice Interview for this Job
          </button>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="mt-20 text-center py-10 px-6 border-t border-black/[0.04]">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em]">
          MockMate AI · ATS Resume Checker · Powered by Groq llama-3.3-70b
        </p>
      </div>
    </div>
  );
}
