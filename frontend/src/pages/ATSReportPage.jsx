import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getATSReport, downloadImprovedResume } from '../utils/api.js';

// Existing components
import HonestScoreGauge           from '../components/report/HonestScoreGauge.jsx';
import KeywordPanel               from '../components/ats/KeywordPanel.jsx';
import SectionHealth              from '../components/ats/SectionHealth.jsx';
import FormattingRisks            from '../components/ats/FormattingRisks.jsx';
import BulletRewrites             from '../components/ats/BulletRewrites.jsx';
import TailoredSummary            from '../components/ats/TailoredSummary.jsx';
import RoleLevelGap               from '../components/ats/RoleLevelGap.jsx';
import ResumeGeneratorWizard      from '../components/ats/ResumeGeneratorWizard.jsx';

// NEW enhanced components
import EnhancedExecutiveSummaryCard from '../components/ats/EnhancedExecutiveSummaryCard.jsx';
import ATSParserPreview             from '../components/ats/ATSParserPreview.jsx';
import KeywordIntelligence          from '../components/ats/KeywordIntelligence.jsx';
import ConsistencyChecker           from '../components/ats/ConsistencyChecker.jsx';
import ImprovementSimulator         from '../components/ats/ImprovementSimulator.jsx';
import WritingAnalysisPanel         from '../components/ats/WritingAnalysisPanel.jsx';
import CompanyReadiness             from '../components/ats/CompanyReadiness.jsx';
import HonestScoreBreakdown         from '../components/ats/HonestScoreBreakdown.jsx';
import CGPAAssessment               from '../components/ats/CGPAAssessment.jsx';
// JD-calibrated assessment (dimension scores, blockers, coverage, action plan)
import HonestAssessmentPanel        from '../components/ats/HonestAssessmentPanel.jsx';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
});

const SUB_SCORES = [
  { label: 'Keyword Overlap', key: 'keywordOverlapScore', color: 'bg-[var(--brand-primary)]' },
  { label: 'Section Health',  key: 'sectionScore',        color: 'bg-emerald-400' },
  { label: 'Formatting',      key: 'formattingScore',     color: 'bg-amber-400' },
  { label: 'Quantification',  key: 'quantificationScore', color: 'bg-slate-400' },
  { label: 'Action Verbs',    key: 'actionVerbScore',     color: 'bg-pink-400' },
  { label: 'Consistency',     key: 'consistencyScore',    color: 'bg-cyan-400' },
];

