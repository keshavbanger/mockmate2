import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getTechInterviewHistory } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';

export default function TechInterviewHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const res = await getTechInterviewHistory(user.id);
        setHistory(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Failed to load tech interview history', err);
        setError('Could not load your Technical Interview Lab history.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading]);

  const getScoreColor = (score) => {
    if (score == null) return 'bg-slate-100 text-slate-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif]">
      <Navbar />
      <div className="pt-28 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center justify-between"
          >
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">Technical Interview Reports</h1>
              <p className="text-slate-500">Every completed DSA/coding interview session, in one place.</p>
            </div>
            <button onClick={() => navigate('/tech-interview/setup')} className="btn-primary-solid px-5 py-2">
              New Interview
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
              <div className="text-4xl mb-4">💻</div>
              <h2 className="text-xl font-bold text-black mb-2">No completed interviews yet</h2>
              <p className="text-slate-500 mb-6">Finish a Technical Interview Lab session to see its report here.</p>
              <button onClick={() => navigate('/tech-interview/setup')} className="btn-primary-solid px-6 py-2.5">
                Start a Technical Interview
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Role Level</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Score</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((entry) => (
                      <tr key={entry.sessionId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap">
                          {entry.date ? new Date(entry.date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-black">{entry.role || 'N/A'}</td>
                        <td className="py-4 px-6">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
                            {entry.interviewType || 'General'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold ${getScoreColor(entry.overallScore)}`}>
                            {entry.overallScore != null ? `${entry.overallScore}/100` : 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <button
                            onClick={() => navigate(`/tech-interview/report/${entry.sessionId}`)}
                            className="text-xs font-bold text-[var(--brand-primary)] hover:text-purple-700 transition-colors"
                          >
                            View Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
