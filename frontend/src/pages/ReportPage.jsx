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

// ─── Chart.js dark defaults ───────────────────────────────────────────────────
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
    tooltip: {
      backgroundColor: '#1e1e38',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
    },
  },
  scales: {
    x: {
      ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
      grid:  { color: 'rgba(255,255,255,0.05)' },
    },
    y: {
      ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
      grid:  { color: 'rgba(255,255,255,0.05)' },
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
    <div className="card p-5">
      <p className="section-title text-sm mb-4">Filler Word Timeline</p>
      <div className="space-y-4">
        {/* Timeline bar */}
        <div className="bg-surface-700 rounded-lg p-4">
          <div className="relative h-8 bg-surface-600 rounded mb-3 overflow-x-auto">
            {/* Background grid */}
            <div className="absolute inset-0 flex pointer-events-none">
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                <div
                  key={frac}
                  className="flex-1 border-r border-white/5"
                  style={{ flex: 1 }}
                />
              ))}
            </div>

            {/* Filler word markers */}
            {fillerTimeline.map((item, idx) => {
              const position = (item.timestamp_ms || 0) / maxTime * 100;
              return (
                <div
                  key={idx}
                  className="absolute top-1/2 -translate-y-1/2 transform group cursor-pointer"
                  style={{
                    left: `${position}%`,
                  }}
                  title={`${item.word} at ${formatTime(item.timestamp_ms)}`}
                >
                  <div className="w-6 h-6 rounded-full transform -translate-x-1/2 opacity-75 hover:opacity-100
                                  transition-opacity flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: getWordColor(item.word) }}>
                    {item.count}
                  </div>
                  <div className="absolute top-full mt-2 px-2 py-1 bg-surface-900 border border-white/10 rounded
                                  text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity
                                  whitespace-nowrap pointer-events-none z-10">
                    {item.word} × {item.count} @ {formatTime(item.timestamp_ms)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time labels */}
          <div className="flex justify-between text-xs text-slate-500 px-1">
            <span>0:00</span>
            <span>{formatTime(maxTime / 4)}</span>
            <span>{formatTime(maxTime / 2)}</span>
            <span>{formatTime((maxTime * 3) / 4)}</span>
            <span>{formatTime(maxTime)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[...new Set(fillerTimeline.map(item => item.word))].map((word) => {
            const count = fillerTimeline.filter(item => item.word === word).reduce((sum, item) => sum + item.count, 0);
            return (
              <div key={word} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getWordColor(word) }}
                />
                <span className="text-slate-300">
                  "{word}" <span className="text-slate-500">×{count}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Score colour ─────────────────────────────────────────────────────────────
function scoreColor(v) {
  if (v == null) return 'text-slate-500';
  if (v >= 7)   return 'text-emerald-400';
  if (v >= 5)   return 'text-amber-400';
  return 'text-red-400';
}
function scoreBarColor(v) {
  if (v == null) return '#6366f1';
  if (v >= 7)   return '#10b981';
  if (v >= 5)   return '#f59e0b';
  return '#ef4444';
}

// ─── Score Card ───────────────────────────────────────────────────────────────
function ScoreCard({ label, value, icon, max = 10 }) {
  const pct = value != null ? Math.round((value / max) * 100) : null;
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className={`text-4xl font-extrabold ${scoreColor(value)}`}>
        {value ?? '—'}
        {value != null && <span className="text-base font-normal text-slate-600">/{max}</span>}
      </div>
      {pct != null ? (
        <div className="h-1.5 bg-surface-500 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: scoreBarColor(value) }}
          />
        </div>
      ) : (
        <p className="text-slate-600 text-xs">Not applicable</p>
      )}
    </div>
  );
}

// ─── Question Card (collapsible) ──────────────────────────────────────────────
function QuestionCard({ item, index }) {
  const [open, setOpen] = useState(false);
  const stars = item.score ?? 0;

  return (
    <div className="card border border-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between p-5 text-left hover:bg-white/2 transition-colors"
      >
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <span className="flex-shrink-0 h-7 w-7 rounded-full bg-brand-500/20 text-brand-400
                           font-bold text-xs flex items-center justify-center mt-0.5">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm leading-snug line-clamp-2">
              {item.question}
            </p>
            {/* Star rating */}
            <div className="flex items-center gap-1 mt-2">
              {[1,2,3,4,5].map(s => (
                <svg key={s} className={`h-3.5 w-3.5 ${s <= stars ? 'text-amber-400' : 'text-slate-700'}`}
                  fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
              <span className="text-slate-500 text-[10px] ml-1">{stars}/5</span>
            </div>
          </div>
        </div>
        <svg className={`h-4 w-4 text-slate-500 flex-shrink-0 mt-1 ml-4 transition-transform duration-200
                         ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/5 px-5 pb-5 pt-4 space-y-3 animate-fade-in">
          {item.answer_summary && (
            <div>
              <p className="metric-label mb-1">Answer Summary</p>
              <p className="text-slate-400 text-sm leading-relaxed">{item.answer_summary}</p>
            </div>
          )}
          {item.ai_feedback && (
            <div className="flex gap-3 p-3 bg-brand-500/5 rounded-lg border border-brand-500/10">
              <span className="text-brand-400 text-sm flex-shrink-0">💡</span>
              <p className="text-slate-300 text-sm leading-relaxed">{item.ai_feedback}</p>
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
    <div className="card p-5">
      <p className="section-title flex items-center gap-2">{icon} {title}</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className={`flex items-start gap-3 text-sm leading-relaxed ${colorClass}`}>
            <span className="mt-0.5 flex-shrink-0">
              {icon === '✅' ? '✅' : icon === '⚠️' ? '⚠️' : '💡'}
            </span>
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
    <div className="min-h-screen bg-surface-900">
      <ToastContainer />

      {/* ── Print styles injected as inline <style> ─────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #ffffff !important; color: #111827 !important; }
          .bg-surface-900, .bg-surface-800, .bg-surface-700,
          .bg-surface-600 { background-color: #f9fafb !important; }
          .card, .card-glow {
            background: #f3f4f6 !important;
            border: 1px solid #d1d5db !important;
            box-shadow: none !important;
          }
          .text-white    { color: #111827 !important; }
          .text-slate-300, .text-slate-400, .text-slate-500 { color: #374151 !important; }
          h1, h2, p, span, li { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Expand all question cards */
          [data-collapsed="true"] { display: block !important; }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-surface-800 via-surface-700 to-brand-700/20
                      border-b border-white/5 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 right-0 w-96 h-96 bg-brand-600/10 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="badge-purple">📋 Interview Report</span>
                <span className="badge bg-white/5 text-slate-400 border border-white/5">
                  {report.interview_type} · {report.difficulty}
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-white mb-2">
                {report.candidate_name}
              </h1>
              <div className="flex items-center gap-4 text-slate-400 text-sm flex-wrap">
                <span>📅 {interviewDate}</span>
                <span>⏱ {durationMin} minutes</span>
                <span>🌐 {report.language}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 no-print">
              <button
                onClick={() => navigate('/')}
                className="btn-ghost py-2 px-5 text-sm"
              >
                New Interview
              </button>
              <button
                onClick={() => window.print()}
                className="btn-primary py-2 px-5 text-sm flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">

        {/* ── Score Cards ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="section-title text-xl mb-5">Performance Scores</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ScoreCard label="Overall"       value={report.scores?.overall}       icon="🏆" />
            <ScoreCard label="Communication" value={report.scores?.communication} icon="🗣️" />
            <ScoreCard label="Confidence"    value={report.scores?.confidence}    icon="💪" />
            <ScoreCard label="Technical"     value={report.scores?.technical}     icon="⚙️" />
          </div>
        </section>

        {/* ── Executive Summary ───────────────────────────────────────────── */}
        {report.executive_summary && (
          <section>
            <div className="card p-6 border-l-4 border-brand-500">
              <p className="metric-label mb-3">Executive Summary</p>
              <p className="text-slate-300 leading-relaxed">{report.executive_summary}</p>
            </div>
          </section>
        )}

        {/* ── Behavioral Charts ───────────────────────────────────────────── */}
        <section>
          <h2 className="section-title text-xl mb-5">Behavioral Analytics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Filler words bar */}
            <div className="card p-5">
              <p className="section-title text-sm mb-4">Filler Words</p>
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
              <div className="mt-3 flex justify-between text-xs text-slate-500">
                <span>Total: <span className="text-amber-400 font-semibold">
                  {metrics.filler_stats?.filler_count ?? 0}
                </span></span>
                <span>Rate: <span className="text-amber-400 font-semibold">
                  {metrics.filler_stats?.filler_rate_percent ?? 0}%
                </span></span>
              </div>
            </div>

            {/* Confidence trend line */}
            <div className="card p-5">
              <p className="section-title text-sm mb-4">Answer Quality by Question</p>
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
              <div className="mt-3 flex justify-between text-xs text-slate-500">
                <span>WPM: <span className="text-brand-400 font-semibold">
                  {metrics.words_per_minute ?? 0}
                </span></span>
                <span>Pauses: <span className="text-brand-400 font-semibold">
                  {metrics.pause_count ?? 0}
                </span></span>
              </div>
            </div>

            {/* Emotion pie */}
            <div className="card p-5">
              <p className="section-title text-sm mb-4">Emotion Distribution</p>
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
              <div className="mt-3 text-xs text-slate-500 text-center">
                Based on {emotionSnapshots.length} facial analysis samples
              </div>
            </div>
          </div>
        </section>

        {/* ── Filler Timeline ─────────────────────────────────────────────── */}
        {(report.filler_timeline?.length > 0) && (
          <section>
            <h2 className="section-title text-xl mb-5">Filler Word Analysis</h2>
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
              colorClass="text-emerald-300"
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
          <section>
            <h2 className="section-title text-xl mb-5">Per-Question Breakdown</h2>
            <div className="space-y-3">
              {questionFeedback.map((item, i) => (
                <QuestionCard key={i} item={item} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer className="text-center text-slate-600 text-xs pb-8 no-print">
          Generated by InterviewBot · AI Mock Interview Platform
        </footer>
      </div>
    </div>
  );
}