const VERDICT_CONFIG = {
  'Strong Fit':     { icon: '🟢', pill: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  'Good Fit':       { icon: '🔵', pill: 'text-[var(--brand-primary)] bg-[var(--brand-light)] border-purple-200' },
  'Borderline Fit': { icon: '🟡', pill: 'text-amber-700 bg-amber-50 border-amber-200' },
  'Weak Fit':       { icon: '🟠', pill: 'text-orange-600 bg-orange-50 border-orange-200' },
  'Not a Fit':      { icon: '🔴', pill: 'text-red-600 bg-red-50 border-red-200' },
};

export default function ATSReportPage() {
  const { reportId } = useParams();
  const navigate     = useNavigate();
  const [report,      setReport]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [dlLoading,   setDlLoading]   = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);

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

  const cfg = VERDICT_CONFIG[report.verdict] || VERDICT_CONFIG['Borderline Fit'];

  return (
    <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif] overflow-x-hidden pb-28">

      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -left-60 w-[400px] h-[400px] bg-indigo-200/15 rounded-full blur-[100px]" />
      </div>

      {/* Sticky Navbar */}
      <div className="sticky top-0 z-50 flex justify-center pt-5 px-4 pointer-events-none print:hidden">
        <nav className="w-full max-w-6xl pointer-events-auto floating-nav relative flex items-center justify-between shadow-[0_8px_30px_rgba(0,0,0,0.06)] bg-white/95 backdrop-blur-xl py-3 px-5 rounded-2xl">
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

          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">ATS Analysis Report</span>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/ats')}
              className="text-xs py-2.5 px-4 rounded-full border-[1.5px] border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-light)] transition-colors font-bold whitespace-nowrap">
              🔄 Check Another
            </button>
            <button onClick={() => setShowGenModal(true)}
              className="text-xs py-2.5 px-5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold transition-all shadow-md shadow-purple-200 hover:opacity-90 whitespace-nowrap">
              ✨ Generate Resume
            </button>
            <div className="relative group">
              <button disabled={dlLoading}
                className="text-xs py-2.5 px-5 rounded-full bg-[#111827] hover:bg-black text-white font-bold transition-colors shadow-sm disabled:opacity-60 whitespace-nowrap flex items-center gap-2">
                {dlLoading ? '⏳ Generating…' : '⬇️ Download'}
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col overflow-hidden z-50 transform origin-top-right group-hover:scale-100 scale-95">
                <button onClick={handleDownload} disabled={dlLoading}
                  className="px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                  ⬇️ Download Resume (DOCX)
                </button>
                <div className="h-px bg-slate-50 w-full" />
                <button onClick={() => window.print()}
                  className="px-4 py-3 text-left text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2 transition-colors">
                  📄 Export Report (PDF)
                </button>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* Hero */}
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

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 space-y-6">

        {/* 1. Enhanced Executive Summary */}
        {report.aiAnalysisAvailable && report.enhancedSummary && (
          <motion.div {...fade(0.03)}>
            <EnhancedExecutiveSummaryCard enhancedSummary={report.enhancedSummary} />
          </motion.div>
        )}

        {/* 2. Score + Verdict */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div {...fade(0.07)} className="md:col-span-1">
            <HonestScoreGauge score={report.finalScore} />
          </motion.div>
          <motion.div {...fade(0.10)} className="md:col-span-2">
            <VerdictPanel
              verdict={report.verdict} verdictReason={report.verdictReason}
              strengthLines={report.strengthLines} cfg={cfg}
              onDownload={handleDownload} dlLoading={dlLoading}
              onPractice={() => navigate('/setup')}
              onGenerate={() => setShowGenModal(true)}
            />
          </motion.div>
        </div>

        {/* 3. Honest 100-Point Score Breakdown */}
        <motion.div {...fade(0.12)}>
          <HonestScoreBreakdown report={report} />
        </motion.div>

        {/* 4. CGPA Reality Check */}
        <motion.div {...fade(0.14)}>
          <CGPAAssessment report={report} />
        </motion.div>

        {/* 5. Sub-score breakdown */}
        <motion.div {...fade(0.15)}>
          <SubScoreRow report={report} />
        </motion.div>

        {/* 4. Improvement Simulator */}
        {report.improvementScenarios?.length > 0 && (
          <motion.div {...fade(0.16)}>
            <ImprovementSimulator scenarios={report.improvementScenarios} />
          </motion.div>
        )}

        {/* 5. JD-Calibrated Assessment — dimension scores, blockers, strengths,
            weaknesses, coverage, action plan, parse warnings, recruiter read */}
        {report.aiAnalysisAvailable && report.honestAssessment && (
          <HonestAssessmentPanel assessment={report.honestAssessment} />
        )}

        {/* 8. ATS Parser Preview */}
        {report.parserPreview && (
          <motion.div {...fade(0.28)}>
            <ATSParserPreview parserPreview={report.parserPreview} />
          </motion.div>
        )}

        {/* 9. Keyword Intelligence (category-level) */}
        {report.categoryKeywords?.length > 0 && (
          <motion.div {...fade(0.31)}>
            <KeywordIntelligence categoryKeywords={report.categoryKeywords} />
          </motion.div>
        )}

        {/* 10. Keyword Panel (existing) */}
        <motion.div {...fade(0.34)}>
          <KeywordPanel matched={report.matchedKeywords} missing={report.missingKeywords} />
        </motion.div>

        {/* 11. Writing Analysis */}
        {report.writingAnalysis && (
          <motion.div {...fade(0.37)}>
            <WritingAnalysisPanel writingAnalysis={report.writingAnalysis} />
          </motion.div>
        )}

        {/* 12. Consistency Checker */}
        {report.consistencyCheck && (
          <motion.div {...fade(0.40)}>
            <ConsistencyChecker consistencyCheck={report.consistencyCheck} />
          </motion.div>
        )}

        {/* 13. Section Health */}
        <motion.div {...fade(0.43)}>
          <SectionHealth sectionFeedback={report.sectionFeedback} skillDepthMap={report.skillDepthMap} />
        </motion.div>

        {/* 15. Company Readiness */}
        {report.companyReadiness?.length > 0 && (
          <motion.div {...fade(0.49)}>
            <CompanyReadiness companies={report.companyReadiness} />
          </motion.div>
        )}

        {/* 16. Bullet Rewrites */}
        {report.aiAnalysisAvailable && (
          <motion.div {...fade(0.52)}>
            <BulletRewrites rewrites={report.bulletRewrites} />
          </motion.div>
        )}

        {/* 18. Role Level Gap */}
        {report.aiAnalysisAvailable && report.roleLevelGap && (
          <motion.div {...fade(0.58)}>
            <RoleLevelGap roleLevelGap={report.roleLevelGap} />
          </motion.div>
        )}

        {/* 21. Tailored Summary */}
        {report.aiAnalysisAvailable && (
          <motion.div {...fade(0.67)}>
            <TailoredSummary summary={report.tailoredSummary} />
          </motion.div>
        )}

        {/* 22. Formatting Risks */}
        <motion.div {...fade(0.70)}>
          <FormattingRisks risks={report.formattingRisks} />
        </motion.div>
      </div>

      {/* Footer */}
      <div className="mt-20 text-center py-10 px-6 border-t border-black/[0.04]">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em]">
          MockMate AI · ATS Resume Checker · Powered by Groq llama-3.3-70b
        </p>
      </div>

      {showGenModal && (
        <ResumeGeneratorWizard
          reportId={reportId}
          jd={report?.jobDescription || ''}
          onClose={() => setShowGenModal(false)}
        />
      )}
    </div>
  );
}

