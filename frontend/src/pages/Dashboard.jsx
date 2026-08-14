import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { getDashboardSummary } from '../utils/api.js';

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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, logout } = useAuth();

  const [summary, setSummary] = useState({
    interviewsCompleted: 0,
    averageScore: 0,
    atsResumesScanned: 0,
    recentInterviews: [],
    recentAtsScans: [],
    scoreTrend: []
  });
  const [loading, setLoading] = useState(true);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      getDashboardSummary(user.id)
        .then(res => {
          if (res && res.data) {
            setSummary(res.data);
          }
        })
        .catch(err => console.error("Error fetching dashboard summary:", err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user, authLoading]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = user?.fullName || user?.full_name || user?.name || 'there';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'A';

  const hasActivity = summary.interviewsCompleted > 0 || summary.atsResumesScanned > 0;
  // No fallback default here — showing a flattering score before the user has
  // done anything would be a fabricated number, not a real readiness signal.
  const readinessScore = summary.averageScore > 0 ? Math.min(98, Math.round(summary.averageScore)) : 0;

  // A real, honest checklist — each item's "done" state is derived from
  // actual account data, not hardcoded. The DSA item has no distinct counter
  // on the backend yet, so it's left permanently actionable rather than
  // guessed at.
  const checklist = [
    { id: 'scan-resume', title: 'Scan your resume', tag: 'SETUP', tagColor: 'bg-indigo-50 text-indigo-600', icon: '📄', done: summary.atsResumesScanned > 0, path: '/ats' },
    { id: 'first-interview', title: 'Complete your first mock interview', tag: 'PRACTICE', tagColor: 'bg-purple-50 text-purple-600', icon: '🎤', done: summary.interviewsCompleted > 0, path: '/setup' },
    { id: 'dsa-round', title: 'Try a technical / DSA round', tag: 'TECHNICAL', tagColor: 'bg-emerald-50 text-emerald-600', icon: '💻', done: false, path: '/tech-interview/setup' },
    { id: 'score-80', title: 'Reach a score of 80+', tag: 'GOAL', tagColor: 'bg-amber-50 text-amber-700', icon: '🎯', done: summary.averageScore >= 80, path: '/setup' },
  ];
  const todoItems = checklist.filter((c) => !c.done);

  // Real completed activity — merges actual recent interviews + ATS scans
  // (already fetched from /summary, previously left unused while the UI
  // showed two hardcoded example rows instead).
  const doneActivity = [
    ...summary.recentInterviews.map((i) => ({
      id: `interview-${i.id}`, title: i.role ? `${i.role} Interview` : 'Practice Interview',
      tag: 'INTERVIEW', tagColor: 'bg-purple-50 text-purple-600', icon: '🎤',
      date: i.date, score: i.score, path: `/report/${i.id}`,
    })),
    ...summary.recentAtsScans.map((r) => ({
      id: `ats-${r.id}`, title: 'ATS Resume Scan',
      tag: 'RESUME', tagColor: 'bg-indigo-50 text-indigo-600', icon: '📄',
      date: r.date, score: r.score, path: `/ats/report/${r.id}`,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  const doneTotalCount = summary.interviewsCompleted + summary.atsResumesScanned;

  // Chart Setup
  const chartLabels = summary.scoreTrend.length > 0 
    ? summary.scoreTrend.map(t => new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    : ['Jul 12', 'Jul 18', 'Jul 24', 'Jul 30', 'Aug 05', 'Aug 11'];

  const chartValues = summary.scoreTrend.length > 0 
    ? summary.scoreTrend.map(t => t.score)
    : [62, 68, 75, 71, 82, 88];

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Overall Performance',
        data: chartValues,
        borderColor: '#7C3AED',
        borderWidth: 3,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(124, 58, 237, 0.25)');
          gradient.addColorStop(1, 'rgba(124, 58, 237, 0.0)');
          return gradient;
        },
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: '#7C3AED',
        pointBorderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F172A',
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 10,
        displayColors: false,
        callbacks: {
          label: (context) => `Score: ${context.raw}/100`
        }
      }
    },
    scales: {
      y: { 
        min: 50, 
        max: 100,
        grid: { color: 'rgba(226, 232, 240, 0.6)', borderDash: [4, 4] },
        border: { display: false },
        ticks: { color: '#94A3B8', font: { size: 11 } }
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#94A3B8', font: { size: 11 } }
      }
    }
  };

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logout();
    navigate('/');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-100 border-t-purple-600"></div>
          <p className="text-sm font-semibold text-slate-500">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  const sidebarLinks = [
    { label: 'Dashboard', icon: '📊', path: '/dashboard' },
    { label: 'AI Mock Interview', icon: '📹', path: '/setup' },
    { label: 'Code Sandbox', icon: '💻', path: '/tech-interview/setup' },
    { label: 'ATS Scanner', icon: '🔍', path: '/ats' },
    { label: 'Resume Builder', icon: '📄', path: '/resume-builder' },
    { label: 'Analytics', icon: '📈', path: '/history' },
  ];

  // Real, navigable categories — not fabricated "projects" the user never
  // created. Standing in for the template's generic workspace section.
  const prepTracks = [
    { label: 'Behavioral Prep', dot: 'bg-purple-500', path: '/setup' },
    { label: 'Technical Prep', dot: 'bg-emerald-500', path: '/tech-interview/setup' },
    { label: 'All History', icon: '▦', path: '/history' },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FC] text-slate-800 flex font-sans">
      
      {/* ── Left Sidebar Navigation (Desktop) ── */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200/80 flex-col justify-between p-6 flex-shrink-0 min-h-screen sticky top-0 z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div>
          {/* Logo & Title */}
          <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => navigate('/')}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#6B46C1] to-[#818CF8] flex items-center justify-center text-white font-black text-xl shadow-md shadow-purple-500/20">
              M
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight leading-none">MockMate AI</h2>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Command Center</span>
            </div>
          </div>

          {/* Primary Action Button */}
          <button 
            onClick={() => navigate('/setup')}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#6B46C1] to-[#5b3da6] hover:from-[#5b3da6] hover:to-[#4a2e91] text-white rounded-2xl font-bold text-sm shadow-lg shadow-purple-900/20 transition-all duration-200 transform active:scale-98 mb-8 flex items-center justify-center gap-2"
          >
            <span>+</span> Quick Practice
          </button>

          {/* Main Navigation */}
          <nav className="space-y-1.5">
            {sidebarLinks.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left ${
                    isActive 
                      ? 'bg-purple-50 text-[#6B46C1] shadow-sm font-bold' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Prep Tracks */}
          <div className="mt-8">
            <p className="px-4 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Prep Tracks</p>
            <nav className="space-y-1">
              {prepTracks.map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left"
                >
                  {item.dot ? <span className={`h-2 w-2 rounded-full ${item.dot} flex-shrink-0`} /> : <span className="text-sm">{item.icon}</span>}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom Nav Options */}
        <div className="pt-6 border-t border-slate-150 space-y-1">
          <button 
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <span className="text-base">⚙️</span> Settings
          </button>
          <a 
            href="mailto:support@mockmate.live"
            className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <span className="text-base">❓</span> Support
          </a>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 z-50 lg:hidden backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <motion.div 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-72 bg-white h-full p-6 flex flex-col justify-between shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-[#6B46C1] flex items-center justify-center text-white font-black text-lg">M</div>
                    <span className="font-bold text-slate-900">MockMate AI</span>
                  </div>
                  <button onClick={() => setMobileSidebarOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
                </div>
                <nav className="space-y-2">
                  {sidebarLinks.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { navigate(item.path); setMobileSidebarOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors text-left"
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Mobile Header Bar */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-700">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-extrabold text-slate-900 tracking-tight">MockMate AI</span>
          </div>
          <div className="h-8 w-8 rounded-full bg-[#6B46C1] text-white flex items-center justify-center font-bold text-xs">
            {userInitials}
          </div>
        </header>

        <main className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          {/* ── Header Row & Readiness Card ── */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              {/* User Welcome */}
              <div className="flex items-center gap-4 flex-wrap">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  Welcome back, {userName} 👋
                </h1>

                {/* Profile Controls */}
                <div className="flex items-center gap-3">
                  {/* Profile Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-200/50 transition-colors"
                    >
                      <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#6B46C1] to-[#5b3da6] text-white font-bold text-sm flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                        {user?.avatarUrl ? (
                          <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span>{userInitials}</span>
                        )}
                      </div>
                      <span className="text-slate-400 text-xs">▼</span>
                    </button>

                    {userDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-100 shadow-xl py-2 z-50">
                        <button 
                          onClick={() => { navigate('/profile'); setUserDropdownOpen(false); }} 
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          👤 Profile Settings
                        </button>
                        <button 
                          onClick={handleLogout} 
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          🚪 Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-slate-500 text-sm mt-1 max-w-xl font-medium">
                {hasActivity
                  ? `${doneTotalCount} session${doneTotalCount === 1 ? '' : 's'} completed. Keep up the momentum!`
                  : "Let's get your first session done — scan a resume or start a mock interview."}
              </p>
            </div>

            {/* Readiness Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm flex items-center justify-between min-w-[280px] hover:shadow-md transition-shadow"
            >
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Readiness</h3>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-bold">
                  {hasActivity ? `📈 ${todoItems.length} step${todoItems.length === 1 ? '' : 's'} left` : '🚀 Not started yet'}
                </div>
              </div>

              {/* Progress Ring Meter */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#6B46C1]"
                    strokeDasharray={`${readinessScore}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-lg font-black text-slate-900">{readinessScore}</span>
              </div>
            </motion.div>
          </div>

          {/* ── Tasks: real To Do / Done checklist, Linear-style ── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <h2 className="text-lg font-extrabold text-slate-900">Your Tasks</h2>
              </div>
              <span className="text-xs font-bold text-slate-400">{doneTotalCount} completed</span>
            </div>

            {/* To Do */}
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-4 w-4 rounded-full border-2 border-slate-300" />
                <h3 className="text-sm font-extrabold text-slate-900">To Do</h3>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{todoItems.length}</span>
              </div>
              {todoItems.length === 0 ? (
                <p className="text-sm text-slate-400 font-medium py-3 pl-6">You're all caught up — nice work.</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {todoItems.map((item) => (
                    <button key={item.id} onClick={() => navigate(item.path)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 rounded-xl px-2 -mx-2 transition-colors group"
                    >
                      <span className="h-4 w-4 rounded-full border-2 border-slate-300 group-hover:border-purple-400 flex-shrink-0" />
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <span className="text-sm font-semibold text-slate-800 flex-1">{item.title}</span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${item.tagColor}`}>{item.tag}</span>
                      <span className="text-slate-300 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all flex-shrink-0">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Done — real completed interviews + resume scans */}
            {doneActivity.length > 0 && (
              <div className="px-6 py-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px]">✓</span>
                  <h3 className="text-sm font-extrabold text-slate-900">Done</h3>
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{doneTotalCount}</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {doneActivity.slice(0, 6).map((item) => (
                    <button key={item.id} onClick={() => navigate(item.path)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 rounded-xl px-2 -mx-2 transition-colors group"
                    >
                      <span className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] flex-shrink-0">✓</span>
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <span className="text-sm font-semibold text-slate-500 flex-1 line-through decoration-slate-300">{item.title}</span>
                      {typeof item.score === 'number' && (
                        <span className="text-xs font-bold text-slate-400 flex-shrink-0">{item.score}</span>
                      )}
                      <span className="text-xs text-slate-400 font-medium w-20 text-right flex-shrink-0">
                        {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </button>
                  ))}
                </div>
                {doneTotalCount > doneActivity.length && (
                  <div className="pt-3 text-center">
                    <button
                      onClick={() => navigate('/history')}
                      className="text-xs font-extrabold text-[#6B46C1] hover:text-[#5b3da6] transition-colors"
                    >
                      See all activity →
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* ── Performance Score Trend ── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white border border-slate-200/90 rounded-3xl p-7 shadow-sm"
          >
            <div className="mb-6">
              <h3 className="text-lg font-extrabold text-slate-900">Performance Score Trend</h3>
              <p className="text-xs text-slate-400 font-medium">Tracking technical and soft-skill progression</p>
            </div>
            <div className="h-[260px] w-full">
              <Line data={chartData} options={chartOptions} />
            </div>
          </motion.div>

        </main>
      </div>

    </div>
  );
}
