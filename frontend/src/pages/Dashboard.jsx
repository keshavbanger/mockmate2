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

  const userName = user?.fullName || user?.full_name || user?.name || 'Alex';
  const targetRole = user?.targetRole || user?.job_title || 'Full Stack Developer';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'A';
  
  // Calculate job readiness score (defaults to 84 or calculated from metrics)
  const calculateReadiness = () => {
    if (summary.averageScore > 0) return Math.min(98, Math.round(summary.averageScore));
    return 84;
  };
  const readinessScore = calculateReadiness();

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
    { label: 'Resume Studio', icon: '📄', path: '/ats' },
    { label: 'Analytics', icon: '📈', path: '/history' },
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
              {/* Target Role Tag */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-[#6B46C1] text-xs font-bold mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6B46C1]"></span>
                {targetRole}
              </div>
              
              {/* User Welcome */}
              <div className="flex items-center gap-4 flex-wrap">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  Welcome back, {userName} 👋
                </h1>

                {/* Profile Controls */}
                <div className="flex items-center gap-3">
                  <button aria-label="Notifications" className="p-2 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors relative">
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-600"></span>
                    🔔
                  </button>
                  <span className="px-3 py-1 rounded-full bg-purple-600 text-white text-[11px] font-extrabold uppercase tracking-wider">
                    PRO MEMBER
                  </span>

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
                Your job readiness score is looking strong. Keep up the momentum!
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
                  🔥 4 Day Streak
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

          {/* ── Today's Action Plan ── */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="text-lg">🚀</span>
              <h2 className="text-lg font-extrabold text-slate-900">Today's Action Plan</h2>
            </div>

            <div className="relative flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 md:gap-0">
              
              {/* Line Connector */}
              <div className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-0.5 bg-slate-200 -z-0 -translate-y-4"></div>

              {/* Step 1: Upload Resume */}
              <div 
                onClick={() => navigate('/ats')}
                className="flex-1 flex flex-col items-center text-center cursor-pointer group z-10"
              >
                <div className="h-10 w-10 rounded-full bg-[#6B46C1] text-white flex items-center justify-center font-bold text-sm shadow-md mb-3 group-hover:scale-110 transition-transform">
                  ✓
                </div>
                <h4 className="text-sm font-bold text-slate-900">Upload Resume</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Scanned & Analyzed</p>
              </div>

              {/* Step 2: AI Warm-up */}
              <div 
                onClick={() => navigate('/setup')}
                className="flex-1 flex flex-col items-center text-center cursor-pointer group z-10"
              >
                <div className="w-full max-w-[220px] bg-white border-2 border-purple-600 rounded-2xl p-3 shadow-md group-hover:shadow-lg transition-shadow">
                  <div className="h-8 w-8 rounded-full bg-purple-100 text-[#6B46C1] flex items-center justify-center font-bold text-xs mx-auto mb-1">
                    ⌛
                  </div>
                  <h4 className="text-sm font-extrabold text-[#6B46C1]">AI Warm-up</h4>
                  <p className="text-xs text-purple-600 font-semibold mt-0.5">In Progress (5m)</p>
                </div>
              </div>

              {/* Step 3: Technical DSA */}
              <div 
                onClick={() => navigate('/tech-interview/setup')}
                className="flex-1 flex flex-col items-center text-center cursor-pointer group z-10"
              >
                <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-sm mb-3 group-hover:bg-slate-200 transition-colors">
                  🔒
                </div>
                <h4 className="text-sm font-bold text-slate-500">Technical DSA</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Pending</p>
              </div>

            </div>
          </motion.div>

          {/* ── 4 Core Feature Cards ── */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {/* Card 1: AI Mock Interview */}
            <div 
              onClick={() => navigate('/setup')}
              className="bg-white border-2 border-[#6B46C1]/30 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="h-12 w-12 rounded-2xl bg-purple-100 text-[#6B46C1] flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  📹
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-[#6B46C1] text-[10px] font-extrabold tracking-wider uppercase mb-3 border border-purple-100">
                  ✨ REAL-TIME VOICE & AUDIO
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">AI Mock Interview</h3>
                <p className="text-slate-500 text-xs leading-relaxed font-medium">
                  Practice behavioral and technical questions with our realistic AI persona.
                </p>
              </div>
              <div className="mt-6 font-extrabold text-sm text-[#6B46C1] flex items-center gap-1 group-hover:gap-2 transition-all">
                Start Practice <span>→</span>
              </div>
            </div>

            {/* Card 2: Tech DSA & Code (Dark Theme Contrast) */}
            <div 
              onClick={() => navigate('/tech-interview/setup')}
              className="bg-[#0F172A] border border-slate-800 rounded-3xl p-6 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
              <div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  💻
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 text-[10px] font-extrabold tracking-wider uppercase mb-3 border border-emerald-800/50">
                  ⚡ NATIVE RUNNER (JAVA, PYTHON, JS, C++)
                </div>
                <h3 className="text-xl font-extrabold text-white mb-2">Tech DSA & Code</h3>
                <p className="text-slate-400 text-xs leading-relaxed font-medium">
                  Solve algorithm challenges in a real-time collaborative sandbox environment.
                </p>
              </div>
              <div className="mt-6 font-extrabold text-sm text-emerald-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                Solve Challenge <span>→</span>
              </div>
            </div>

            {/* Card 3: ATS Scanner (Dashed Border) */}
            <div 
              onClick={() => navigate('/ats')}
              className="bg-white border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  📥
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold tracking-wider uppercase mb-3 border border-indigo-100">
                  🎯 SENIOR RECRUITER BENCHMARK
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">ATS Scanner</h3>
                <p className="text-slate-500 text-xs leading-relaxed font-medium">
                  Drop your PDF here to analyze keyword match against target job descriptions.
                </p>
              </div>
              <div className="mt-6 font-extrabold text-sm text-indigo-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                Scan Resume <span>→</span>
              </div>
            </div>

            {/* Card 4: Resume Studio */}
            <div 
              onClick={() => navigate('/ats')}
              className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  📝
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold tracking-wider uppercase mb-3 border border-emerald-100">
                  📄 1-CLICK LATEX & PDF EXPORT
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">Resume Studio</h3>
                <p className="text-slate-500 text-xs leading-relaxed font-medium">
                  Craft a tailored resume using AI suggestions and premium templates.
                </p>
              </div>
              <div className="mt-6 font-extrabold text-sm text-emerald-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                Edit & Export <span>→</span>
              </div>
            </div>
          </motion.div>

          {/* ── Bottom Section: Analytics & Activity ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Performance Score Trend Line Chart */}
            <motion.div 
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 bg-white border border-slate-200/90 rounded-3xl p-7 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Performance Score Trend</h3>
                  <p className="text-xs text-slate-400 font-medium">Tracking technical and soft-skill progression</p>
                </div>
                <select className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 focus:outline-none">
                  <option>Last 30 Days</option>
                  <option>Last 60 Days</option>
                  <option>All Time</option>
                </select>
              </div>

              <div className="h-[260px] w-full">
                <Line data={chartData} options={chartOptions} />
              </div>
            </motion.div>

            {/* Right: Recent Activity Reports Feed */}
            <motion.div 
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white border border-slate-200/90 rounded-3xl p-7 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-extrabold text-slate-900">Recent Activity Reports</h3>
                  <span className="text-xs text-slate-400 font-bold">Latest</span>
                </div>

                <div className="space-y-4">
                  {/* Item 1: ATS Scan */}
                  <div 
                    onClick={() => navigate('/ats')}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-purple-200 hover:bg-purple-50/50 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-bold">
                        📄
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#6B46C1] transition-colors">
                          ATS Resume Scan
                        </h4>
                        <p className="text-xs text-slate-400 font-medium">85% Match (Yesterday)</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-purple-600 group-hover:translate-x-1 transition-transform">→</span>
                  </div>

                  {/* Item 2: Java Technical Interview */}
                  <div 
                    onClick={() => navigate('/history')}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-purple-200 hover:bg-purple-50/50 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg font-bold">
                        💻
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#6B46C1] transition-colors">
                          Java Technical Interview
                        </h4>
                        <p className="text-xs text-slate-400 font-medium">88/100 (3 days ago)</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-purple-600 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>

              {/* See All Activity Link */}
              <div className="pt-6 border-t border-slate-100 mt-6 text-center">
                <button 
                  onClick={() => navigate('/history')}
                  className="text-xs font-extrabold text-[#6B46C1] hover:text-[#5b3da6] transition-colors inline-flex items-center gap-1"
                >
                  See all activity <span>›</span>
                </button>
              </div>

            </motion.div>

          </div>

        </main>
      </div>

    </div>
  );
}
