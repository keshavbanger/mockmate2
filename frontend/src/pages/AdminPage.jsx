import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { listUsers, updateUserPlan, updateUserRole } from '../utils/adminApi';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  // Client-side redirect for UX only — the real enforcement is server-side
  // in AdminController, which every call below still goes through.
  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'ADMIN') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const reload = () => {
    setLoading(true);
    listUsers()
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handlePlanChange = async (id, planType) => {
    setSavingId(id);
    try {
      const updated = await updateUserPlan(id, planType);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (e) {
      alert(e.message || 'Failed to update plan');
    } finally {
      setSavingId(null);
    }
  };

  const handleRoleChange = async (id, role) => {
    if (id === user?.id && role !== 'ADMIN' && !window.confirm('Remove your own admin access? You will lose access to this panel.')) {
      return;
    }
    setSavingId(id);
    try {
      const updated = await updateUserRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (e) {
      alert(e.message || 'Failed to update role');
    } finally {
      setSavingId(null);
    }
  };

  if (authLoading || !user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif]">
      <Navbar />
      <div className="pt-28 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-black mb-2">Admin Panel</h1>
            <p className="text-slate-500">Manage who has access to paid features and admin rights. {users.length} user{users.length === 1 ? '' : 's'} total.</p>
          </motion.div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]" />
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>
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
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">User</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Joined</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Login</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Plan</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="text-sm font-bold text-black">{u.fullName || '—'}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                        <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap">{formatDate(u.lastLogin)}</td>
                        <td className="py-4 px-6">
                          <select
                            value={u.planType}
                            disabled={savingId === u.id}
                            onChange={(e) => handlePlanChange(u.id, e.target.value)}
                            className={`text-xs font-bold px-2.5 py-1.5 rounded-full border cursor-pointer disabled:opacity-50 ${
                              u.planType === 'PRO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <option value="FREE">FREE</option>
                            <option value="PRO">PRO</option>
                          </select>
                        </td>
                        <td className="py-4 px-6">
                          <select
                            value={u.role}
                            disabled={savingId === u.id}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className={`text-xs font-bold px-2.5 py-1.5 rounded-full border cursor-pointer disabled:opacity-50 ${
                              u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
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
