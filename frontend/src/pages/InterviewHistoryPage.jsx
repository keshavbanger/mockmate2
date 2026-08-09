import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { getInterviewHistory } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function InterviewHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // No auth yet — show empty state, don't redirect
      setLoading(false);
      return;
    }

    async function fetchHistory() {
      try {
        setLoading(true);
        const res = await getInterviewHistory(user.id);
        setHistory(res.data);
      } catch (err) {
        console.error('Failed to load history', err);
        setError('Could not load interview history.');
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [user, authLoading, navigate]);

  const getScoreColor = (score) => {
    if (score == null) return 'bg-slate-100 text-slate-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  const chartData = {
    labels: [...history].reverse().map(h => new Date(h.createdAt).toLocaleDateString()),
    datasets: [
      {
        label: 'Overall Score',
        data: [...history].reverse().map(h => h.overallScore || 0),
        borderColor: '#6B46C1',
        backgroundColor: 'rgba(107, 70, 193, 0.5)',
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { min: 0, max: 100 },
    },
  };

  return (
    <div className="min-h-screen bg-[#fafafa] pt-24 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-black mb-2">Interview History</h1>
            <p className="text-slate-500">Track your performance over time.</p>
          </div>
          <button onClick={() => navigate('/')} className="btn-primary-solid px-5 py-2">
            Back to Dashboard
          </button>
        </motion.div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="text-4xl mb-4">📈</div>
            <h2 className="text-xl font-bold text-black mb-2">No interviews yet</h2>
            <p className="text-slate-500 mb-6">Start your first mock interview to see your progress.</p>
            <button onClick={() => navigate('/setup')} className="btn-primary-solid px-6 py-2.5">
              Practice Now
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Chart Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm"
            >
              <h2 className="text-lg font-bold text-black mb-6">Score Progression</h2>
              <div className="h-64 w-full">
                <Line data={chartData} options={chartOptions} />
              </div>
            </motion.div>

            {/* Table Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Role & Company</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Score</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap">
                          {new Date(session.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm font-bold text-black">{session.role || 'General Role'}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            {session.companyId && session.companyId !== 'general' && (
                              <span className="text-[10px] bg-[#5235A2]/10 text-[#5235A2] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                {session.companyId}
                              </span>
                            )}
                            <span>{session.company || 'Any Company'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
                            {session.interviewType || 'General'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold ${getScoreColor(session.overallScore)}`}>
                            {session.overallScore != null ? `${session.overallScore}/100` : 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <button
                            onClick={() => navigate(`/report/${session.id}`)}
                            className="text-xs font-bold text-[var(--brand-primary)] hover:text-purple-700 transition-colors mr-4"
                          >
                            View Report
                          </button>
                          <button
                            onClick={() => console.log('Downloading PDF for session:', session.id)}
                            className="text-xs font-bold text-slate-500 hover:text-black transition-colors"
                          >
                            Download PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
