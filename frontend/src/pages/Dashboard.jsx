import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { getDashboardSummary, getDashboardInsights, getDashboardRoadmap, regenerateDashboardRoadmap } from '../utils/api.js';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const SEVERITY_STYLES = {
  critical: { icon: 'bg-red-50', tag: 'bg-red-50 text-red-600' },
  warn: { icon: 'bg-amber-50', tag: 'bg-amber-50 text-amber-700' },
  info: { icon: 'bg-[var(--brand-light)]', tag: 'bg-[var(--brand-light)] text-[var(--brand-primary)]' },
};

const FOCUS_ICONS = { WEIGHTED_WEAKNESS: '🎯', ATS_GAP: '📄', STALE_MOCK: '🎤', STUDY_PLAN: '📚' };

function scoreColor(score) {
  if (score == null) return 'good';
  if (score >= 75) return 'good';
  if (score >= 50) return 'mid';
  return 'low';
}
const SCORE_STYLES = {
  good: 'bg-emerald-50 text-emerald-600',
  mid: 'bg-amber-50 text-amber-700',
  low: 'bg-red-50 text-red-500',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [insights, setInsights] = useState(null);
  const [summary, setSummary] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    Promise.allSettled([getDashboardInsights(), getDashboardSummary(user.id), getDashboardRoadmap()])
      .then(([insightsRes, summaryRes, roadmapRes]) => {
        if (insightsRes.status === 'fulfilled') setInsights(insightsRes.value.data);
        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
        if (roadmapRes.status === 'fulfilled') setRoadmap(roadmapRes.value.data);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const handleRegenerateRoadmap = async () => {
    setRegenerating(true);
    try {
      const res = await regenerateDashboardRoadmap();
      setRoadmap((prev) => ({ ...prev, domainRoadmap: { hasTargetDomain: true, targetDomain: res.data.targetDomain, content: res.data.content } }));
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to regenerate roadmap.');
    } finally {
      setRegenerating(false);
    }
  };

  const userName = user?.fullName || user?.full_name || user?.name || 'there';

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-100 border-t-purple-600"></div>
          <p className="text-sm font-semibold text-slate-500">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const hasActivity = insights?.hasActivity;
  const readiness = insights?.readiness;
  const focusItems = insights?.focusItems || [];
  const streak = insights?.streak;

  const chartLabels = summary?.scoreTrend?.length
    ? summary.scoreTrend.map(t => new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    : [];
  const chartValues = summary?.scoreTrend?.length ? summary.scoreTrend.map(t => t.score) : [];
  const chartData = {
    labels: chartLabels,
    datasets: [{
      label: 'Score',
      data: chartValues,
      borderColor: '#6B46C1',
      borderWidth: 3,
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(107, 70, 193, 0.22)');
        gradient.addColorStop(1, 'rgba(107, 70, 193, 0.0)');
        return gradient;
      },
      tension: 0.4, fill: true,
      pointBackgroundColor: '#fff', pointBorderColor: '#6B46C1', pointBorderWidth: 3,
      pointRadius: 4, pointHoverRadius: 6,
    }],
  };
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F172A', titleFont: { size: 12, weight: 'bold' }, bodyFont: { size: 11 },
        padding: 10, cornerRadius: 8, displayColors: false,
        callbacks: { label: (c) => `Score: ${c.raw}/100` },
      },
    },
    scales: {
      y: { min: 0, max: 100, grid: { color: 'rgba(226,232,240,0.6)', borderDash: [4, 4] }, border: { display: false }, ticks: { color: '#94A3B8', font: { size: 10 } } },
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#94A3B8', font: { size: 10 } } },
    },
  };

  const snapshotRows = [
    { label: 'ATS Checker', score: readiness?.breakdown?.ats, path: '/ats/history' },
    { label: 'Technical Interview Lab', score: readiness?.breakdown?.techInterview, path: '/tech-interview/history' },
    { label: 'Mock Interview', score: readiness?.breakdown?.mockInterview, path: '/history' },
  ].filter(r => r.score != null);

  return (
    <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif]">
      <Navbar />
      <div className="pt-28 pb-20 px-6">
        <div className="max-w-5xl mx-auto">

          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-3xl font-bold text-black mb-2">Welcome back, {userName}</h1>
            <p className="text-slate-500">
              {hasActivity ? "Here's what actually matters right now." : "Let's get your first session done."}
            </p>
          </motion.div>

          {!hasActivity ? (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center mb-8">
              <div className="text-4xl mb-4">🚀</div>
              <h2 className="text-xl font-bold text-black mb-2">Nothing to show yet</h2>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Run a resume scan, a technical interview, or a mock interview — this page turns your reports into a concrete "what to work on next" plan once there's something to work with.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => navigate('/ats')} className="btn-primary-solid px-5 py-2.5">Scan a Resume</button>
                <button onClick={() => navigate('/tech-interview/setup')} className="text-sm font-bold px-5 py-2.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">Try Technical Interview Lab</button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Readiness hero */}
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-[28px] p-8 text-white mb-10 shadow-[0_24px_48px_-12px_rgba(107,70,193,0.35)]"
                style={{ background: 'linear-gradient(135deg, #6B46C1 0%, #5b3da6 100%)' }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-8 items-center">
                  <div className="relative w-24 h-24 flex-shrink-0 mx-auto sm:mx-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-white/20" strokeWidth="3.5" stroke="currentColor" fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none"
                        strokeDasharray={`${readiness?.percent ?? 0}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <strong className="text-xl font-extrabold">{readiness?.percent ?? 0}</strong>
                      <span className="text-[9px] font-bold tracking-wide opacity-75">READY</span>
                    </div>
                  </div>

                  <div className="text-center sm:text-left">
                    <h2 className="text-lg font-extrabold mb-1.5">{readiness?.label || 'Readiness'}</h2>
                    <p className="text-sm opacity-85 leading-relaxed max-w-md">
                      {readiness?.type === 'company'
                        ? `Estimated readiness for a ${readiness.company}-style interview, based on your latest technical interview.`
                        : 'Blended from your most recent ATS, Technical Interview, and Mock Interview scores.'}
                    </p>
                    {snapshotRows.length > 0 && (
                      <div className="flex flex-wrap justify-center sm:justify-start gap-6 mt-4">
                        {snapshotRows.map((r) => (
                          <div key={r.label} className="text-xs">
                            <span className="block opacity-70 font-semibold mb-0.5">{r.label.replace(' Lab', '').replace(' Checker', '')}</span>
                            <span className="text-base font-extrabold">{r.score}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {streak && (
                    <div className="text-center sm:text-right">
                      <div className="text-3xl font-extrabold">{streak.activeDaysLast7}</div>
                      <div className="text-[11px] font-bold opacity-75">DAY{streak.activeDaysLast7 === 1 ? '' : 'S'} ACTIVE THIS WEEK</div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* What to work on next */}
              {focusItems.length > 0 && (
                <div className="mb-10">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">What to work on next</p>
                  <div className="flex flex-col gap-3">
                    {focusItems.map((item, i) => {
                      const styles = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.info;
                      return (
                        <motion.div key={item.type + i}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                          className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row items-start gap-4"
                        >
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 ${styles.icon}`}>
                            {FOCUS_ICONS[item.type] || '💡'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${styles.tag}`}>{item.tag}</span>
                              <span className="text-[11px] font-semibold text-slate-400">{item.source}</span>
                            </div>
                            <h3 className="text-[15px] font-extrabold text-black mb-1 leading-snug">{item.title}</h3>
                            <p className="text-[13px] text-slate-500 leading-relaxed">{item.detail}</p>
                          </div>
                          <button
                            onClick={() => navigate(item.ctaPath)}
                            className="flex-shrink-0 self-center sm:self-auto text-xs font-bold text-white bg-[#6B46C1] hover:bg-[#5b3da6] rounded-full px-5 py-2.5 transition-colors whitespace-nowrap"
                          >
                            {item.ctaLabel} →
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Secondary: trend + snapshot */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm">
                  <h4 className="text-sm font-extrabold text-black mb-1">Score Trend</h4>
                  <p className="text-xs text-slate-400 mb-4">Mock Interview performance over time</p>
                  <div className="h-[180px]">
                    {chartValues.length > 0 ? (
                      <Line data={chartData} options={chartOptions} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                        Not enough Mock Interview sessions yet for a trend.
                      </div>
                    )}
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm">
                  <h4 className="text-sm font-extrabold text-black mb-1">Latest Result</h4>
                  <p className="text-xs text-slate-400 mb-3">Per feature</p>
                  {snapshotRows.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium py-4">No scored results yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {snapshotRows.map((r) => (
                        <button key={r.label} onClick={() => navigate(r.path)}
                          className="w-full flex items-center justify-between py-3 text-left hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
                          <span className="text-[13px] font-bold text-slate-700">{r.label}</span>
                          <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${SCORE_STYLES[scoreColor(r.score)]}`}>{r.score}/100</span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            </>
          )}

          {/* Roadmap — weak-topic LeetCode picks (derived from the latest
              Tech Interview Lab report's AI-generated topicsToRevise) and
              an LLM-generated domain roadmap anchored on Profile's Target
              Domain. Independent of hasActivity above: a user can have a
              targetDomain set with zero interview history, or vice versa. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-10">
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm">
              <h4 className="text-sm font-extrabold text-black mb-1">Practice These Topics</h4>
              <p className="text-xs text-slate-400 mb-4">LeetCode picks for what you're weakest in right now</p>
              {roadmap?.leetcodeRoadmap?.hasData ? (
                <div className="space-y-4">
                  {roadmap.leetcodeRoadmap.topics.map((t) => (
                    <div key={t.topic}>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">{t.topic}</p>
                      <div className="flex flex-col gap-1.5">
                        {t.problems.map((p) => (
                          <a key={p.title} href={p.leetcodeUrl} target="_blank" rel="noreferrer"
                            className="flex items-center justify-between text-[13px] font-semibold text-slate-700 hover:text-[#6B46C1] py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors">
                            <span className="truncate">{p.title}</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${SCORE_STYLES[p.difficulty === 'EASY' ? 'good' : p.difficulty === 'HARD' ? 'low' : 'mid']}`}>{p.difficulty}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4">
                  <p className="text-xs text-slate-400 font-medium mb-4">Complete a Tech Interview Lab session to get a personalized weak-topic list.</p>
                  <button onClick={() => navigate('/tech-interview/setup')} className="text-xs font-bold px-4 py-2.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors">
                    Try Technical Interview Lab
                  </button>
                </div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-1">
                <h4 className="text-sm font-extrabold text-black">
                  {roadmap?.domainRoadmap?.hasTargetDomain ? `Your ${roadmap.domainRoadmap.targetDomain} Roadmap` : 'Your Roadmap'}
                </h4>
                {roadmap?.domainRoadmap?.hasTargetDomain && (
                  <button onClick={handleRegenerateRoadmap} disabled={regenerating}
                    className="text-[11px] font-bold text-[#6B46C1] hover:underline disabled:opacity-50 flex-shrink-0 ml-2">
                    {regenerating ? 'Regenerating…' : 'Regenerate'}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-4">Phased plan toward your target role</p>
              {!roadmap?.domainRoadmap?.hasTargetDomain ? (
                <div className="py-4">
                  <p className="text-xs text-slate-400 font-medium mb-4">Set your target domain in Profile to generate a personalized roadmap.</p>
                  <button onClick={() => navigate('/profile')} className="text-xs font-bold px-4 py-2.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors">
                    Set Target Domain
                  </button>
                </div>
              ) : roadmap.domainRoadmap.content ? (
                <div>
                  {roadmap.domainRoadmap.content.summary && (
                    <p className="text-[13px] text-slate-600 leading-relaxed mb-4">{roadmap.domainRoadmap.content.summary}</p>
                  )}
                  <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                    {(roadmap.domainRoadmap.content.phases || []).map((phase, i) => (
                      <div key={i} className="border-l-2 border-purple-100 pl-3">
                        <p className="text-[13px] font-extrabold text-slate-900">{phase.title} <span className="text-slate-400 font-semibold">· {phase.durationWeeks}w</span></p>
                        {phase.skillsToLearn?.length > 0 && (
                          <p className="text-xs text-slate-500 mt-1"><span className="font-bold">Learn:</span> {phase.skillsToLearn.join(', ')}</p>
                        )}
                        {phase.projectIdeas?.length > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5"><span className="font-bold">Build:</span> {phase.projectIdeas.join(', ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium py-4">Roadmap unavailable right now — try Regenerate in a bit.</p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
