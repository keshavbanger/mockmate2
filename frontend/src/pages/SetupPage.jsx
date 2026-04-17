import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { useInterview } from '../context/InterviewContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { createSession, parseResume, generateQuestions, startInterview } from '../utils/api.js';

const INTERVIEW_TYPES = ['Technical', 'Behavioral', 'HR', 'Mixed'];
const DIFFICULTIES    = ['Junior', 'Mid', 'Senior'];
const LANGUAGES       = ['English', 'Hindi', 'Hinglish'];

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 'md' }) {
  const sz = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  return (
    <svg className={`${sz} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
function SelectField({ label, value, onChange, options, icon }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <span>{icon}</span>{label}
      </label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} className="input-select pr-10">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── SetupPage ────────────────────────────────────────────────────────────────
export default function SetupPage() {
  const navigate = useNavigate();
  const ctx = useInterview();

  const { addToast, ToastContainer } = useToast();

  const [uploading,  setUploading]  = useState(false);
  const [starting,   setStarting]   = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [fileName,   setFileName]   = useState('');
  const [loadingText, setLoadingText] = useState('');

  const [type,       setType]       = useState('Technical');
  const [difficulty, setDifficulty] = useState('Mid');
  const [language,   setLanguage]   = useState('English');

  // ── Dropzone ─────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (accepted) => {
    const file = accepted[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      addToast('Please upload a PDF file.', 'warning');
      return;
    }
    setUploading(true);
    setFileName(file.name);

    try {
      // Create session first if needed
      let sid = ctx.sessionId;
      if (!sid) {
        const { data } = await createSession();
        sid = data.session_id;
        ctx.setSessionId(sid);
      }

      const { data } = await parseResume(file, sid);
      ctx.setResumeData(data.resume_data);
      setUploadDone(true);
    } catch (e) {
      addToast(e?.response?.data?.detail ?? 'Resume upload failed. Please try again.', 'error');
      setUploadDone(false);
    } finally {
      setUploading(false);
    }
  }, [ctx]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
  });

  // ── Start Interview ───────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!ctx.resumeData || !ctx.sessionId) return;
    setStarting(true);

    try {
      setLoadingText('Generating interview questions…');
      ctx.setInterviewConfig({ type, difficulty, language });
      const qRes = await generateQuestions({
        session_id:     ctx.sessionId,
        interview_type: type,
        difficulty,
        language,
      });
      ctx.setQuestions(qRes.data.questions);

      setLoadingText('Setting up your interview room…');
      const iRes = await startInterview(ctx.sessionId);
      ctx.setConversation({
        conversationUrl: iRes.data.conversation_url,
        conversationId:  iRes.data.conversation_id,
      });
      ctx.setStartTime(Date.now());
      ctx.setStatus('active');

      navigate('/interview');
    } catch (e) {
      addToast(e?.response?.data?.detail ?? 'Could not start the interview. Please try again.', 'error', 6000);
      setStarting(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const rd = ctx.resumeData;

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center p-6">
      <ToastContainer />
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px]
                        bg-brand-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-2xl animate-fade-in">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20
                          rounded-full px-4 py-1.5 mb-5">
            <span className="text-brand-400 text-sm font-semibold">🎙️ AI Mock Interview</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3">
            Ace Your Next Interview
          </h1>
          <p className="text-slate-400 text-lg">
            Upload your resume and let our AI interviewer help you prepare.
          </p>
        </div>

        <div className="card-glow p-8 space-y-8">

          {/* ── Step 1: Upload ── */}
          <div>
            <p className="metric-label mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full
                               bg-brand-500/20 text-brand-400 text-[10px] font-bold">1</span>
              Upload Your Resume
            </p>
            <div
              {...getRootProps()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                          transition-all duration-200
                          ${isDragActive
                            ? 'border-brand-400 bg-brand-500/10'
                            : uploadDone
                              ? 'border-emerald-500/50 bg-emerald-500/5'
                              : 'border-white/10 bg-surface-600/30 hover:border-brand-500/50 hover:bg-brand-500/5'
                          }`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Spinner />
                  <p className="text-slate-400 text-sm">Parsing resume…</p>
                </div>
              ) : uploadDone ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-emerald-400 font-semibold text-sm">{fileName}</p>
                  <p className="text-slate-500 text-xs">Click to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-brand-500/10 flex items-center justify-center">
                    <svg className="h-6 w-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {isDragActive ? 'Drop your PDF here' : 'Drag & drop your resume'}
                    </p>
                    <p className="text-slate-500 text-sm mt-1">or click to browse · PDF only · max 5 MB</p>
                  </div>
                </div>
              )}
            </div>

            {/* Parsed preview */}
            {rd && (
              <div className="mt-4 p-4 bg-surface-600/40 rounded-xl border border-white/5 animate-slide-up">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-full bg-brand-500/20 flex items-center justify-center
                                  text-brand-400 font-bold text-sm flex-shrink-0">
                    {rd.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{rd.name}</p>
                    <p className="text-slate-500 text-xs">{rd.email} · {rd.total_experience_years}y exp</p>
                  </div>
                </div>
                {rd.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {rd.skills.slice(0, 10).map(s => (
                      <span key={s} className="badge-purple text-[10px] px-2 py-0.5">{s}</span>
                    ))}
                    {rd.skills.length > 10 && (
                      <span className="badge bg-white/5 text-slate-500 text-[10px] px-2 py-0.5">
                        +{rd.skills.length - 10} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Step 2: Configure ── */}
          <div>
            <p className="metric-label mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full
                               bg-brand-500/20 text-brand-400 text-[10px] font-bold">2</span>
              Configure Interview
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SelectField label="Interview Type" value={type}       onChange={setType}       options={INTERVIEW_TYPES} icon="🎯" />
              <SelectField label="Difficulty"     value={difficulty} onChange={setDifficulty} options={DIFFICULTIES}    icon="📊" />
              <SelectField label="Language"       value={language}   onChange={setLanguage}   options={LANGUAGES}       icon="🌐" />
            </div>
          </div>

          {/* ── CTA ── */}
          <button
            onClick={handleStart}
            disabled={!uploadDone || starting}
            className="btn-primary w-full flex items-center justify-center gap-3 text-base py-4"
          >
            {starting ? (
              <>
                <Spinner size="sm" />
                <span>{loadingText}</span>
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Interview
              </>
            )}
          </button>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Your resume is processed securely and never stored permanently.
        </p>
      </div>
    </div>
  );
}
