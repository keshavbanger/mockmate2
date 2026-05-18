import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterview } from '../context/InterviewContext.jsx';
import { reportData as mockData } from '../data/mockReportData.js';
import { getSession } from '../utils/api.js';

// Styles
import '../styles/report.css';
import '../styles/print.css';

// Components
import HeroBanner from '../components/report/HeroBanner.jsx';
import OverallScoreGauge from '../components/report/OverallScoreGauge.jsx';
import ScoreRingsRow from '../components/report/ScoreRingsRow.jsx';
import RadarChart from '../components/report/RadarChart.jsx';
import ConfidenceTrendChart from '../components/report/ConfidenceTrendChart.jsx';
import EmotionPieChart from '../components/report/EmotionPieChart.jsx';
import InterviewTimeline from '../components/report/InterviewTimeline.jsx';
import InterviewRecording from '../components/report/InterviewRecording.jsx';
import GrammarAnalysis from '../components/report/GrammarAnalysis.jsx';
import VocabularyBreakdown from '../components/report/VocabularyBreakdown.jsx';
import AnswerCards from '../components/report/AnswerCards.jsx';
import FillerWordHeatmap from '../components/report/FillerWordHeatmap.jsx';
import CoachingPlan from '../components/report/CoachingPlan.jsx';
import ResumeGapAnalysis from '../components/report/ResumeGapAnalysis.jsx';
// ── New premium sections ──
import RecruiterReadiness from '../components/report/RecruiterReadiness.jsx';
import RoleFitAssessment from '../components/report/RoleFitAssessment.jsx';
import AnswerCompleteness from '../components/report/AnswerCompleteness.jsx';
import PaceAnalysis from '../components/report/PaceAnalysis.jsx';
import HesitationInsights from '../components/report/HesitationInsights.jsx';

