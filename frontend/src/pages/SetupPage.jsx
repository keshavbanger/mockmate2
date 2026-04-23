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
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6">
      <ToastContainer />
      
      <div className="relative w-full max-w-2xl animate-fade-up">
        {/* Header */}
        <div className="text-center mb-10">
          {/* MockMate logo */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-full bg-[#6B46C1] flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
            <span className="text-black font-bold text-xl tracking-tight">MockMate</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20
                          rounded-full px-4 py-1.5 mb-5">
            <span className="text-purple-600 text-[10px] font-bold uppercase tracking-widest">🎙️ AI Mock Interview</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-black mb-3">
            Ace Your Next Interview
          </h1>
          <p className="text-slate-500 text-lg">
            Upload your resume and let our AI interviewer help you prepare.
          </p>
        </div>

        <div className="premium-card p-8 space-y-8">

          {/* ── Step 1: Upload ── */}
          <div>
            <span className="step-label mb-3">Step 1: Upload Your Resume</span>
            <div
              {...getRootProps()}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
                          transition-all duration-300
                          ${isDragActive
                            ? 'border-purple-400 bg-purple-500/5'
                            : uploadDone
                              ? 'border-purple-500/30 bg-purple-500/[0.02]'
                              : 'border-slate-200 bg-slate-50/50 hover:border-purple-500/50 hover:bg-purple-500/[0.02]'
                          }`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Spinner />
                  <p className="text-slate-500 text-sm font-medium">Parsing resume…</p>
                </div>
              ) : uploadDone ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <svg className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-purple-600 font-bold text-sm">{fileName}</p>
                  <p className="text-slate-400 text-xs">Click to replace file</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-white shadow-sm border border-black/5 flex items-center justify-center">
                    <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-black font-bold">
                      {isDragActive ? 'Drop your PDF here' : 'Drag & drop your resume'}
                    </p>
                    <p className="text-slate-400 text-sm mt-1 font-medium">or click to browse · PDF only · max 5 MB</p>
                  </div>
                </div>
              )}
            </div>

            {/* Parsed preview */}
            {rd && (
              <div className="mt-6 p-5 bg-slate-50 rounded-2xl border border-black/[0.03] animate-fade-up">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-10 w-10 rounded-full bg-black flex items-center justify-center
                                  text-white font-bold text-xs flex-shrink-0 shadow-sm">
                    {rd.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="text-black font-bold text-sm">{rd.name}</p>
                    <p className="text-slate-500 text-xs font-medium">{rd.email} · {rd.total_experience_years}y experience</p>
                  </div>
                </div>
                {rd.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {rd.skills.slice(0, 8).map(s => (
                      <span key={s} className="bg-white border border-black/[0.05] text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Step 2: Configure ── */}
          <div className="pt-4 border-t border-black/[0.05]">
            <span className="step-label mb-4">Step 2: Configure Interview</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Type</label>
                <select 
                  value={type} 
                  onChange={e => setType(e.target.value)}
                  className="w-full bg-slate-50 border border-black/[0.05] rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-purple-500 transition-all outline-none"
                >
                  {INTERVIEW_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Difficulty</label>
                <select 
                  value={difficulty} 
                  onChange={e => setDifficulty(e.target.value)}
                  className="w-full bg-slate-50 border border-black/[0.05] rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-purple-500 transition-all outline-none"
                >
                  {DIFFICULTIES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Language</label>
                <select 
                  value={language} 
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-slate-50 border border-black/[0.05] rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-purple-500 transition-all outline-none"
                >
                  {LANGUAGES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── CTA ── */}
          <button
            onClick={handleStart}
            disabled={!uploadDone || starting}
            className="btn-primary-solid w-full flex items-center justify-center gap-3 text-sm py-4"
          >
            {starting ? (
              <>
                <Spinner size="sm" />
                <span>{loadingText}</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                <span>Start Your Interview</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-slate-400 text-[10px] font-medium uppercase tracking-[0.2em] mt-8">
          Secure · Encrypted · AI-Powered
        </p>
      </div>
    </div>
  );
}