/* ── Inline sub-components ─────────────────────────────────────────────────── */

function VerdictPanel({ verdict, verdictReason, strengthLines, cfg, onDownload, dlLoading, onPractice, onGenerate }) {
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
      <div className="flex flex-wrap gap-3 mt-auto pt-3 border-t border-black/[0.04] print:hidden">
        <button onClick={() => onGenerate()}
          className="flex-1 min-w-[140px] py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-md shadow-purple-200">
          ✨ Generate My Resume
        </button>
        <div className="flex-1 min-w-[140px] relative group">
          <button disabled={dlLoading}
            className="w-full py-2.5 rounded-full bg-[var(--brand-primary)] text-white text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-sm shadow-purple-900/20 disabled:opacity-60 flex items-center justify-center gap-2">
            {dlLoading ? '⏳ Generating…' : '⬇️ Download'}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col overflow-hidden z-50 transform origin-bottom group-hover:scale-100 scale-95">
            <button onClick={onDownload} disabled={dlLoading} className="px-4 py-3 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors uppercase tracking-wider">⬇️ Download DOCX</button>
            <div className="h-px bg-slate-50 w-full" />
            <button onClick={() => window.print()} className="px-4 py-3 text-center text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors uppercase tracking-wider">📄 Export PDF</button>
          </div>
        </div>
        <button onClick={onPractice}
          className="flex-1 min-w-[140px] py-2.5 rounded-full bg-[#111827] text-white text-xs font-bold uppercase tracking-widest hover:bg-black transition-all shadow-sm">
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {SUB_SCORES.map(({ label, key, color }) => {
          const val = report[key] ?? 0;
          return (
            <div key={key} className="flex flex-col items-center gap-2 p-3 bg-[#fafafa] border border-black/[0.04] rounded-2xl text-center">
              <span className="text-2xl font-black text-[#111]">{val}</span>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div className={`h-full rounded-full ${color}`}
                  initial={{ width: 0 }} animate={{ width: `${val}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
