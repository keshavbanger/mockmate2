import { useEffect } from 'react';
import { useInterview } from '../context/InterviewContext.jsx';
import { reportData as mockData } from '../data/mockReportData.js';

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

export default function ReportPage() {
  const ctx = useInterview();
  
  // Use real data if available, otherwise fallback to mock
  const data = ctx.reportData || mockData;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!data) return (
    <div className="h-screen flex items-center justify-center bg-[#0A0E1A] text-white">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        <p className="font-bold tracking-widest uppercase text-xs text-purple-400">Loading Report...</p>
      </div>
    </div>
  );

  return (
    <div className="report-dark-theme min-h-screen py-10">
      <div className="report-grid">
        
        {/* 1. HERO BANNER */}
        <HeroBanner candidate={data.candidate} />

        {/* 2. INTERVIEW RECORDING */}
        <InterviewRecording videoUrl={data.recording_url} />

        {/* 3. TOP METRICS ROW */}
        <OverallScoreGauge score={data.overallScore} />
        <ScoreRingsRow scores={data.scores} />
        <RadarChart scores={data.scores} />

        {/* 3. TRENDS & EMOTIONS */}
        <ConfidenceTrendChart trend={data.confidenceTrend} />
        <EmotionPieChart 
          distribution={data.facialAnalysis.emotionDistribution} 
          dominant={data.facialAnalysis.dominantEmotion} 
        />

        {/* 4. TIMELINE */}
        <InterviewTimeline answers={data.answers} />

        {/* 5. ANALYSIS ROW 1 */}
        <GrammarAnalysis analysis={data.grammarAnalysis} />
        <VocabularyBreakdown vocabulary={data.vocabulary} />

        {/* 6. ANSWERS GRID */}
        <AnswerCards answers={data.answers} />

        {/* 7. ANALYSIS ROW 2 */}
        <FillerWordHeatmap fillerWords={data.fillerWords} />
        <CoachingPlan coaching={data.coaching} />

        {/* 8. RESUME GAP */}
        <ResumeGapAnalysis gaps={data.resumeGaps} />

      </div>

      {/* FOOTER */}
      <div className="mt-20 text-center border-t border-border pt-10 px-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-full bg-[#6B46C1] flex items-center justify-center text-white">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          <span className="text-white font-black text-sm tracking-tight">MockMate AI</span>
        </div>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
          Empowering your career with data-driven insights
        </p>
      </div>
    </div>
  );
}
