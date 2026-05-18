import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { analyzeATS } from '../utils/api.js';

export default function ATSUploadPage() {
  const navigate = useNavigate();
  const [file,     setFile]     = useState(null);
  const [jdText,   setJdText]   = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSet(f);
  }, []);

  const validateAndSet = (f) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
      setError('Only PDF and DOCX files are supported.'); return;
    }
    setError(''); setFile(f);
  };

  const handleAnalyze = async () => {
    if (!file)          return setError('Please upload your resume.');
    if (!jdText.trim()) return setError('Please paste the job description.');
    setError(''); setLoading(true);
    try {
      const report = await analyzeATS(file, jdText);
      navigate(`/ats/report/${report.reportId}`);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif] overflow-x-hidden">

      {/* ── Floating Navbar ── */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-5 px-4 pointer-events-none">
        <motion.nav
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-4xl pointer-events-auto floating-nav justify-between"
        >
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white text-sm font-bold">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
            </div>
            <span className="font-bold tracking-tight text-xl text-black">MockMate</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/setup')}
              className="text-sm font-semibold text-slate-500 hover:text-black transition-colors nav-link">
              Practice Interview
            </button>
            <button onClick={() => navigate('/setup')}
              className="bg-[#111827] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-black transition-colors">
              Start Practicing
            </button>
          </div>
        </motion.nav>
      </div>

      {/* ── Background blobs ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -left-60 w-[400px] h-[400px] bg-indigo-200/15 rounded-full blur-[100px]" />
      </div>

      {/* ── Hero ── */}
      <div className="pt-36 pb-12 px-6 text-center max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 bg-[var(--brand-light)] text-[var(--brand-primary)] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
        >
          ✨ Analyze Resume
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl md:text-6xl font-extrabold tracking-tight text-[#111] leading-[1.15] mb-5"
        >
          Scan Your Resume Against<br />
          <span className="gradient-text">Any Job</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="text-slate-500 text-lg leading-relaxed max-w-xl mx-auto"
        >
          Upload your resume and paste the job description. Our AI will score your match,
          identify keyword gaps, and suggest targeted improvements.
        </motion.p>
      </div>

      {/* ── Upload Card ── */}
      <div className="max-w-2xl mx-auto px-6 space-y-5 pb-24">

        {/* Dropzone */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          className={`relative flex flex-col items-center justify-center gap-4 p-12 rounded-3xl border-2 border-dashed
            transition-all duration-300 cursor-pointer overflow-hidden
            ${dragging ? 'border-[var(--brand-primary)] bg-[var(--brand-light)]' :
              file ? 'border-emerald-400 bg-emerald-50/60' :
              'border-black/10 bg-white hover:border-[var(--brand-primary)] hover:bg-[var(--brand-light)]/40'}
            shadow-sm`}
        >
          <input id="ats-file-input" type="file" accept=".pdf,.docx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSet(f); }}
            className="absolute inset-0 opacity-0 cursor-pointer" />

          {file ? (
            <>
              <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl">📄</div>
              <p className="font-bold text-emerald-700 text-base">{file.name}</p>
              <p className="text-xs text-slate-400 font-semibold">{(file.size / 1024).toFixed(1)} KB · Click or drag to replace</p>
            </>
          ) : (
            <>
              <div className="h-16 w-16 rounded-2xl bg-[var(--brand-light)] flex items-center justify-center text-2xl">📂</div>
              <div className="text-center">
                <p className="font-bold text-black text-base">
                  Drop your resume here, or <span className="text-[var(--brand-primary)] underline underline-offset-2">browse</span>
                </p>
                <p className="text-sm text-slate-400 font-medium mt-1">PDF or DOCX · Max 10 MB</p>
              </div>
            </>
          )}
        </motion.div>

        {/* JD Textarea */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.38 }}
          className="bg-white border border-black/[0.05] rounded-3xl p-7 shadow-sm"
        >
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4">
            Paste Job Description
          </label>
          <textarea
            id="ats-jd-textarea"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the full job description here — requirements, responsibilities, and any listed skills..."
            rows={9}
            className="w-full text-sm text-[#111] font-medium leading-relaxed placeholder:text-slate-300
                       resize-none outline-none bg-transparent"
          />
          <div className="flex justify-end mt-3 border-t border-black/[0.04] pt-3">
            <span className="text-[10px] text-slate-300 font-semibold">{jdText.length} characters</span>
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-semibold text-red-600">
            <span className="text-base">⚠</span> {error}
          </motion.div>
        )}

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.46 }}
        >
          <motion.button
            id="ats-analyze-btn"
            onClick={handleAnalyze}
            disabled={loading}
            whileHover={!loading ? { scale: 1.02, boxShadow: '0 16px 40px rgba(107,70,193,0.30)' } : {}}
            whileTap={!loading ? { scale: 0.97 } : {}}
            className="w-full py-4 rounded-full bg-[var(--brand-primary)] text-white font-bold text-base
                       uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-3 shadow-lg shadow-purple-900/20 btn-lift"
          >
            {loading ? (
              <>
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing Resume...
              </>
            ) : (
              '🔍 Analyze Resume'
            )}
          </motion.button>
        </motion.div>

        <p className="text-center text-xs text-slate-400 font-medium">
          Powered by <span className="font-bold text-slate-500">Groq llama-3.3-70b</span> · Results in ~5 seconds
        </p>
      </div>
    </div>
  );
}
