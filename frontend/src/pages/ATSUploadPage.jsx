import { useState, useCallback } from 'react';
import { useNavigate }           from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeATS, compareResumes } from '../utils/api.js';

const STEPS = [
  'Extracting resume text…',
  'Running keyword analysis…',
  'Getting AI insights…',
  'Building your report…',
];

function Dropzone({ label, file, onFile, id }) {
  const [dragging, setDragging] = useState(false);

  const validate = (f) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) return false;
    onFile(f);
    return true;
  };

  return (
    <div
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) validate(f); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed
        transition-all duration-300 cursor-pointer overflow-hidden
        ${dragging ? 'border-[var(--brand-primary)] bg-[var(--brand-light)]' :
          file ? 'border-emerald-400 bg-emerald-50/60' :
          'border-black/10 bg-white hover:border-[var(--brand-primary)] hover:bg-[var(--brand-light)]/40'}
        shadow-sm`}
    >
      <input id={id} type="file" accept=".pdf,.docx"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) validate(f); }}
        className="absolute inset-0 opacity-0 cursor-pointer" />
      {file ? (
        <>
          <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center text-xl">📄</div>
          <p className="font-bold text-emerald-700 text-sm text-center leading-tight">{file.name}</p>
          <p className="text-[10px] text-slate-400 font-semibold">{(file.size / 1024).toFixed(1)} KB · Click to replace</p>
        </>
      ) : (
        <>
          <div className="h-12 w-12 rounded-xl bg-[var(--brand-light)] flex items-center justify-center text-xl">📂</div>
          <div className="text-center">
            <p className="font-bold text-black text-sm">
              {label} — <span className="text-[var(--brand-primary)] underline underline-offset-2">browse</span>
            </p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">PDF or DOCX · Max 10 MB</p>
          </div>
        </>
      )}
    </div>
  );
}

export default function ATSUploadPage() {
  const navigate = useNavigate();

  // Single mode
  const [file,   setFile]   = useState(null);
  // Compare mode
  const [fileA,  setFileA]  = useState(null);
  const [fileB,  setFileB]  = useState(null);
  // Shared
  const [jdText,   setJdText]   = useState('');
  const [compare,  setCompare]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [stepIdx,  setStepIdx]  = useState(0);
  const [error,    setError]    = useState('');

  /* Animate through loading steps */
  const runSteps = () => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i < STEPS.length) setStepIdx(i);
      else clearInterval(iv);
    }, 1800);
  };

  const handleAnalyze = async () => {
    if (!compare && !file)   return setError('Please upload your resume.');
    if (compare && (!fileA || !fileB)) return setError('Please upload both resumes for comparison.');
    if (!jdText.trim())      return setError('Please paste the job description.');
    if (jdText.trim().length < 100)
      return setError('Job description is too short — please paste the full JD (min 100 characters).');

    setError(''); setLoading(true); setStepIdx(0); runSteps();

    try {
      if (compare) {
        const result = await compareResumes(fileA, fileB, jdText);
        navigate('/ats/compare', { state: { result } });
      } else {
        const report = await analyzeATS(file, jdText);
        navigate(`/ats/report/${report.reportId}`);
      }
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif] overflow-x-hidden">

      {/* ── Floating Navbar ── */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-5 px-4 pointer-events-none">
        <motion.nav
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-4xl pointer-events-auto floating-nav relative flex items-center justify-between shadow-sm bg-white/95 backdrop-blur-xl py-3 px-5 rounded-2xl"
        >
          {/* Left: Logo & Back */}
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white text-sm font-bold">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
              </div>
              <span className="font-bold tracking-tight text-xl text-black">MockMate</span>
            </button>
            <div className="w-px h-6 bg-slate-200 hidden sm:block" />
            <button onClick={() => navigate(-1)} className="hidden sm:flex text-sm font-semibold text-slate-500 hover:text-black items-center gap-1 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back
            </button>
          </div>

          {/* Center: Title */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
              ATS Score Checker
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/setup')}
              className="text-xs py-2.5 px-4 rounded-full border-[1.5px] border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-light)] transition-colors font-bold whitespace-nowrap">
              Practice Interview
            </button>
            <button onClick={() => navigate('/setup')}
              className="text-xs py-2.5 px-5 rounded-full bg-[#111827] hover:bg-black text-white font-bold transition-colors shadow-sm disabled:opacity-60 whitespace-nowrap">
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
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 bg-[var(--brand-light)] text-[var(--brand-primary)] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
        >
          ✨ ATS Resume Checker
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl md:text-6xl font-extrabold tracking-tight text-[#111] leading-[1.15] mb-5"
        >
          Scan Your Resume Against<br />
          <span className="gradient-text">Any Job</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }}
          className="text-slate-500 text-lg leading-relaxed max-w-xl mx-auto"
        >
          Upload your resume and paste the job description. Our AI will score your match,
          identify keyword gaps, and suggest targeted improvements.
        </motion.p>
      </div>

      {/* ── Upload Card ── */}
      <div className="max-w-2xl mx-auto px-6 space-y-5 pb-28">

        {/* Mode toggle */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.28 }}
          className="flex items-center gap-3 bg-white border border-black/[0.05] rounded-2xl p-2 shadow-sm"
        >
          <button
            onClick={() => setCompare(false)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              !compare ? 'bg-[var(--brand-primary)] text-white shadow-sm' : 'text-slate-500 hover:text-black'
            }`}
          >
            📄 Single Resume
          </button>
          <button
            onClick={() => setCompare(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              compare ? 'bg-[var(--brand-primary)] text-white shadow-sm' : 'text-slate-500 hover:text-black'
            }`}
          >
            ⚖️ Compare Two Resumes
          </button>
        </motion.div>

        {/* Dropzone(s) */}
        <AnimatePresence mode="wait">
          {compare ? (
            <motion.div
              key="compare"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-2 gap-4"
            >
              <Dropzone label="Resume A" file={fileA} onFile={setFileA} id="ats-file-a" />
              <Dropzone label="Resume B" file={fileB} onFile={setFileB} id="ats-file-b" />
            </motion.div>
          ) : (
            <motion.div
              key="single"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { const n = f.name.toLowerCase(); if (!n.endsWith('.pdf') && !n.endsWith('.docx')) { setError('Only PDF and DOCX files are supported.'); return; } setError(''); setFile(f); }}}
              onDragOver={(e) => e.preventDefault()}
              className={`relative flex flex-col items-center justify-center gap-4 p-12 rounded-3xl border-2 border-dashed
                transition-all duration-300 cursor-pointer overflow-hidden shadow-sm
                ${file ? 'border-emerald-400 bg-emerald-50/60' :
                  'border-black/10 bg-white hover:border-[var(--brand-primary)] hover:bg-[var(--brand-light)]/40'}`}
            >
              <input id="ats-file-input" type="file" accept=".pdf,.docx"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { const n = f.name.toLowerCase(); if (!n.endsWith('.pdf') && !n.endsWith('.docx')) { setError('Only PDF and DOCX files are supported.'); return; } setError(''); setFile(f); }}}
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
          )}
        </AnimatePresence>

        {/* JD Textarea */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.38 }}
          className="bg-white border border-black/[0.05] rounded-3xl p-7 shadow-sm"
        >
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4">
            Paste Job Description
          </label>
          <textarea
            id="ats-jd-textarea"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the full job description here — requirements, responsibilities, and any listed skills…"
            rows={9}
            className="w-full text-sm text-[#111] font-medium leading-relaxed placeholder:text-slate-300
                       resize-none outline-none bg-transparent"
          />
          <div className="flex justify-between items-center mt-3 border-t border-black/[0.04] pt-3">
            <span className={`text-[10px] font-semibold ${jdText.length < 100 ? 'text-red-400' : 'text-emerald-500'}`}>
              {jdText.length < 100 ? `${100 - jdText.length} more chars needed` : `✓ ${jdText.length} characters`}
            </span>
            {jdText.length > 0 && (
              <button onClick={() => setJdText('')} className="text-[10px] text-slate-300 hover:text-red-400 transition-colors font-semibold">
                Clear
              </button>
            )}
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-semibold text-red-600">
            <span className="text-base">⚠</span> {error}
          </motion.div>
        )}

        {/* Loading steps */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white border border-black/[0.05] rounded-2xl p-5 shadow-sm">
            {STEPS.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 py-2 transition-all duration-500 ${
                i === stepIdx ? 'opacity-100' : i < stepIdx ? 'opacity-40' : 'opacity-20'
              }`}>
                {i < stepIdx ? (
                  <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black flex-shrink-0">✓</span>
                ) : i === stepIdx ? (
                  <div className="h-5 w-5 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin flex-shrink-0" />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-slate-100 flex-shrink-0" />
                )}
                <span className={`text-sm font-semibold ${i === stepIdx ? 'text-[#111]' : 'text-slate-400'}`}>{step}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.46 }}
        >
          <motion.button
            id="ats-analyze-btn"
            onClick={handleAnalyze}
            disabled={loading}
            whileHover={!loading ? { scale: 1.02, boxShadow: '0 16px 40px rgba(107,70,193,0.30)' } : {}}
            whileTap={!loading ? { scale: 0.97 } : {}}
            className="w-full py-4 rounded-full bg-[var(--brand-primary)] text-white font-bold text-base
                       uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-3 shadow-lg shadow-purple-900/20"
          >
            {loading
              ? <><svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Analyzing…</>
              : compare ? '⚖️ Compare Resumes' : '🔍 Analyze Resume'
            }
          </motion.button>
        </motion.div>

        <p className="text-center text-xs text-slate-400 font-medium">
          Powered by <span className="font-bold text-slate-500">Groq llama-3.3-70b</span> · Results in ~10 seconds
        </p>
      </div>
    </div>
  );
}
