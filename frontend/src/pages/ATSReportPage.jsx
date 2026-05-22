import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getATSReport, downloadImprovedResume } from '../utils/api.js';
import ATSScoreGauge              from '../components/ats/ATSScoreGauge.jsx';
import KeywordPanel               from '../components/ats/KeywordPanel.jsx';
import SectionHealth              from '../components/ats/SectionHealth.jsx';
import FormattingRisks            from '../components/ats/FormattingRisks.jsx';
import BulletRewrites             from '../components/ats/BulletRewrites.jsx';
import TailoredSummary            from '../components/ats/TailoredSummary.jsx';
import RoleLevelGap               from '../components/ats/RoleLevelGap.jsx';
import QuantificationSuggestions  from '../components/ats/QuantificationSuggestions.jsx';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
});

const SUB_SCORES = [
  { label: 'Keyword Overlap', key: 'keywordOverlapScore', color: 'bg-[var(--brand-primary)]' },
  { label: 'Semantic Match',  key: 'semanticScore',       color: 'bg-violet-400' },
  { label: 'Role Alignment',  key: 'roleAlignmentScore',  color: 'bg-indigo-400' },
  { label: 'Section Health',  key: 'sectionScore',        color: 'bg-emerald-400' },
  { label: 'Formatting',      key: 'formattingScore',     color: 'bg-amber-400' },
  { label: 'Quantification',  key: 'quantificationScore', color: 'bg-slate-400' },
];

