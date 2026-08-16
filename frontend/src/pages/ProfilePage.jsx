import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../utils/api.js';
import { useSavedResumes } from '../hooks/useSavedResumes';
import { uploadSavedResume, renameSavedResume, setDefaultSavedResume, deleteSavedResume } from '../utils/savedResumeApi';

function scoreColor(score) {
  if (score >= 75) return { bg: 'bg-emerald-50', text: 'text-emerald-600' };
  if (score >= 50) return { bg: 'bg-amber-50', text: 'text-amber-600' };
  return { bg: 'bg-red-50', text: 'text-red-500' };
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Saved resumes — upload once here, reuse from any feature (Mock
  // Interview, Technical Interview Lab, ATS Checker, Resume Builder import)
  // via ResumeSourcePicker instead of re-uploading every time.
  const { resumes: savedResumes, loading: savedLoading, reload: reloadSaved } = useSavedResumes();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUploadSaved = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      await uploadSavedResume(uploadFile, { label: uploadLabel, setAsDefault: savedResumes.length === 0 });
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadLabel('');
      reloadSaved();
    } catch (err) {
      alert(err.message || 'Failed to upload resume.');
    } finally {
      setUploading(false);
    }
  };

  const handleSetDefaultSaved = async (id) => {
    try {
      await setDefaultSavedResume(id);
      reloadSaved();
    } catch (err) {
      alert(err.message || 'Failed to set default resume.');
    }
  };

  const handleRenameSaved = async (id, currentLabel) => {
    const next = window.prompt('Rename resume', currentLabel);
    if (!next || next === currentLabel) return;
    try {
      await renameSavedResume(id, next);
      reloadSaved();
    } catch (err) {
      alert(err.message || 'Failed to rename resume.');
    }
  };

  const handleDeleteSaved = async (id) => {
    if (!window.confirm('Delete this saved resume? This cannot be undone.')) return;
    try {
      await deleteSavedResume(id);
      reloadSaved();
    } catch (err) {
      alert(err.message || 'Failed to delete resume.');
    }
  };

  useEffect(() => {
    if (authLoading) return;
    getUserProfile()
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.error || 'Failed to load your profile.'))
      .finally(() => setLoading(false));
  }, [authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]" />
      </div>
    );
  }

  const profile = data?.profile;
  const interviews = data?.interviews || [];
  const resumes = data?.resumes || [];
  const lastInterview = data?.lastInterview;
  const lastResume = data?.lastResume;

  const displayName = profile?.fullName || user?.fullName || user?.full_name || 'there';
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  // Whichever of the two "last activity" candidates is more recent — a
  // user's most recent thing might be a resume scan, not an interview.
  const lastActivity = [lastInterview && { ...lastInterview, kind: 'interview' }, lastResume && { ...lastResume, kind: 'resume' }]
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center gap-6 mb-10 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm"
        >
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#6B46C1] to-[#5b3da6] flex items-center justify-center text-white text-2xl font-black overflow-hidden flex-shrink-0">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight truncate">{displayName}</h1>
            <p className="text-slate-500 text-sm mt-1 truncate">{profile?.email}</p>
            {profile?.memberSince && (
              <p className="text-slate-400 text-xs mt-1">Member since {formatDate(profile.memberSince)}</p>
            )}
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs py-2.5 px-5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors font-bold text-slate-700"
            >
              🏠 Dashboard
            </button>
          </div>
        </motion.div>

        {/* Last Session Highlight */}
        {lastActivity && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-10 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-3xl p-7 flex items-center gap-5"
          >
            <div className="h-12 w-12 rounded-2xl bg-purple-600 flex items-center justify-center text-xl flex-shrink-0 shadow-lg shadow-purple-200">
              {lastActivity.kind === 'interview' ? '🎤' : '📄'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-purple-600 uppercase tracking-widest mb-1">Last Session</p>
              <p className="text-base font-bold text-slate-900 truncate">
                {lastActivity.kind === 'interview'
                  ? `Interview — ${lastActivity.role || 'General'}${lastActivity.company ? ` @ ${lastActivity.company}` : ''}`
                  : `Resume Scan — ${lastActivity.fileName || 'Untitled resume'}`}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{formatDate(lastActivity.date)}</p>
            </div>
            <button
              onClick={() => navigate(lastActivity.kind === 'interview' ? `/report/${lastActivity.id}` : `/ats/report/${lastActivity.reportId}`)}
              className="text-sm font-bold px-5 py-2.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors flex-shrink-0"
            >
              View →
            </button>
          </motion.div>
        )}

        {/* My Saved Resumes — upload once, reuse everywhere */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">My Saved Resumes</h2>
              <p className="text-xs text-slate-400 mt-0.5">Upload once here — every feature that needs a resume will offer to reuse it.</p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors"
            >
              + Upload Resume
            </button>
          </div>

          {savedLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--brand-primary)]" />
            </div>
          ) : savedResumes.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-10 text-center">
              <div className="text-3xl mb-3">📎</div>
              <p className="text-sm font-semibold text-slate-500 mb-1">No saved resumes yet</p>
              <p className="text-xs text-slate-400 mb-4">Upload a resume here to reuse it across Mock Interview, Technical Interview Lab, ATS Checker, and Resume Builder — no re-uploading.</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="text-xs font-bold px-5 py-2.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Upload Your First Resume
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {savedResumes.map((r) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate" title={r.label}>{r.label || r.fileName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{r.fileName} · {formatDate(r.uploadedAt)}</p>
                    </div>
                    {r.isDefault && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">Default</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-auto pt-2">
                    {!r.isDefault && (
                      <button
                        onClick={() => handleSetDefaultSaved(r.id)}
                        className="text-xs font-bold py-2 px-3 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleRenameSaved(r.id, r.label)}
                      className="text-xs font-bold py-2 px-3 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(r.id)}
                      className="text-xs font-bold py-2 px-3 rounded-full border border-red-100 hover:bg-red-50 transition-colors text-red-500 ml-auto"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {showUploadModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => !uploading && setShowUploadModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-2xl w-full max-w-md"
            >
              <h3 className="text-base font-extrabold text-slate-900 mb-1">Upload Resume</h3>
              <p className="text-xs text-slate-500 font-medium mb-5">PDF or DOCX. This will be reusable across every feature.</p>

              <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[var(--brand-primary)] cursor-pointer transition-colors mb-4">
                <span className="text-2xl">📄</span>
                <span className="text-sm font-semibold text-slate-600">{uploadFile ? uploadFile.name : 'Click to choose a file'}</span>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </label>

              <input
                type="text"
                value={uploadLabel}
                onChange={(e) => setUploadLabel(e.target.value)}
                placeholder="Label (optional) — e.g. Backend Resume"
                className="w-full text-sm px-3 py-2.5 rounded-lg border border-black/10 focus:border-[var(--brand-primary)] outline-none mb-5"
              />

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  className="text-xs font-bold text-slate-500 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadSaved}
                  disabled={!uploadFile || uploading}
                  className="text-xs font-bold text-white bg-[#6B46C1] px-5 py-2.5 rounded-xl hover:bg-[#5b3da6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading…' : 'Save Resume'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Your ATS Scans */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900">Your ATS Scans</h2>
            <button
              onClick={() => navigate('/ats')}
              className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors"
            >
              + Scan New Resume
            </button>
          </div>

          {resumes.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-10 text-center">
              <div className="text-3xl mb-3">📄</div>
              <p className="text-sm font-semibold text-slate-500 mb-1">No resumes scanned yet</p>
              <p className="text-xs text-slate-400 mb-4">Upload a resume to get an ATS score and start building your resume history here.</p>
              <button
                onClick={() => navigate('/ats')}
                className="text-xs font-bold px-5 py-2.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Scan Your First Resume
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {resumes.map((r) => {
                const colors = scoreColor(r.score || 0);
                return (
                  <div key={r.reportId} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate" title={r.fileName}>
                          {r.fileName || 'Untitled resume'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(r.date)}</p>
                      </div>
                      <div className={`h-10 w-10 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-xs font-black flex-shrink-0 ml-2`}>
                        {r.score ?? '—'}
                      </div>
                    </div>
                    {r.verdict && (
                      <p className="text-xs text-slate-500 mb-4 line-clamp-2 flex-1">{r.verdict}</p>
                    )}
                    <div className="flex gap-2 mt-auto pt-2">
                      <button
                        onClick={() => navigate(`/ats/report/${r.reportId}`)}
                        className="flex-1 text-xs font-bold py-2 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700"
                      >
                        View Report
                      </button>
                      <button
                        onClick={() => navigate(`/ats/studio/${r.reportId}`)}
                        className="flex-1 text-xs font-bold py-2 rounded-full bg-slate-950 hover:bg-slate-900 text-white transition-colors"
                      >
                        Customize
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Your Interview Sessions */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900">Your Interview Sessions</h2>
            <button
              onClick={() => navigate('/history')}
              className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors"
            >
              View Full History
            </button>
          </div>

          {interviews.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-10 text-center">
              <div className="text-3xl mb-3">🎤</div>
              <p className="text-sm font-semibold text-slate-500 mb-1">No interviews completed yet</p>
              <p className="text-xs text-slate-400 mb-4">Practice a behavioral or technical interview to start tracking your progress.</p>
              <button
                onClick={() => navigate('/setup')}
                className="text-xs font-bold px-5 py-2.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Start Your First Interview
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl divide-y divide-slate-100 overflow-hidden">
              {interviews.slice(0, 10).map((i) => {
                const colors = scoreColor(i.score || 0);
                return (
                  <div
                    key={i.id}
                    onClick={() => navigate(`/report/${i.id}`)}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                      🎤
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {i.role || 'General'}{i.company ? ` @ ${i.company}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(i.date)}{i.interviewType ? ` · ${i.interviewType}` : ''}
                      </p>
                    </div>
                    <div className={`text-sm font-black ${colors.text}`}>{i.score}/100</div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>
      </main>
    </div>
  );
}