export default function ReportPage() {
  const ctx = useInterview();
  const navigate = useNavigate();
  const [fetching, setFetching] = useState(false);
  
  // Use real data if available
  const data = ctx.reportData;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Attempt to recover report data if it's missing from context (e.g. on refresh)
  useEffect(() => {
    if (!ctx.reportData && ctx.sessionId && !fetching) {
      const recoverReport = async () => {
        setFetching(true);
        try {
          const { data: sessionInfo } = await getSession(ctx.sessionId);
          if (sessionInfo.report) {
            ctx.setReportData(sessionInfo.report);
          }
        } catch (err) {
          console.error("Failed to recover report data:", err);
        } finally {
          setFetching(false);
        }
      };
      recoverReport();
    }
  }, [ctx.reportData, ctx.sessionId, ctx.setReportData, fetching]);

  const handleRetake = () => {
    // Reset session metrics and navigate back home
    ctx.setSessionId(null);
    ctx.setReportData(null);
    navigate('/');
  };

  // While fetching or if we truly have no data and no session to fetch from
  if (fetching || (!data && !ctx.sessionId)) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0A0E1A] text-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <p className="font-bold tracking-widest uppercase text-xs text-purple-400">
            {fetching ? 'Retrieving Your Report...' : 'No Report Found'}
          </p>
        </div>
      </div>
    );
  }

  // Fallback to mock only if we explicitly have no data and no way to get it
  const finalData = data || mockData;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      
      {/* ── STICKY GLASSMORPHIC ACTION HEADER ───────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-8 py-4 flex items-center justify-between no-print shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-slate-900 font-black text-sm uppercase tracking-tight">MockMate AI</span>
          <span className="badge badge-primary">Report panel</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRetake} 
            className="text-xs py-2 px-4 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors font-bold text-slate-700 flex items-center gap-2"
          >
            🔄 New Interview
          </button>
          <button 
            onClick={() => window.print()} 
            className="text-xs py-2 px-5 rounded-full bg-slate-950 hover:bg-slate-900 text-white font-bold transition-colors flex items-center gap-2 shadow-sm"
          >
            🖨️ Export PDF / Print
          </button>
        </div>
      </div>

      {/* 1. PROFESSIONAL HERO BANNER (Full Width) */}
      <HeroBanner candidate={finalData.candidate} />

      <div className="report-grid">

        {/* ── TIER 1: SUMMARY SIGNALS ─────────────────────────────────── */}

        {/* 2. RECRUITER READINESS — most critical summary card */}
        {finalData.recruiterReadiness && (
          <div className="col-12">
            <RecruiterReadiness data={finalData.recruiterReadiness} />
          </div>
        )}

        {/* 3. PERFORMANCE SUMMARY */}
        <div className="col-4">
          <OverallScoreGauge score={finalData.overallScore} />
        </div>
        <div className="col-8">
          <ScoreRingsRow scores={finalData.scores} />
        </div>

        {/* 3. SMART EXECUTIVE HIGHLIGHTS & SUGGESTIONS */}
        <div className="col-12">
          <div className="premium-card p-8 border border-slate-100/80 shadow-md rounded-3xl bg-white space-y-6">
            <h2 className="section-title">Smart Executive Highlights &amp; Suggestions</h2>
            
            {/* Executive Summary Paragraph */}
            {finalData.executiveSummary && (
              <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">AI Executive Summary</span>
                <p className="text-sm font-semibold text-slate-800 leading-relaxed italic">
                  "{finalData.executiveSummary}"
                </p>
              </div>
            )}

            {/* Strengths & Growth Areas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Left Column: Key Strengths */}
              {finalData.strengths && finalData.strengths.length > 0 && (
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">AI Key Strengths</span>
                  <ul className="space-y-2.5">
                    {finalData.strengths.map((str, idx) => (
                      <li key={idx} className="flex gap-3 items-start text-xs font-semibold text-slate-700">
                        <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 text-[10px] font-black">✓</span>
                        <span className="leading-relaxed">{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Right Column: Growth Opportunities */}
              {finalData.areasToImprove && finalData.areasToImprove.length > 0 && (
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block">Areas for Growth</span>
                  <ul className="space-y-2.5">
                    {finalData.areasToImprove.map((area, idx) => (
                      <li key={idx} className="flex gap-3 items-start text-xs font-semibold text-slate-700">
                        <span className="h-5 w-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 text-[10px]">📈</span>
                        <span className="leading-relaxed">{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>

            {/* Bottom Row: AI Suggestions Grid */}
            {finalData.topSuggestions && finalData.topSuggestions.length > 0 && (
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">AI Targeted Recommendations</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {finalData.topSuggestions.map((sug, idx) => (
                    <div key={idx} className="bg-indigo-50/20 border border-indigo-500/10 p-5 rounded-2xl flex flex-col justify-between">
                      <div>
                        <span className="bg-indigo-100 text-indigo-700 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black mb-3">
                          {idx + 1}
                        </span>
                        <p className="text-xs font-bold text-slate-800 leading-relaxed">
                          {sug}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── TIER 2: ROLE & COMPLETENESS ──────────────────────────────── */}

        {/* 4. ROLE FIT + ANSWER COMPLETENESS */}
        {finalData.roleFitAssessment && (
          <div className="col-6">
            <RoleFitAssessment data={finalData.roleFitAssessment} />
          </div>
        )}
        {finalData.answerCompleteness && (
          <div className="col-6">
            <AnswerCompleteness data={finalData.answerCompleteness} />
          </div>
        )}

        {/* ── TIER 3: LANGUAGE & CONTENT AUDIT ────────────────────────── */}

        {/* 5. GRAMMAR & VOCABULARY */}
        <div className="col-6">
          <GrammarAnalysis analysis={finalData.grammarAnalysis} />
        </div>
        <div className="col-6">
          <VocabularyBreakdown vocabulary={finalData.vocabulary} />
        </div>

        {/* ── TIER 4: DETAILED ANSWER BREAKDOWN ───────────────────────── */}

        {/* 6. QUESTION-BY-QUESTION */}
        <div className="col-12">
          <h2 className="section-title">Question-by-Question Breakdown</h2>
          <AnswerCards answers={finalData.answers} />
        </div>

        {/* ── TIER 5: PACE & HESITATION INSIGHTS ──────────────────────── */}

        {/* 7. PACE ANALYSIS + HESITATION INSIGHTS */}
        {finalData.paceAnalysis && (
          <div className="col-7">
            <PaceAnalysis data={finalData.paceAnalysis} />
          </div>
        )}
        {finalData.hesitationInsights && (
          <div className="col-5">
            <HesitationInsights data={finalData.hesitationInsights} />
          </div>
        )}

        {/* ── TIER 6: GROWTH & IMPROVEMENT ────────────────────────────── */}

        {/* 8. COACHING ROADMAP + LEGACY FILLER HEATMAP (fallback) */}
        <div className="col-7">
          <CoachingPlan coaching={finalData.coaching} />
        </div>
        <div className="col-5">
          <FillerWordHeatmap fillerWords={finalData.fillerWords} />
        </div>

        {/* 7. EMOTION ANALYSIS (Optional/Subtle) */}
        {finalData.facialAnalysis && (
          <div className="col-12">
            <EmotionPieChart 
              distribution={finalData.facialAnalysis.emotionDistribution} 
              dominant={finalData.facialAnalysis.dominantEmotion} 
            />
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="mt-20 text-center border-t border-slate-200 py-12 px-6 no-print">
        <div className="flex items-center justify-center gap-2 mb-2 opacity-50">
          <span className="text-slate-900 font-black text-xs tracking-tight uppercase">MockMate AI</span>
        </div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em]">
          Automated Assessment &amp; Coaching Report
        </p>
      </div>
    </div>
  );
}
