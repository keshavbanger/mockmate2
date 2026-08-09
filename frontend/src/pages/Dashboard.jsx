import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import Navbar from '../components/Navbar';
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
  const { user, loading: authLoading } = useAuth();
  
  const [summary, setSummary] = useState({
    interviewsCompleted: 0,
    averageScore: 0,
    atsResumesScanned: 0,
    recentInterviews: [],
    recentAtsScans: [],
    scoreTrend: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      getDashboardSummary(user.id)
        .then(res => {
          setSummary(res.data || summary);
        })
        .catch(err => console.error("Error fetching dashboard summary:", err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  const chartData = {
    labels: summary.scoreTrend.map(t => new Date(t.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Interview Score',
        data: summary.scoreTrend.map(t => t.score),
        borderColor: '#6B46C1',
        backgroundColor: 'rgba(107, 70, 193, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#6B46C1',
        pointBorderWidth: 2,
        pointRadius: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 12,
        cornerRadius: 8,
      }
    },
    scales: {
      y: { 
        min: 0, 
        max: 100,
        grid: { color: 'rgba(0,0,0,0.03)' },
        border: { display: false }
      },
      x: {
        grid: { display: false },
        border: { display: false }
      }
    }
  };

  const userName = user?.fullName || user?.full_name || user?.name || 'there';

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        {/* Welcome Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {userName} 👋
          </h1>
          <p className="text-slate-500 mt-2">Here's what's happening with your interview prep today.</p>
        </motion.div>

        {/* Stats Row */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10"
        >
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">Interviews Completed</p>
              <p className="text-3xl font-black text-slate-900">{summary.interviewsCompleted}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
              🎤
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">Average Score</p>
              <p className="text-3xl font-black text-slate-900">{summary.averageScore.toFixed(1)}/100</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
              ⭐
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">ATS Resumes Scanned</p>
              <p className="text-3xl font-black text-slate-900">{summary.atsResumesScanned}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
              📄
            </div>
          </div>
        </motion.div>

        {/* Action Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <div 
            onClick={() => navigate('/setup')}
            className="group cursor-pointer bg-gradient-to-br from-[#6B46C1] to-[#5b3da6] rounded-3xl p-8 relative overflow-hidden shadow-lg shadow-purple-900/10 transition-transform hover:-translate-y-1"
          >
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Practice Interview</h3>
            <p className="text-purple-100 mb-6 max-w-sm relative z-10">Face our live AI interviewer for realistic behavioral and soft-skills practice.</p>
            <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur-sm group-hover:bg-white group-hover:text-purple-700 transition-colors relative z-10">
              Practice Now →
            </div>
          </div>

          <div 
            onClick={() => navigate('/tech-interview/setup')}
            className="group cursor-pointer bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-slate-700 rounded-3xl p-8 relative overflow-hidden shadow-lg transition-transform hover:-translate-y-1"
          >
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-violet-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <div className="text-3xl mb-2 relative z-10">🧑‍💻</div>
            <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Tech Interview</h3>
            <p className="text-slate-400 mb-6 max-w-sm relative z-10">Coding, system design & SQL problems — personalized to your resume & target role.</p>
            <div className="inline-flex items-center gap-2 bg-violet-500/20 text-violet-300 px-4 py-2 rounded-full text-sm font-bold group-hover:bg-violet-600 group-hover:text-white transition-colors relative z-10">
              Start Tech Interview →
            </div>
          </div>

          <div 
            onClick={() => navigate('/ats')}
            className="group cursor-pointer bg-white border border-slate-200 rounded-3xl p-8 relative overflow-hidden shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md"
          >
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-50 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <h3 className="text-2xl font-bold text-slate-900 mb-2 relative z-10">ATS Resume</h3>
            <p className="text-slate-500 mb-6 max-w-sm relative z-10">Upload your resume and a job description to get keyword matching and an ATS optimization score.</p>
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-sm font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors relative z-10">
              Scan Resume →
            </div>
          </div>
        </motion.div>

        {/* Activity & Chart Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Trend Chart */}
          <motion.div 
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-7 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Score Trend</h3>
              <button onClick={() => navigate('/history')} className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors">
                View All History
              </button>
            </div>
            {summary.scoreTrend.length > 0 ? (
              <div className="h-[280px] w-full">
                <Line data={chartData} options={chartOptions} />
              </div>
            ) : (
              <div className="h-[280px] w-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="text-2xl mb-2">📊</div>
                <p className="text-sm font-medium">No interview data yet</p>
                <p className="text-xs mt-1">Complete an interview to see your trend</p>
              </div>
            )}
          </motion.div>

          {/* Recent Activity List */}
          <motion.div 
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm flex flex-col"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-6">Recent Activity</h3>
            
            <div className="flex-1 overflow-y-auto space-y-4">
              {summary.recentInterviews.length === 0 && summary.recentAtsScans.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <p className="text-sm font-medium mb-1">Quiet here...</p>
                  <p className="text-xs">Start practicing to generate activity.</p>
                </div>
              ) : (
                <>
                  {summary.recentInterviews.map((item, idx) => (
                    <div key={`int-${idx}`} onClick={() => navigate(`/report/${item.id}`)} className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                      <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                        🎤
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">Interview: {item.role || 'General'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{new Date(item.date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-sm font-black text-slate-900">{item.score}/100</div>
                    </div>
                  ))}

                  {summary.recentAtsScans.map((item, idx) => (
                    <div key={`ats-${idx}`} onClick={() => navigate(`/ats/report/${item.id}`)} className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                      <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                        📄
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">ATS Scan</p>
                        <p className="text-xs text-slate-500 mt-0.5">{new Date(item.date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-sm font-black text-slate-900">{item.score}%</div>
                    </div>
                  ))}
                </>
              )}
            </div>
            
          </motion.div>
        </div>
      </main>
    </div>
  );
}
