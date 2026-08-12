import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { useInterview } from '../context/InterviewContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createSession, parseResume, generateQuestions, startInterview } from '../utils/api.js';

const INTERVIEW_TYPES = ['Technical', 'Behavioral', 'HR', 'Mixed'];
const DIFFICULTIES    = ['Junior', 'Mid Level', 'Senior'];
const LANGUAGES       = ['English', 'Hindi', 'Hinglish'];

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 'md' }) {
  const sz = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  return (
    <svg className={`${sz} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── SetupPage ────────────────────────────────────────────────────────────────
export default function SetupPage() {
  const navigate = useNavigate();
  const ctx = useInterview();
  const { addToast, ToastContainer } = useToast();
  const { user } = useAuth();

  const [uploading,  setUploading]  = useState(false);
  const [starting,   setStarting]   = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [fileName,   setFileName]   = useState('');
  const [loadingText, setLoadingText] = useState('');

  const [type,           setType]           = useState('Technical');
  const [difficulty,     setDifficulty]     = useState('Mid Level');
  const [language,       setLanguage]       = useState('English');
  const [jobDescription, setJobDescription] = useState('');
  const [companyId,      setCompanyId]      = useState('general');
  const [noAvatar,       setNoAvatar]       = useState(false);

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
      let sid = ctx.sessionId;
      if (!sid) {
        const { data } = await createSession(user ? { user_id: user.id } : {});
        sid = data.session_id;
        ctx.setSessionId(sid);
      }

      const { data } = await parseResume(file, sid);
      ctx.setResumeData(data.resume_data);
      setUploadDone(true);
    } catch (e) {
      const detail = e?.response?.data?.detail ?? 'Resume upload failed. Please try again.';
      addToast(detail, 'error');
      setUploadDone(false);
      if (e?.response?.status === 404) {
        ctx.setSessionId(null);
      }
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
      // Fix 'Mid Level' back to 'Mid' if needed for backend compatibility
      const diffStr = difficulty === 'Mid Level' ? 'Mid' : difficulty;
      ctx.setInterviewConfig({ type, difficulty: diffStr, language, noAvatar });
      const qRes = await generateQuestions({
        session_id:     ctx.sessionId,
        interview_type: type,
        difficulty: diffStr,
        language,
        company_id: companyId,
        ...(jobDescription.trim() ? { job_description: jobDescription.trim() } : {}),
      });
      if (noAvatar) {
        ctx.setQuestions(["Please introduce yourself and share a brief overview of your background."]);
      } else {
        ctx.setQuestions(qRes.data.questions);
      }

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
      const detail = e?.response?.data?.detail ?? 'Could not start the interview. Please try again.';
      addToast(detail, 'error', 6000);
      setStarting(false);
      if (e?.response?.status === 404) {
        ctx.setSessionId(null);
        setUploadDone(false);
      }
    }
  };

  const rd = ctx.resumeData;

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#F8F9FC] font-sans">
      <ToastContainer />

      <button
        onClick={() => navigate('/dashboard')}
        className="fixed top-4 right-4 z-50 text-xs font-bold py-2 px-4 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-1.5"
      >
        🏠 Dashboard
      </button>
      
      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] max-w-[550px] flex-col justify-between bg-gradient-to-br from-[#401C94] via-[#2E1566] to-[#1e0750] px-8 py-6 xl:px-12 xl:py-8 text-white relative overflow-hidden">
        
        {/* Decorative background elements */}
        <div className="absolute top-[15%] right-[15%] w-1 h-1 bg-white rounded-full blur-[0.5px] shadow-[0_0_15px_rgba(255,255,255,1)]"></div>
        <div className="absolute top-[35%] right-[8%] w-1.5 h-1.5 bg-white/80 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
        <div className="absolute top-[80%] left-[8%] w-1 h-1 bg-white/60 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.8)]"></div>
        <div className="absolute bottom-[8%] right-[40%] w-1 h-1 bg-white/50 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>

        {/* Concentric Rings & Sparkle Hub */}
        <div className="absolute bottom-[18%] right-[8%] w-12 h-12 bg-white/5 backdrop-blur-sm rounded-full flex items-center justify-center z-0">
          <svg className="w-6 h-6 text-white opacity-90" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" />
          </svg>
        </div>
        <svg className="absolute bottom-[-10%] right-[-15%] w-[550px] h-[550px] opacity-[0.06] pointer-events-none" viewBox="0 0 500 500" fill="none">
           <circle cx="350" cy="350" r="100" stroke="white" strokeWidth="1" />
           <circle cx="350" cy="350" r="170" stroke="white" strokeWidth="1" />
           <circle cx="350" cy="350" r="240" stroke="white" strokeWidth="1" />
           <circle cx="350" cy="350" r="310" stroke="white" strokeWidth="1" />
        </svg>

        <div className="relative z-10 h-full flex flex-col justify-between min-h-0 py-2 xl:py-4">
          <div className="shrink-0">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-5 xl:mb-6">
              <div className="h-10 w-10 bg-white rounded-[12px] flex items-center justify-center text-[#2E1566] shadow-sm shrink-0">
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <span className="font-bold text-[22px] tracking-tight">MockMate AI</span>
            </div>

            {/* Tag */}
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-4 xl:mb-5 border border-white/10 w-fit shrink-0">
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" />
              </svg>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-white/90">Intelligent Prep</span>
            </div>

            {/* Heading */}
            <h1 className="text-[36px] xl:text-[42px] 2xl:text-[46px] font-extrabold tracking-tight leading-[1.05] mb-4 shrink-0">
              Master Your<br/>Dream Role<br/>with AI-Powered<br/>Mock Interviews
            </h1>

            <p className="text-white/80 text-[13px] xl:text-[15px] leading-relaxed max-w-[340px] mb-6 font-medium shrink-0">
              Upload your resume and get real-time, tailored feedback from our advanced AI interviewer.
            </p>

            {/* Icon Features */}
            <div className="flex gap-6 xl:gap-8 text-[10px] xl:text-[11px] font-medium text-white/90 shrink-0">
              <div className="flex flex-col gap-2">
                <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                </div>
                <p>Secure<br/>& Private</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                </div>
                <p>Encrypted<br/>Data</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                     <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" />
                  </svg>
                </div>
                <p>AI-Powered<br/>Feedback</p>
              </div>
            </div>
          </div>

          {/* Bottom Cards Container */}
          <div className="flex flex-col gap-3 xl:gap-4 relative mt-4 w-full max-w-[380px] shrink-0">
            {/* Card 1: Interview Readiness */}
            <div className="bg-[#462885]/40 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-xl relative overflow-hidden flex flex-col justify-center">
              <p className="text-white/80 text-[11px] font-semibold mb-2">Interview Readiness</p>
              <div className="flex justify-between items-end">
                <div className="w-[45%]">
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-[32px] font-extrabold leading-none tracking-tight">92%</span>
                    <span className="text-[#34D399] text-[10px] font-bold mb-1 flex items-center">▲ 12%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-[5px] bg-white/20 rounded-full overflow-hidden">
                    <div className="w-[92%] h-full bg-gradient-to-r from-purple-400 to-white rounded-full"></div>
                  </div>
                </div>
                {/* Line Chart */}
                <div className="w-[100px] h-10 relative">
                  <svg className="absolute bottom-0 right-0 w-full h-full opacity-80" viewBox="0 0 100 30" fill="none" preserveAspectRatio="none">
                    <path d="M0 25 C 15 25, 20 15, 30 20 C 40 25, 45 10, 55 15 C 65 20, 75 10, 85 5 C 90 2, 95 2, 100 2" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="100" cy="2" r="3.5" fill="white"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 2: AI Bot Message */}
            <div className="bg-[#462885]/40 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-xl ml-8 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-inner">
                {/* Robot Icon */}
                <svg className="w-5 h-5 text-[#2E1566]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7v3a2 2 0 01-2 2h-1v1a2 2 0 01-2 2H9a2 2 0 01-2-2v-1H6a2 2 0 01-2-2v-3a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM9 11a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4z"/></svg>
              </div>
              <p className="text-white/90 text-[11px] font-medium leading-relaxed pr-2">
                Hi! I'll analyze your resume and create a personalized interview just for you.
              </p>
            </div>

            {/* Card 3: Success Message */}
            <div className="bg-[#462885]/40 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-xl ml-12 w-[85%] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#34D399] flex items-center justify-center shrink-0 shadow-lg shadow-[#34D399]/30">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
              </div>
              <div>
                <p className="text-white text-[11px] font-bold">Resume analyzed successfully</p>
                <p className="text-white/70 text-[10px] font-medium mt-0.5">Skills, experience & role mapped</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT CONTENT ────────────────────────────────────────────────── */}
      <div className="flex-1 h-screen overflow-y-auto bg-white flex flex-col relative">
        <div className="w-full max-w-[850px] p-6 lg:p-12 m-auto">
          
          {/* ── COMPANY SELECTOR ─────────────────────────────────────── */}
          <div className="mb-8 animate-fade-up">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-[#5235A2]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              <h2 className="text-[13px] font-extrabold text-[#1A1A1A] uppercase tracking-wider">Select Company <span className="text-[#9CA3AF] font-semibold normal-case tracking-normal ml-1">(optional)</span></h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {[
                { id: 'general',   name: 'General',   desc: 'Balanced interview',       icon: '🎯', color: 'from-slate-400 to-slate-500' },
                { id: 'google',    name: 'Google',    desc: 'Algo & system design',     icon: '🔍', color: 'from-blue-400 to-green-400' },
                { id: 'amazon',    name: 'Amazon',    desc: 'Leadership Principles',    icon: '📦', color: 'from-orange-400 to-amber-400' },
                { id: 'microsoft', name: 'Microsoft', desc: 'Growth mindset',           icon: '🪟', color: 'from-sky-400 to-blue-500' },
                { id: 'flipkart', name: 'Flipkart',  desc: 'Product & e-commerce',     icon: '🛒', color: 'from-yellow-400 to-orange-400' },
                { id: 'startup',   name: 'Startup',   desc: 'Ownership & speed',        icon: '🚀', color: 'from-purple-400 to-pink-400' },
              ].map(c => (
                <button
                  key={c.id}
                  onClick={() => setCompanyId(c.id)}
                  className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border-[2px] text-center transition-all duration-200 group hover:-translate-y-0.5 ${
                    companyId === c.id
                      ? 'border-[#5235A2] bg-[#FAF8FF] shadow-[0_0_0_3px_rgba(82,53,162,0.12)]'
                      : 'border-[#E5E7EB] bg-white hover:border-[#D1C4F9] hover:bg-slate-50'
                  }`}
                >
                  {companyId === c.id && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#5235A2] rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    </span>
                  )}
                  <span className="text-2xl leading-none">{c.icon}</span>
                  <span className={`text-[11px] font-extrabold tracking-tight ${companyId === c.id ? 'text-[#5235A2]' : 'text-[#1A1A1A]'}`}>{c.name}</span>
                  <span className="text-[9px] text-slate-400 font-medium leading-tight">{c.desc}</span>
                </button>
              ))}
            </div>
            {companyId !== 'general' && (
              <p className="mt-2.5 text-[11px] font-semibold text-[#5235A2] flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                {companyId.charAt(0).toUpperCase() + companyId.slice(1)}-style interview activated — questions will follow that company's specific patterns
              </p>
            )}
          </div>

          {/* Stepper Header */}
          <div className="flex items-center mb-8 gap-4 px-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[#5235A2] text-white flex items-center justify-center font-bold shadow-md shrink-0 text-sm">1</div>
              <h2 className="text-[15px] font-extrabold text-[#1A1A1A] whitespace-nowrap">Your Professional Profile</h2>
            </div>
            
            <div className="hidden md:block h-[1px] bg-[#E5E7EB] flex-1 min-w-[20px] mx-2"></div>
            
            <div className={`flex items-center gap-3 transition-all duration-300 ${uploadDone ? 'opacity-100' : 'opacity-30'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold shrink-0 text-sm ${uploadDone ? 'bg-[#5235A2] text-white shadow-md' : 'border-[1.5px] border-[#E5E7EB] text-[#B0B4C3] bg-white'}`}>2</div>
              <h2 className={`text-[15px] font-extrabold whitespace-nowrap ${uploadDone ? 'text-[#1A1A1A]' : 'text-[#B0B4C3]'}`}>Tailor Your Session</h2>
            </div>
          </div>

          {/* Step 1: Dropzone or Parsed Resume */}
          <div className="mb-6 animate-fade-up">
            {!uploadDone ? (
              <div
                {...getRootProps()}
                className={`relative border-[1.5px] border-dashed rounded-[32px] p-6 lg:p-10 text-center cursor-pointer
                            transition-all duration-300 flex flex-col md:flex-row items-center justify-center gap-8
                            ${isDragActive
                              ? 'border-[#5235A2] bg-[#5235A2]/5'
                              : 'border-[#D9C9F9] bg-[#FAF8FF] hover:bg-[#F3EFFF] hover:border-[#C4ADF4]'
                            }`}
              >
                <input {...getInputProps()} />
                
                {uploading ? (
                  <div className="flex flex-col items-center gap-4 py-8 w-full">
                    <Spinner size="md" />
                    <p className="text-[#5235A2] font-semibold">Parsing and analyzing resume…</p>
                  </div>
                ) : (
                  <>
                    {/* Left Upload Text */}
                    <div className="flex flex-col items-center text-center">
                      <div className="h-14 w-14 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-full flex items-center justify-center mb-4 text-[#5235A2]">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <h3 className="text-[#1A1A1A] font-extrabold text-lg mb-1">Drop your resume here</h3>
                      <p className="text-[#5235A2] font-bold text-[14px] mb-2">or click to browse</p>
                      <p className="text-[#9CA3AF] text-[12px] font-semibold">Support for PDF, DOCX (Max 5MB)</p>
                    </div>

                    {/* Right Preview Graphic */}
                    <div className="hidden md:block bg-white rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#F3F4F6] p-5 w-[260px]">
                      <div className="flex items-start justify-between mb-4">
                         <div className="flex gap-3 items-center">
                            <div className="h-10 w-10 rounded-2xl bg-[#F5F1FF] text-[#5235A2] flex items-center justify-center">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            </div>
                            <div className="text-left">
                               <p className="text-[12px] font-extrabold text-[#1A1A1A] mb-0.5">Your Resume.pdf</p>
                               <p className="text-[10px] text-[#9CA3AF] font-semibold">2.4 MB</p>
                            </div>
                         </div>
                         <span className="bg-[#5235A2] text-white text-[8px] font-bold px-2 py-1 rounded-[6px] tracking-wide uppercase">PDF</span>
                      </div>
                      <div className="space-y-2 mb-4">
                         <div className="h-2 bg-[#F3F4F6] rounded-full w-full"></div>
                         <div className="h-2 bg-[#F3F4F6] rounded-full w-5/6"></div>
                         <div className="h-2 bg-[#F3F4F6] rounded-full w-4/6"></div>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] font-bold text-[#5235A2] bg-[#FAF8FF] py-2 rounded-xl justify-center">
                         <svg className="w-4 h-4 text-[#5235A2]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                         Ready to analyze
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              // Parsed Resume Profile (Shown when upload is done)
              <div className="p-6 bg-slate-50/80 rounded-3xl border border-slate-200 animate-fade-up relative">
                <button onClick={() => setUploadDone(false)} className="absolute top-6 right-6 text-xs font-bold text-[#5235A2] bg-white border border-slate-200 shadow-sm px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                  Replace File
                </button>
                <div className="flex items-center gap-5">
                  <div className="h-14 w-14 rounded-full bg-[#5235A2] text-white flex items-center justify-center font-bold text-xl shadow-md flex-shrink-0">
                    {rd?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg text-slate-800 leading-tight">{rd?.name}</p>
                    <p className="text-sm text-slate-500 mt-1 font-medium">{rd?.email} · {rd?.total_experience_years}y exp</p>
                  </div>
                </div>
                {rd?.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-200/60">
                    {rd.skills.slice(0, 15).map(skill => (
                      <span key={skill} className="bg-white border border-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
                        {skill}
                      </span>
                    ))}
                    {rd.skills.length > 15 && (
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                        +{rd.skills.length - 15} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Form */}
          <div className={`transition-all duration-500 ${uploadDone ? 'opacity-100 translate-y-0' : 'opacity-40 pointer-events-none translate-y-2'}`}>
            
            <div className={`hidden md:flex items-center gap-4 mb-1 transition-all duration-300 ${uploadDone ? 'opacity-100' : 'opacity-60'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm shrink-0 ${uploadDone ? 'bg-[#5235A2] text-white' : 'bg-[#B0B4C3] text-white'}`}>2</div>
              <h2 className={`text-xl font-extrabold ${uploadDone ? 'text-[#1A1A1A]' : 'text-[#9CA3AF]'}`}>Tailor Your Session</h2>
            </div>
            <p className={`text-[14px] font-semibold mb-5 md:ml-12 transition-all duration-300 ${uploadDone ? 'text-[#9CA3AF]' : 'text-[#B0B4C3]'}`}>
              Help us customize the interview to match your goals.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {/* Type */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  Target Industry/Role
                </label>
                <div className="relative">
                  <select 
                    value={type} 
                    onChange={e => setType(e.target.value)}
                    className="w-full bg-white border border-[#E5E7EB] rounded-xl px-4 py-3.5 text-[15px] font-semibold text-[#1A1A1A] focus:ring-2 focus:ring-[#5235A2] outline-none appearance-none cursor-pointer shadow-sm hover:border-[#D1D5DB] transition-colors"
                  >
                    {INTERVIEW_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#9CA3AF]">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                  Experience Level
                </label>
                <div className="relative">
                  <select 
                    value={difficulty} 
                    onChange={e => setDifficulty(e.target.value)}
                    className="w-full bg-white border border-[#E5E7EB] rounded-xl px-4 py-3.5 text-[15px] font-semibold text-[#1A1A1A] focus:ring-2 focus:ring-[#5235A2] outline-none appearance-none cursor-pointer shadow-sm hover:border-[#D1D5DB] transition-colors"
                  >
                    {DIFFICULTIES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#9CA3AF]">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Interview Language
                </label>
                <div className="relative">
                  <select 
                    value={language} 
                    onChange={e => setLanguage(e.target.value)}
                    className="w-full bg-white border border-[#E5E7EB] rounded-xl px-4 py-3.5 text-[15px] font-semibold text-[#1A1A1A] focus:ring-2 focus:ring-[#5235A2] outline-none appearance-none cursor-pointer shadow-sm hover:border-[#D1D5DB] transition-colors"
                  >
                    {LANGUAGES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#9CA3AF]">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* JD Input */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  Paste Job Description
                  <span className="ml-1 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">optional but recommended</span>
                </label>
                <span className={`text-[10px] font-semibold ${jobDescription.length > 4500 ? 'text-red-500' : 'text-slate-400'}`}>
                  {jobDescription.length} / 5000
                </span>
              </div>
              <textarea
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value.slice(0, 5000))}
                rows={6}
                placeholder="Paste the full job description here..."
                className="w-full bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 text-[13px] font-medium text-[#1A1A1A] focus:ring-2 focus:ring-[#5235A2] outline-none resize-none shadow-sm hover:border-[#D1D5DB] transition-colors placeholder:text-slate-300"
              />
              {jobDescription.trim() ? (
                <p className="mt-1.5 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                  JD detected — questions will be 3× more targeted to this role
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-400 font-medium">
                  💡 Adding a JD makes questions 3× more targeted to the specific role
                </p>
              )}
            </div>

            {/* AI Avatar Toggle */}
            <div className="mb-6 bg-slate-50 border border-[#E5E7EB] rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white rounded-xl shadow-sm text-[#5235A2] flex items-center justify-center border border-black/[0.03] shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[#1A1A1A]">Focus Mode (No AI Avatar)</p>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                    Disable the video feed of the AI avatar. Perfect for focus sessions using voice/audio-only.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNoAvatar(prev => !prev)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  noAvatar ? 'bg-[#5235A2]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    noAvatar ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Info Box */}
            <div className="bg-purple-50 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 mb-6 border border-purple-100">
              <div className="h-10 w-10 bg-white rounded-xl shadow-sm text-[#5235A2] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800 mb-2">AI will personalize your session with:</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600 font-semibold">
                  <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[#5235A2]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>Role-specific questions</span>
                  <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[#5235A2]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>Skill-based challenges</span>
                  <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[#5235A2]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>Real-world scenarios</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={!uploadDone || starting}
              className={`w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-bold text-lg text-white transition-all duration-300 shadow-lg ${
                (!uploadDone || starting) 
                  ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                  : 'bg-[#5235A2] hover:bg-[#432A85] shadow-[#5235A2]/30 hover:-translate-y-0.5'
              }`}
            >
              {starting ? (
                <>
                  <Spinner size="md" />
                  <span>{loadingText}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
                  <span>Begin Interview Session &rarr;</span>
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center gap-1.5 font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg> 
              Your data is secure and deleted after your session
            </p>
          </div>
        </div>
        
        {/* Footer / Trust Badges */}
        <div className="w-full max-w-4xl mx-auto mt-4 mb-8 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 font-medium px-4 gap-4">
           <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-[#F8F9FC] overflow-hidden"><img src="https://i.pravatar.cc/100?img=1" alt=""/></div>
                <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-[#F8F9FC] overflow-hidden"><img src="https://i.pravatar.cc/100?img=2" alt=""/></div>
                <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-[#F8F9FC] overflow-hidden"><img src="https://i.pravatar.cc/100?img=3" alt=""/></div>
                <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-[#F8F9FC] overflow-hidden"><img src="https://i.pravatar.cc/100?img=4" alt=""/></div>
              </div>
              <span>Trusted by 10,000+ learners</span>
              <div className="flex text-amber-400 gap-0.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              </div>
              <span className="ml-1">4.9/5</span>
           </div>
           <div className="flex items-center gap-4">
              <span>Used for placements at:</span>
              <span className="font-bold text-slate-700 text-sm tracking-tight">Google</span>
              <span className="font-bold text-slate-700 tracking-tight">amazon</span>
              <span className="font-bold text-slate-700 tracking-tight">Microsoft</span>
              <span className="font-bold text-slate-700 tracking-tight">ZOHO</span>
           </div>
        </div>
      </div>
    </div>
  );
}
