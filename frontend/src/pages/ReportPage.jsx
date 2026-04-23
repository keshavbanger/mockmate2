import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { useInterview } from '../context/InterviewContext.jsx';
import { useToast } from '../components/Toast.jsx';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
);

// ─── Chart.js light defaults ───────────────────────────────────────────────────
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#64748b', font: { family: 'Inter', size: 11, weight: 'bold' } } },
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: 'rgba(0,0,0,0.05)',
      borderWidth: 1,
      titleColor: '#1a1a2e',
      bodyColor: '#64748b',
      padding: 12,
      cornerRadius: 12,
      displayColors: false,
    },
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10, weight: 'bold' } },
      grid:  { display: false },
      border: { display: false }
    },
    y: {
      ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10, weight: 'bold' } },
      grid:  { color: 'rgba(0,0,0,0.03)' },
      border: { display: false }
    },
  },
};

// ─── Filler Timeline ──────────────────────────────────────────────────────────
function FillerTimeline({ fillerTimeline = [], durationSeconds = 0 }) {
  if (!fillerTimeline || fillerTimeline.length === 0) {
    return null;
  }

  const getWordColor = (word) => {
    const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];
    const hash = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatTime = (ms) => {
    const seconds = Math.floor((ms || 0) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const durationMs = durationSeconds * 1000;
  const maxTime = Math.max(...fillerTimeline.map(item => item.timestamp_ms || 0), durationMs);

  return (
    <div className="premium-card p-6">
      <span className="step-label mb-4">Filler Word Timeline</span>
      <div className="space-y-6">
        {/* Timeline bar */}
        <div className="bg-[#f8f9fa] rounded-2xl p-6 border border-black/[0.03]">
          <div className="relative h-10 bg-white rounded-full mb-4 overflow-x-auto shadow-inner border border-black/[0.02]">
            {/* Background grid */}
            <div className="absolute inset-0 flex pointer-events-none">
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                <div key={frac} className="flex-1 border-r border-black/[0.02]" />
              ))}
            </div>

            {/* Filler word markers */}
            {fillerTimeline.map((item, idx) => {
              const position = (item.timestamp_ms || 0) / maxTime * 100;
              return (
                <div
                  key={idx}
                  className="absolute top-1/2 -translate-y-1/2 transform group cursor-pointer"
                  style={{ left: `${position}%` }}
                >
                  <div className="w-8 h-8 rounded-full transform -translate-x-1/2 bg-white shadow-md border border-black/[0.05]
                                  flex items-center justify-center text-xs font-black transition-all hover:scale-110"
                    style={{ color: getWordColor(item.word) }}>
                    {item.count}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time labels */}
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
            <span>0:00</span>
            <span>{formatTime(maxTime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Score colour ─────────────────────────────────────────────────────────────
function scoreColor(v) {
  if (v == null) return 'text-slate-300';
  if (v >= 7)   return 'text-purple-500';
  if (v >= 5)   return 'text-indigo-500';
  return 'text-slate-500';
}
function scoreBarColor(v) {
  if (v == null) return '#6366f1';
  if (v >= 7)   return '#8b5cf6'; // purple-500
  if (v >= 5)   return '#6366f1'; // indigo-500
  return '#64748b'; // slate-500
}

// ─── Score Card ───────────────────────────────────────────────────────────────
function ScoreCard({ label, value, icon, max = 10 }) {
  const pct = value != null ? Math.round((value / max) * 100) : null;
  return (
    <div className="premium-card p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="step-label mb-0">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className={`text-5xl font-black tracking-tighter ${scoreColor(value)}`}>
        {value ?? '—'}
        {value != null && <span className="text-sm font-bold text-slate-300 uppercase ml-1 tracking-widest">/ {max}</span>}
      </div>
      {pct != null && (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${pct}%`, backgroundColor: scoreBarColor(value) }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Question Card (collapsible) ──────────────────────────────────────────────
function QuestionCard({ item, index }) {
  const [open, setOpen] = useState(false);
  const stars = item.score ?? 0;

  return (
    <div className="bg-white border border-black/[0.03] rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between p-6 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-start gap-5 flex-1 min-w-0">
          <span className="flex-shrink-0 h-8 w-8 rounded-full bg-black text-white
                           font-black text-[10px] flex items-center justify-center mt-1 uppercase tracking-tighter">
            Q{index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-black font-bold text-base leading-snug">
              {item.question}
            </p>
            {/* Star rating */}
            <div className="flex items-center gap-1 mt-3">
              {[1,2,3,4,5].map(s => (
                <svg key={s} className={`h-4 w-4 ${s <= stars ? 'text-purple-500' : 'text-slate-100'}`}
                  fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
              <span className="text-slate-400 text-[10px] font-bold ml-2 uppercase tracking-widest">{stars} / 5</span>
            </div>
          </div>
        </div>
        <div className={`mt-2 p-1 rounded-full border border-black/[0.05] transition-transform duration-500 ${open ? 'rotate-180 bg-black text-white' : 'text-slate-300'}`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-black/[0.03] p-8 space-y-6 bg-[#f8f9fa] animate-fade-up">
          {item.answer_summary && (
            <div>
              <span className="step-label mb-2">Answer Summary</span>
              <p className="text-slate-600 text-sm leading-relaxed font-medium">{item.answer_summary}</p>
            </div>
          )}
          {item.ai_feedback && (
            <div className="flex gap-4 p-5 bg-white rounded-2xl border border-black/[0.03] shadow-sm">
              <span className="text-lg">💡</span>
              <p className="text-slate-600 text-sm leading-relaxed font-bold">{item.ai_feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bullet Section ───────────────────────────────────────────────────────────
function BulletSection({ title, items = [], icon, colorClass }) {
  return (
    <div className="premium-card p-6">
      <span className="step-label mb-4">{title}</span>
      <ul className="space-y-4">
        {items.map((item, i) => (
          <li key={i} className={`flex items-start gap-4 text-sm font-medium leading-relaxed ${colorClass}`}>
            <span className="mt-0.5 text-base">{icon}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── ReportPage ───────────────────────────────────────────────────────────────
export default function ReportPage() {
  const navigate = useNavigate();
  const ctx      = useInterview();
  const report   = ctx.reportData;
  const { addToast, ToastContainer } = useToast();

  // Redirect if no report
  useEffect(() => {
    if (!report) {
      addToast('No report found. Please complete an interview first.', 'warning');
      navigate('/', { replace: true });
    }
  }, [report, navigate]); // eslint-disable-line

  if (!report) return null;

  const { scores = {}, sessionMetrics = {} } = ctx;
  const metrics = report.communication_metrics ?? {};
  const fillerBreakdown   = metrics.filler_stats?.breakdown ?? {};
  const emotionSnapshots  = report.emotion_data?.snapshots ?? ctx.sessionMetrics.emotionSnapshots ?? [];
  const questionFeedback  = report.question_feedback ?? [];
  const interviewDate     = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const durationMin = Math.round((report.duration_seconds ?? 0) / 60);

  // ── Chart data ────────────────────────────────────────────────────────────

  // 1. Filler word bar chart
  const fillerLabels = Object.keys(fillerBreakdown);
  const fillerCounts = Object.values(fillerBreakdown);
  const fillerBarData = {
    labels: fillerLabels.length ? fillerLabels : ['No fillers detected'],
    datasets: [{
      label: 'Count',
      data: fillerCounts.length ? fillerCounts : [0],
      backgroundColor: '#f59e0b99',
      borderColor: '#f59e0b',
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  // 2. Confidence by question (line)
  const confidenceByQ = questionFeedback.map((q) => (q.score ?? 3) / 5);
  const confidenceLineData = {
    labels: questionFeedback.map((_, i) => `Q${i + 1}`),
    datasets: [{
      label: 'Answer Score',
      data: confidenceByQ,
      fill: true,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.1)',
      tension: 0.4,
      pointBackgroundColor: '#818cf8',
      pointRadius: 5,
    }],
  };

  // 3. Emotion pie
  const emotionTotals = emotionSnapshots.reduce(
    (acc, s) => {
      acc.Confident += s.emotions?.confident ?? 0;
      acc.Nervous   += s.emotions?.nervous   ?? 0;
      acc.Neutral   += s.emotions?.neutral   ?? 0;
      return acc;
    },
    { Confident: 0, Nervous: 0, Neutral: 0 }
  );
  const totalEmo = Object.values(emotionTotals).reduce((a, b) => a + b, 0) || 1;
  const emotionPieData = {
    labels: ['Confident', 'Nervous', 'Neutral'],
    datasets: [{
      data: [
        Math.round((emotionTotals.Confident / totalEmo) * 100),
        Math.round((emotionTotals.Nervous   / totalEmo) * 100),
        Math.round((emotionTotals.Neutral   / totalEmo) * 100),
      ],
      backgroundColor: ['#10b98166', '#f59e0b66', '#6366f166'],
      borderColor:     ['#10b981',   '#f59e0b',   '#6366f1'],
      borderWidth: 2,
    }],
  };

  return (
    <div className="min-h-screen bg-[#fafafa] pb-20">
      <ToastContainer />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-black/[0.03] shadow-sm relative z-10">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="animate-fade-up">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-7 w-7 rounded-full bg-[#6B46C1] flex items-center justify-center text-white">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                  </svg>
                </div>
                <span className="text-black font-bold text-base tracking-tight">MockMate</span>
                <span className="text-slate-300 mx-1">/</span>
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Interview Report</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter text-black mb-4">
                {report.candidate_name}
              </h1>
              <div className="flex flex-wrap items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  {report.interview_type}
                </div>
                <div>⏱ {durationMin} MINS</div>
                <div>📅 {interviewDate}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 no-print animate-fade-up animate-delay-1">
              <button
                onClick={() => navigate('/')}
                className="btn-outline text-xs px-6 py-2"
              >
                Dashboard
              </button>
              <button
                onClick={() => window.print()}
                className="btn-black text-xs px-6 py-2 flex items-center gap-2"
              >
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">

        {/* ── Score Cards ─────────────────────────────────────────────────── */}
        <section className="animate-fade-up animate-delay-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ScoreCard label="Overall Quality"   value={report.overall_score}       icon="🏆" />
            <ScoreCard label="Communication"     value={report.scores?.communication} icon="🗣️" />
            <ScoreCard label="Confidence"        value={report.scores?.confidence}    icon="💪" />
            <ScoreCard label="Technical Depth"   value={report.scores?.technical}     icon="⚙️" />
          </div>
        </section>

        {/* ── Executive Summary ───────────────────────────────────────────── */}
        {report.executive_summary && (
          <section className="animate-fade-up animate-delay-2">
            <div className="rounded-3xl p-10 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #6B46C1 0%, #4F46E5 100%)' }}>
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <span className="text-8xl">📝</span>
              </div>
              <span className="text-[10px] font-bold text-purple-200 uppercase tracking-[0.3em] mb-4 block">Executive Summary</span>
              <p className="text-xl md:text-2xl font-medium leading-relaxed max-w-3xl relative z-10 text-white">
                "{report.executive_summary}"
              </p>
            </div>
          </section>
        )}

        {/* ── Behavioral Analytics ────────────────────────────────────────── */}
        <section className="animate-fade-up animate-delay-3">
          <span className="step-label mb-6">Behavioral Analytics</span>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Filler words bar */}
            <div className="premium-card p-6">
              <span className="step-label mb-6">Filler Words</span>
              <div className="h-40">
                <Bar
                  data={fillerBarData}
                  options={{
                    ...CHART_DEFAULTS,
                    indexAxis: 'y',
                    plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
                  }}
                />
              </div>
              <div className="mt-6 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Total: <span className="text-black font-black">
                  {metrics.filler_stats?.filler_count ?? 0}
                </span></span>
                <span>Rate: <span className="text-black font-black">
                  {metrics.filler_stats?.filler_rate_percent ?? 0}%
                </span></span>
              </div>
            </div>

            {/* Confidence trend line */}
            <div className="premium-card p-6">
              <span className="step-label mb-6">Answer Quality</span>
              <div className="h-40">
                <Line
                  data={confidenceLineData}
                  options={{
                    ...CHART_DEFAULTS,
                    scales: {
                      ...CHART_DEFAULTS.scales,
                      y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 1 },
                    },
                    plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
                  }}
                />
              </div>
              <div className="mt-6 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>WPM: <span className="text-black font-black">
                  {metrics.words_per_minute ?? 0}
                </span></span>
                <span>Pauses: <span className="text-black font-black">
                  {metrics.pause_count ?? 0}
                </span></span>
              </div>
            </div>

            {/* Emotion pie */}
            <div className="premium-card p-6">
              <span className="step-label mb-6">Emotions</span>
              <div className="h-40">
                <Pie
                  data={emotionPieData}
                  options={{
                    ...CHART_DEFAULTS,
                    scales: undefined,
                    plugins: {
                      ...CHART_DEFAULTS.plugins,
                      legend: {
                        ...CHART_DEFAULTS.plugins.legend,
                        position: 'bottom',
                      },
                    },
                  }}
                />
              </div>
              <div className="mt-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                {emotionSnapshots.length} Samples
              </div>
            </div>
          </div>
        </section>

        {/* ── Filler Timeline ─────────────────────────────────────────────── */}
        {(report.filler_timeline?.length > 0) && (
          <section className="animate-fade-up animate-delay-4">
            <FillerTimeline
              fillerTimeline={report.filler_timeline}
              durationSeconds={report.duration_seconds}
            />
          </section>
        )}

        {/* ── Strengths / Improvements / Recommendations ───────────────────── */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <BulletSection
              title="Strengths"
              items={report.strengths ?? []}
              icon="✅"
              colorClass="text-purple-600"
            />
            <BulletSection
              title="Areas for Improvement"
              items={report.improvements ?? []}
              icon="⚠️"
              colorClass="text-amber-300"
            />
            <BulletSection
              title="Recommendations"
              items={report.recommendations ?? []}
              icon="💡"
              colorClass="text-blue-300"
            />
          </div>
        </section>

        {/* ── Per-Question Breakdown ──────────────────────────────────────── */}
        {questionFeedback.length > 0 && (
          <section className="animate-fade-up animate-delay-5">
            <span className="step-label mb-6">Detailed Feedback</span>
            <div className="space-y-4">
              {questionFeedback.map((item, i) => (
                <QuestionCard key={i} item={item} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer className="text-center text-slate-600 text-xs pb-8 no-print">
          Generated by Stitch AI · AI Mock Interview Platform
        </footer>
      </div>
    </div>
  );
}