const VERDICT_CONFIG = {
  'Strong fit':   { icon: '🟢', pill: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  'Good fit':     { icon: '🔵', pill: 'text-[var(--brand-primary)] bg-[var(--brand-light)] border-purple-200' },
  'Moderate fit': { icon: '🟡', pill: 'text-amber-700 bg-amber-50 border-amber-200' },
  'Weak fit':     { icon: '🔴', pill: 'text-red-600 bg-red-50 border-red-200' },
};

export default function ATSReportPage() {
  const { reportId } = useParams();
  const navigate     = useNavigate();
  const [report,    setReport]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [dlLoading, setDlLoading] = useState(false);

  useEffect(() => {
    if (!reportId) return;
    (async () => {
      try   { setReport(await getATSReport(reportId)); }
      catch (err) { setError(err.message || 'Failed to load report'); }
      finally { setLoading(false); }
    })();
  }, [reportId]);

  const handleDownload = async () => {
    setDlLoading(true);
    try { await downloadImprovedResume(reportId); }
    catch (e) { alert('Download failed: ' + e.message); }
    finally { setDlLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
        <p className="text-xs font-black text-[var(--brand-primary)] uppercase tracking-widest">Loading Report…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="text-center">
        <p className="text-2xl font-extrabold text-[#111] mb-3">Report Not Found</p>
        <p className="text-slate-500 mb-8 text-sm">{error}</p>
        <button onClick={() => navigate('/ats')}
          className="px-8 py-3 rounded-full bg-[var(--brand-primary)] text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-purple-900/20">
          ← Try Again
        </button>
      </div>
    </div>
  );

  if (!report) return null;

  const cfg = VERDICT_CONFIG[report.verdict] || VERDICT_CONFIG['Moderate fit'];

  return (
    <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif] overflow-x-hidden pb-28">

      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -left-60 w-[400px] h-[400px] bg-indigo-200/15 rounded-full blur-[100px]" />
      </div>

      {/* Sticky Navbar */}
      <div className="sticky top-0 z-50 flex justify-center pt-5 px-4 pointer-events-none">
        <nav className="w-full max-w-6xl pointer-events-auto floating-nav relative flex items-center justify-between shadow-[0_8px_30px_rgba(0,0,0,0.06)] bg-white/95 backdrop-blur-xl py-3 px-5 rounded-2xl">
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
              ATS Analysis Report
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/ats')}
              className="text-xs py-2.5 px-4 rounded-full border-[1.5px] border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-light)] transition-colors font-bold whitespace-nowrap">
              🔄 Check Another
            </button>
            <button onClick={handleDownload} disabled={dlLoading}
              className="text-xs py-2.5 px-5 rounded-full bg-[#111827] hover:bg-black text-white font-bold transition-colors shadow-sm disabled:opacity-60 whitespace-nowrap">
              {dlLoading ? '⏳ Generating…' : '⬇️ Download DOCX'}
            </button>
          </div>
        </nav>
      </div>

      {/* Hero Banner */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        <motion.div {...fade(0)}>
          <p className="text-[10px] font-black text-[var(--brand-primary)] uppercase tracking-[0.25em] mb-3">✨ ATS Resume Checker</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#111] leading-tight mb-3">
            Job Fit <span className="gradient-text">Analysis Report</span>
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-500 font-medium">
              Report <span className="font-bold text-slate-700 font-mono text-xs">{report.reportId?.slice(0, 18)}…</span>
            </span>
            {report.timestamp && (
              <span className="text-xs text-slate-400">
                · {new Date(report.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            {!report.aiAnalysisAvailable && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">
                ⚠ Deterministic only — AI unavailable
              </span>
            )}
          </div>
        </motion.div>
      </div>

      {/* Content Grid */}
      <div className="max-w-6xl mx-auto px-6 space-y-6">

        {/* Row 1 — Score + Verdict */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div {...fade(0.05)} className="md:col-span-1">
            <ScoreCard score={report.finalScore} />
          </motion.div>
          <motion.div {...fade(0.1)} className="md:col-span-2">
            <VerdictPanel
              verdict={report.verdict}
              verdictReason={report.verdictReason}
              strengthLines={report.strengthLines}
              cfg={cfg}
              onDownload={handleDownload}
              dlLoading={dlLoading}
              onPractice={() => navigate('/setup')}
            />
          </motion.div>
        </div>

        {/* Row 2 — Sub-scores */}
        <motion.div {...fade(0.15)}>
          <SubScoreRow report={report} />
        </motion.div>

        {/* Row 3 — Keywords */}
        <motion.div {...fade(0.2)}>
          <KeywordPanel matched={report.matchedKeywords} missing={report.missingKeywords} />
        </motion.div>

        {/* Row 4 — Tailored Summary */}
        {report.aiAnalysisAvailable && (
          <motion.div {...fade(0.22)}>
            <TailoredSummary summary={report.tailoredSummary} />
          </motion.div>
        )}

        {/* Row 5 — Section Health + Formatting */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div {...fade(0.25)}>
            <SectionHealth sectionFeedback={report.sectionFeedback} skillDepthMap={report.skillDepthMap} />
          </motion.div>
          <motion.div {...fade(0.28)}>
            <FormattingRisks risks={report.formattingRisks} />
          </motion.div>
        </div>

        {/* Row 6 — Role Level Gap */}
        {report.aiAnalysisAvailable && report.roleLevelGap && (
          <motion.div {...fade(0.30)}>
            <RoleLevelGap roleLevelGap={report.roleLevelGap} />
          </motion.div>
        )}

        {/* Row 7 — Bullet Rewrites */}
        <motion.div {...fade(0.32)}>
          <BulletRewrites rewrites={report.bulletRewrites} />
        </motion.div>

        {/* Row 8 — Quantification Suggestions */}
        {report.aiAnalysisAvailable && (
          <motion.div {...fade(0.34)}>
            <QuantificationSuggestions suggestions={report.quantificationSuggestions} />
          </motion.div>
        )}
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

/* ── Inline sub-components ─────────────────────────────────────────────────── */

function ScoreCard({ score = 0 }) {
  const clamp  = Math.max(0, Math.min(100, score));
  const radius = 54, circ = 2 * Math.PI * radius;
  const dash   = (clamp / 100) * circ;
  const { color, label, pill } =
    clamp >= 85 ? { color: '#10B981', label: 'Strong Match',   pill: 'text-emerald-700 bg-emerald-50 border-emerald-200' } :
    clamp >= 70 ? { color: '#6B46C1', label: 'Good Match',     pill: 'text-[var(--brand-primary)] bg-[var(--brand-light)] border-purple-200' } :
    clamp >= 50 ? { color: '#F59E0B', label: 'Moderate Match', pill: 'text-amber-700 bg-amber-50 border-amber-200' } :
                  { color: '#EF4444', label: 'Weak Match',     pill: 'text-red-600 bg-red-50 border-red-200' };

  return (
    <div className="premium-card h-full flex flex-col items-center justify-center gap-5 py-10">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ATS Score</p>
      <div className="relative">
        <svg width="148" height="148" viewBox="0 0 148 148">
          <circle cx="74" cy="74" r={radius} fill="none" stroke="#F3E8FF" strokeWidth="14" />
          <circle cx="74" cy="74" r={radius} fill="none" stroke={color} strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ / 4}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-[#111]">{clamp}</span>
          <span className="text-xs font-bold text-slate-400">/100</span>
        </div>
      </div>
      <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${pill}`}>{label}</span>
    </div>
  );
}

function VerdictPanel({ verdict, verdictReason, strengthLines, cfg, onDownload, dlLoading, onPractice }) {
  return (
    <div className="premium-card h-full flex flex-col gap-5">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Overall Verdict</p>
      <div className="flex items-center gap-4">
        <span className="text-4xl">{cfg.icon}</span>
        <div>
          <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-wide border mb-2 ${cfg.pill}`}>{verdict}</span>
          {verdictReason && <p className="text-sm text-slate-600 font-medium leading-relaxed max-w-md">{verdictReason}</p>}
        </div>
      </div>
      {strengthLines?.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-[var(--brand-primary)] uppercase tracking-widest mb-3">Top Resume Strengths</p>
          <ul className="space-y-2">
            {strengthLines.map((line, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="h-5 w-5 flex-shrink-0 mt-0.5 rounded-full bg-[var(--brand-light)] text-[var(--brand-primary)] flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                <span className="text-sm text-slate-700 font-medium leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mt-auto pt-3 border-t border-black/[0.04]">
        <button onClick={onDownload} disabled={dlLoading}
          className="flex-1 min-w-[140px] py-2.5 rounded-full bg-[var(--brand-primary)] text-white text-xs font-bold
                     uppercase tracking-widest hover:opacity-90 transition-all shadow-sm shadow-purple-900/20 disabled:opacity-60">
          {dlLoading ? '⏳ Generating…' : '⬇️ Download Improved Resume'}
        </button>
        <button onClick={onPractice}
          className="flex-1 min-w-[140px] py-2.5 rounded-full bg-[#111827] text-white text-xs font-bold
                     uppercase tracking-widest hover:bg-black transition-all shadow-sm">
          🎤 Practice Interview
        </button>
      </div>
    </div>
  );
}

function SubScoreRow({ report }) {
  return (
    <div className="premium-card">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Score Breakdown</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {SUB_SCORES.map(({ label, key, color }) => {
          const val = report[key] ?? 0;
          return (
            <div key={key} className="flex flex-col items-center gap-2 p-4 bg-[#fafafa] border border-black/[0.04] rounded-2xl text-center">
              <span className="text-3xl font-black text-[#111]">{val}</span>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${val}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
