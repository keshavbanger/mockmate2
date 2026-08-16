import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate }           from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeATS, compareResumes } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import LoginModal from '../components/LoginModal.jsx';
import ResumeSourcePicker from '../components/shared/ResumeSourcePicker.jsx';

const STEPS = [
  'Extracting resume text…',
  'Running keyword analysis…',
  'Getting AI insights…',
  'Building your report…',
];

// Matches the "Max 10 MB" copy shown next to every dropzone — that copy used
// to be purely cosmetic since only the file extension was checked, so an
// oversized file passed client validation and only failed late, at the
// backend, with a generic error.
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function validateFile(f) {
  const name = f.name.toLowerCase();
  if (!name.endsWith('.pdf') && !name.endsWith('.docx')) return 'Only PDF and DOCX files are supported.';
  if (f.size > MAX_FILE_SIZE) return `File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB) — max size is 10 MB.`;
  return null;
}

function Dropzone({ label, file, onFile, onError, id }) {
  const [dragging, setDragging] = useState(false);

  const validate = (f) => {
    const err = validateFile(f);
    if (err) { onError?.(err); return false; }
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
  const { isAuthenticated } = useAuth();

  const [showLoginModal, setShowLoginModal] = useState(false);

  // Single mode — either an upload ({mode:'upload', file, saveAsResume, label})
  // or a previously saved resume ({mode:'saved', savedResumeId}), see
  // ResumeSourcePicker.
  const [resumeSource, setResumeSource] = useState(null);
  // Compare mode
  const [fileA,  setFileA]  = useState(null);
  const [fileB,  setFileB]  = useState(null);
  // Shared
  const [jdText,   setJdText]   = useState('');
  const [compare,  setCompare]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [stepIdx,  setStepIdx]  = useState(0);
  const [error,    setError]    = useState('');

  // Tracks the fake-progress interval so it can be torn down from both the
  // unmount cleanup below AND handleAnalyze's finally block — it used to
  // only clear itself after 4 ticks (~7.2s), so navigating away mid-request
  // (or a request that ran longer than that) left it calling setStepIdx on
  // an unmounted component for the rest of its run.
  const stepIntervalRef = useRef(null);

  useEffect(() => () => clearInterval(stepIntervalRef.current), []);

  /* Animate through loading steps */
  const runSteps = () => {
    let i = 0;
    stepIntervalRef.current = setInterval(() => {
      i++;
      if (i < STEPS.length) setStepIdx(i);
      else clearInterval(stepIntervalRef.current);
    }, 1800);
  };

  const handleAnalyze = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (loading) return; // guards against a double-click landing before disabled= takes effect
    const singleModeReady = compare || (resumeSource?.mode === 'saved' && resumeSource.savedResumeId)
      || (resumeSource?.mode === 'upload' && resumeSource.file);
    if (!singleModeReady)   return setError('Please choose a resume.');
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
        const report = await analyzeATS(resumeSource, jdText);
        navigate(`/ats/report/${report.reportId}`);
      }
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      clearInterval(stepIntervalRef.current);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif] overflow-x-hidden">

      <Navbar />

      {/* ── Background blobs ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -left-60 w-[400px] h-[400px] bg-indigo-200/15 rounded-full blur-[100px]" />
      </div>

      {/* ── Hero ── */}
      <div className="pt-32 pb-8 px-6 text-center max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 bg-[var(--brand-light)] text-[var(--brand-primary)] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
        >
          ✨ ATS Resume Checker
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#111] leading-[1.15] mb-4"
        >
          Scan Your Resume Against<br />
          <span className="gradient-text">Any Job Description</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }}
          className="text-slate-500 text-base leading-relaxed max-w-xl mx-auto"
        >
          Upload your resume and paste the job description. Our AI will score your match,
          identify keyword gaps, and suggest targeted improvements.
        </motion.p>
      </div>

      {/* ── Upload Card ── */}
      <div className="max-w-5xl mx-auto px-6 space-y-5 pb-20">

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
              <Dropzone label="Resume A" file={fileA} onFile={setFileA} onError={setError} id="ats-file-a" />
              <Dropzone label="Resume B" file={fileB} onFile={setFileB} onError={setError} id="ats-file-b" />
            </motion.div>
          ) : (
            <motion.div
              key="single"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="bg-white border border-black/[0.05] rounded-3xl p-7 shadow-sm"
            >
              <ResumeSourcePicker onChange={setResumeSource} />
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

        {/* ── How it Works Section ── */}
        <section className="pt-24 pb-12">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
              How it <span className="text-[#6B46C1]">Works</span>
            </h2>
            <p className="text-slate-500 text-sm sm:text-base font-medium leading-relaxed">
              From uploading your resume to receiving improvement insights, your AI resume analysis is ready in minutes.
            </p>
          </div>

          {/* Step 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mb-24">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="order-2 lg:order-1 space-y-4"
            >
              <div className="inline-flex items-center gap-3">
                <span className="h-8 w-8 rounded-full bg-[#6B46C1] text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                  1
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#6B46C1]">
                  STEP 01
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Upload Your Resume
              </h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-md">
                Upload the resume you want to analyze to review your skills, experience, formatting and overall structure and understand how well your resume is prepared.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-purple-50 text-[#6B46C1] font-bold text-xs px-4 py-2 rounded-full border border-purple-100 shadow-sm">
                  Resume Upload
                </span>
              </div>
            </motion.div>

            {/* Mock Card 1 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="order-1 lg:order-2 bg-gradient-to-br from-purple-50/60 to-white p-6 rounded-3xl border border-purple-100 shadow-xl shadow-purple-900/5"
            >
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Upload Resume</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Upload your existing resume PDF and let AI extract and analyze it instantly.</p>
                  </div>
                </div>
                <div className="border-2 border-dashed border-purple-200 bg-purple-50/30 rounded-xl p-6 text-center">
                  <p className="text-[11px] font-bold text-[#6B46C1]">Drag & drop your resume here or click to upload</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">ENTER YOUR DESIRED ROLE</label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-medium">
                    e.g. Product Manager / Digital Marketing Manager
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-purple-100 text-[#6B46C1] flex items-center justify-center text-[10px] font-bold">📄</span>
                    <span className="text-[10px] font-bold text-slate-700">Add Job Description</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">Optional</span>
                    <span className="text-[10px] bg-[#6B46C1] text-white font-bold px-3 py-1 rounded-lg shadow-sm">🔍 ANALYZE</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Step 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mb-24">
            {/* Mock Card 2 */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="order-1 bg-gradient-to-br from-purple-50/60 to-white p-6 rounded-3xl border border-purple-100 shadow-xl shadow-purple-900/5"
            >
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Upload Resume</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Upload your existing resume PDF and let AI extract and analyze it instantly.</p>
                  </div>
                </div>
                <div className="border border-emerald-300 bg-emerald-50/50 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                    <span className="text-xs font-bold text-emerald-800">marketing_executive_CV_template_sample.pdf</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold">Parsed</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">ENTER YOUR DESIRED ROLE</label>
                  <div className="w-full bg-white border border-purple-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-bold shadow-sm">
                    Marketing Manager
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-purple-100 text-[#6B46C1] flex items-center justify-center text-[10px] font-bold">📝</span>
                    <span className="text-[10px] font-bold text-slate-700">Add Job Description</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-purple-100 text-[#6B46C1] font-bold px-2 py-0.5 rounded-full">Optimize</span>
                    <span className="text-[10px] bg-[#6B46C1] text-white font-bold px-3 py-1 rounded-lg shadow-sm">🔍 ANALYZE</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="order-2 space-y-4"
            >
              <div className="inline-flex items-center gap-3">
                <span className="h-8 w-8 rounded-full bg-[#6B46C1] text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                  2
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#6B46C1]">
                  STEP 02
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Add Role and Job Description
              </h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-md">
                Enter the role you are applying for and paste or upload the job description. This allows the analysis to evaluate how well your resume aligns with the position and its requirements.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-purple-50 text-[#6B46C1] font-bold text-xs px-4 py-2 rounded-full border border-purple-100 shadow-sm">
                  Role & JD Input
                </span>
              </div>
            </motion.div>
          </div>

          {/* Step 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="order-2 lg:order-1 space-y-4"
            >
              <div className="inline-flex items-center gap-3">
                <span className="h-8 w-8 rounded-full bg-[#6B46C1] text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                  3
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#6B46C1]">
                  STEP 03
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Get Resume Improvement Insights
              </h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-md">
                Receive a detailed resume report that highlights how your skills and experience match the role, checks keyword relevance and ATS compatibility, and provides suggestions to improve your resume.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-purple-50 text-[#6B46C1] font-bold text-xs px-4 py-2 rounded-full border border-purple-100 shadow-sm">
                  Resume Insights
                </span>
              </div>
            </motion.div>

            {/* Mock Card 3 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="order-1 lg:order-2 bg-gradient-to-br from-purple-50/60 to-white p-6 rounded-3xl border border-purple-100 shadow-xl shadow-purple-900/5"
            >
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Analysis Report</span>
                    <span className="text-[9px] bg-purple-100 text-[#6B46C1] font-bold px-2 py-0.5 rounded-full">Realtime AI</span>
                  </div>
                  <span className="text-[10px] text-purple-600 font-bold border border-purple-200 px-2 py-0.5 rounded-lg">↺ Analyze again</span>
                </div>
                <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#6B46C1] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                      70
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Overall Match Score</p>
                      <p className="text-[10px] text-purple-700 font-medium">Strong match with room for targeted optimization</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50 flex items-start gap-2">
                    <span className="text-xs">✅</span>
                    <div className="text-[10px]">
                      <span className="font-bold text-slate-800">Formatting & Structure: </span>
                      <span className="text-slate-600">Clean single-column layout passes all major parser filters.</span>
                    </div>
                  </div>
                  <div className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50 flex items-start gap-2">
                    <span className="text-xs">🎯</span>
                    <div className="text-[10px]">
                      <span className="font-bold text-slate-800">Keyword Alignment: </span>
                      <span className="text-slate-600">Matched 14/18 core role competencies from job description.</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
      <Footer />

      {/* Login Required Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Log In to Analyze Resume"
        message="Please sign in or create a free account to run hard-truth ATS resume scoring and get recruiter insights."
      />
    </div>
  );
}
