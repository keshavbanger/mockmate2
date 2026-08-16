import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useInterview } from '../context/InterviewContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createSession, parseResume, generateQuestions, startInterview } from '../utils/api.js';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import LoginModal from '../components/LoginModal.jsx';
import ResumeSourcePicker from '../components/shared/ResumeSourcePicker.jsx';

const TABS = ['Role Based', 'Company Based', 'JD Based'];

const ROLE_CATEGORIES = ['All', 'Tech', 'Management', 'Intern', 'Engineering', 'Finance', 'Analyst', 'Healthcare'];
const COMPANY_CATEGORIES = ['All', 'FAANG', 'MNC', 'E-Commerce', 'Startup', 'Finance', 'Consulting'];

const ROLES_DATA = [
  { id: 'fullstack_developer', title: 'Full Stack Developer', cat: 'Engineering', icon: '💻', desc: 'Frontend + Backend APIs' },
  { id: 'data_scientist', title: 'Data Scientist', cat: 'Analyst', icon: '📊', desc: 'Machine Learning & Python' },
  { id: 'product_manager', title: 'Product Manager', cat: 'Management', icon: '🚀', desc: 'Roadmap & product sense' },
  { id: 'frontend_engineer', title: 'Frontend Engineer', cat: 'Engineering', icon: '🎨', desc: 'React, UI & Web Performance' },
  { id: 'cybersecurity_analyst', title: 'Cybersecurity Analyst', cat: 'Tech', icon: '🛡️', desc: 'Threat detection & security' },
  { id: 'devops_engineer', title: 'DevOps Engineer', cat: 'Tech', icon: '⚙️', desc: 'Kubernetes, AWS & CI/CD' },
  { id: 'financial_analyst', title: 'Financial Analyst', cat: 'Finance', icon: '💰', desc: 'Modeling & valuation' },
  { id: 'hr_specialist', title: 'HR Specialist', cat: 'Management', icon: '👥', desc: 'Talent & culture fit' },
  { id: 'qa_engineer', title: 'QA Automation Engineer', cat: 'Tech', icon: '🧪', desc: 'Selenium, Cypress & testing' },
  { id: 'business_analyst', title: 'Business Analyst', cat: 'Analyst', icon: '📊', desc: 'Requirements & SQL' },
  { id: 'ux_designer', title: 'UX/UI Designer', cat: 'Tech', icon: '✏️', desc: 'Figma, research & wireframes' },
  { id: 'cloud_engineer', title: 'Cloud Architect', cat: 'Tech', icon: '☁️', desc: 'AWS, Azure & Cloud Infra' },
];

const COMPANIES_DATA = [
  { id: 'google', title: 'Google', cat: 'FAANG', icon: '🔍', desc: 'Algorithms & System Design' },
  { id: 'amazon', title: 'Amazon', cat: 'FAANG', icon: '📦', desc: '14 Leadership Principles' },
  { id: 'microsoft', title: 'Microsoft', cat: 'FAANG', icon: '🪟', desc: 'Growth Mindset & System CS' },
  { id: 'flipkart', title: 'Flipkart', cat: 'E-Commerce', icon: '🛒', desc: 'High Scale E-Commerce' },
  { id: 'accenture', title: 'Accenture', cat: 'MNC', icon: '🌐', desc: 'Consulting & Enterprise Tech' },
  { id: 'aditya_birla', title: 'Aditya Birla Group', cat: 'MNC', icon: '🏢', desc: 'Leadership & Business Strategy' },
  { id: 'adobe', title: 'Adobe', cat: 'MNC', icon: '🅰️', desc: 'Creative Tech & System Logic' },
  { id: 'stripe', title: 'Stripe', cat: 'Startup', icon: '💳', desc: 'Fintech APIs & Code Quality' },
  { id: 'netflix', title: 'Netflix', cat: 'FAANG', icon: '🎬', desc: 'Freedom & Responsibility' },
  { id: 'meta', title: 'Meta', cat: 'FAANG', icon: '♾️', desc: 'Fast Execution & Scale' },
  { id: 'apple', title: 'Apple', cat: 'FAANG', icon: '🍎', desc: 'Pixel Perfection & Craft' },
  { id: 'goldman_sachs', title: 'Goldman Sachs', cat: 'Finance', icon: '🏦', desc: 'Financial Tech & Logic' },
];

const INTERVIEW_TYPES = ['Technical', 'Behavioral', 'HR', 'Mixed'];
const DIFFICULTIES = ['Junior', 'Mid Level', 'Senior'];
const LANGUAGES = ['English', 'Hindi', 'Hinglish'];

const ROUNDS = [
  { id: 'warmup',    label: 'Warm Up',      sub: 'NON TECHNICAL' },
  { id: 'role',      label: 'Role Related',  sub: 'TECHNICAL'     },
  { id: 'behavioral',label: 'Behavioral',    sub: 'HR'            },
];

const DURATIONS = [
  { value: 5,  label: '5 mins',  premium: false },
  { value: 15, label: '15 mins', premium: true  },
  { value: 30, label: '30 mins', premium: true  },
];

const INTERVIEWERS = [
  { id: 'payal', name: 'Payal', lang: 'IN English', avatar: 'https://i.pravatar.cc/100?img=47' },
  { id: 'emma',  name: 'Emma',  lang: 'US English', avatar: 'https://i.pravatar.cc/100?img=5'  },
  { id: 'john',  name: 'John',  lang: 'US English', avatar: 'https://i.pravatar.cc/100?img=12' },
  { id: 'kapil', name: 'Kapil', lang: 'IN English', avatar: 'https://i.pravatar.cc/100?img=68' },
];

function Spinner({ size = 'md' }) {
  const sz = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  return (
    <svg className={`${sz} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function SetupPage() {
  const navigate = useNavigate();
  const ctx = useInterview();
  const { addToast, ToastContainer } = useToast();
  const { user, isAuthenticated } = useAuth();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Role Based');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected selection
  const [selectedRole, setSelectedRole] = useState(ROLES_DATA[0]);
  const [selectedCompany, setSelectedCompany] = useState(COMPANIES_DATA[0]);

  // Config state
  const [type, setType] = useState('Technical');
  const [difficulty, setDifficulty] = useState('Mid Level');
  const [language, setLanguage] = useState('English');
  const [jobDescription, setJobDescription] = useState('');
  const [noAvatar, setNoAvatar] = useState(false);

  // Step 3 state
  const [selectedRound,      setSelectedRound]      = useState('warmup');
  const [selectedDuration,   setSelectedDuration]   = useState(5);
  const [selectedInterviewer,setSelectedInterviewer] = useState('kapil');
  const [enableAudio,        setEnableAudio]        = useState(true);
  const [enableVideo,        setEnableVideo]        = useState(true);
  const [termsAgreed,        setTermsAgreed]        = useState(false);
  const [selectionDone,      setSelectionDone]      = useState(false);

  // Resume upload state (initialized if context already has resume data)
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(() => Boolean(ctx.resumeData));
  const [fileName, setFileName] = useState('');
  // Either { mode: 'upload', file, saveAsResume, label } or
  // { mode: 'saved', savedResumeId } — see ResumeSourcePicker.
  const [resumeSource, setResumeSource] = useState(null);

  // Starting loading state
  const [starting, setStarting] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  // Filtered Roles
  const filteredRoles = useMemo(() => {
    return ROLES_DATA.filter(r => {
      const matchCat = selectedCategory === 'All' || r.cat === selectedCategory;
      const matchQuery = !searchQuery.trim() || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [selectedCategory, searchQuery]);

  // Filtered Companies
  const filteredCompanies = useMemo(() => {
    return COMPANIES_DATA.filter(c => {
      const matchCat = selectedCategory === 'All' || c.cat === selectedCategory;
      const matchQuery = !searchQuery.trim() || c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [selectedCategory, searchQuery]);

  // Fires whenever ResumeSourcePicker reports a usable source (a freshly
  // chosen file, or a saved resume selection) — replaces the old dropzone's
  // onDrop, parsing eagerly either way so the "Resume Parsed & Linked"
  // summary below populates immediately.
  const handleResumeSource = useCallback(async (source) => {
    setUploading(true);
    setFileName(source.mode === 'upload' ? source.file.name : 'Saved resume');

    try {
      let sid = ctx.sessionId;
      if (!sid) {
        const { data } = await createSession(user ? { user_id: user.id } : {});
        sid = data.session_id;
        ctx.setSessionId(sid);
      }

      const { data } = await parseResume(source, sid);
      ctx.setResumeData(data.resume_data);
      setUploadDone(true);
      addToast('Resume uploaded and parsed successfully!', 'success');
    } catch (e) {
      const detail = e?.response?.data?.detail ?? 'Resume upload failed. Please try again.';
      addToast(detail, 'error');
      setUploadDone(false);
    } finally {
      setUploading(false);
    }
  }, [ctx, user, addToast]);

  useEffect(() => {
    if (!resumeSource) return;
    if (resumeSource.mode === 'upload' && !resumeSource.file) return;
    if (resumeSource.mode === 'saved' && !resumeSource.savedResumeId) return;
    handleResumeSource(resumeSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSource]);

  // Mark selection done to reveal Step 3
  const handleContinueToStep3 = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (activeTab === 'JD Based' && !jobDescription.trim()) {
      addToast('Please paste a Job Description first.', 'warning');
      return;
    }
    if (!uploadDone && !ctx.resumeData) {
      addToast('Please upload your resume first.', 'warning');
      return;
    }
    setSelectionDone(true);
    setTimeout(() => {
      document.getElementById('step3-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Start Interview Logic
  const handleStart = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (!uploadDone && !ctx.resumeData) {
      addToast('Please upload your resume first to personalize the AI interview session.', 'warning');
      return;
    }
    if (!termsAgreed) {
      addToast('Please agree to the terms and conditions to proceed.', 'warning');
      return;
    }

    setStarting(true);
    try {
      let sid = ctx.sessionId;
      if (!sid) {
        setLoadingText('Initializing session…');
        const { data } = await createSession(user ? { user_id: user.id } : {});
        sid = data.session_id;
        ctx.setSessionId(sid);
      }

      setLoadingText('Generating AI interview questions…');
      const diffStr = difficulty === 'Mid Level' ? 'Mid' : difficulty;
      ctx.setInterviewConfig({ type, difficulty: diffStr, language, noAvatar });

      let compId = 'general';
      if (activeTab === 'Company Based' && selectedCompany) {
        compId = selectedCompany.id;
      }

      const payload = {
        session_id: sid,
        interview_type: type,
        difficulty: diffStr,
        language,
        company_id: compId,
        ...(jobDescription.trim() ? { job_description: jobDescription.trim() } : {}),
        round: selectedRound,
        duration_minutes: selectedDuration,
        interviewer: selectedInterviewer,
      };

      const qRes = await generateQuestions(payload);
      if (noAvatar) {
        ctx.setQuestions(["Please introduce yourself and share a brief overview of your background."]);
      } else {
        ctx.setQuestions(qRes.data.questions);
      }

      setLoadingText('Setting up AI Avatar Room…');
      const iRes = await startInterview(sid);
      ctx.setConversation({
        conversationUrl: iRes.data.conversation_url,
        conversationId: iRes.data.conversation_id,
      });
      ctx.setStartTime(Date.now());
      ctx.setStatus('active');

      navigate('/interview');
    } catch (e) {
      const detail = e?.response?.data?.detail ?? 'Could not start interview. Please try again.';
      addToast(detail, 'error', 6000);
      setStarting(false);
    }
  };

  const rd = ctx.resumeData;

  return (
    <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif] text-slate-900 overflow-x-hidden">
      <ToastContainer />

      <Navbar />

      {/* ── Background Blobs ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -left-60 w-[400px] h-[400px] bg-indigo-200/15 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-16">
      <div>

        {/* ── TAB BAR ──────────────────────────────────────────────── */}
        <div className="bg-white/90 backdrop-blur-xl shadow-lg shadow-purple-900/5 border border-purple-100 rounded-full p-1.5 flex items-center justify-center gap-2 max-w-lg mx-auto mb-8">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedCategory('All'); setSelectionDone(false); }}
                className={`flex-1 py-2.5 rounded-full text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer text-center ${
                  isActive
                    ? 'bg-[#6B46C1] text-white shadow-md shadow-purple-900/20'
                    : 'text-slate-600 hover:text-black hover:bg-purple-50/60'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* ── HERO SECTION ─────────────────────────────────────────── */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 bg-purple-100/70 text-[#6B46C1] px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest mb-6 border border-purple-200 shadow-sm">
            <span className="text-amber-500">⚡</span>
            {activeTab === 'Role Based' && '3000+ ROLES AVAILABLE'}
            {activeTab === 'Company Based' && '1000+ COMPANIES AVAILABLE'}
            {activeTab === 'JD Based' && 'JOB DESCRIPTION TAILORED'}
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#111] leading-[1.15] mb-4">
            {activeTab === 'Role Based' && (
              <>Role-Specific<br /><span className="bg-gradient-to-r from-[#6B46C1] via-[#8B5CF6] to-[#A855F7] bg-clip-text text-transparent">AI Mock Interviews</span></>
            )}
            {activeTab === 'Company Based' && (
              <>Company-Specific<br /><span className="bg-gradient-to-r from-[#6B46C1] via-[#8B5CF6] to-[#A855F7] bg-clip-text text-transparent">AI Mock Interviews</span></>
            )}
            {activeTab === 'JD Based' && (
              <>JD-Tailored<br /><span className="bg-gradient-to-r from-[#6B46C1] via-[#8B5CF6] to-[#A855F7] bg-clip-text text-transparent">AI Mock Interviews</span></>
            )}
          </h1>

          <p className="text-slate-500 text-base leading-relaxed max-w-xl mx-auto mb-8 font-medium">
            {activeTab === 'Role Based' && 'Practice role-specific interviews with real-world questions. Improve domain knowledge, articulation and communication with instant feedback report.'}
            {activeTab === 'Company Based' && 'Train with real interview questions asked at top tech giants and MNCs. Upload your resume for realistic company-specific interview prep.'}
            {activeTab === 'JD Based' && 'Paste any target Job Description and upload your resume. AI will extract required skills, probe experience gaps, and generate 3× targeted questions.'}
          </p>

        </div>

        {/* ── STEP 1: RESUME UPLOAD ─────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-xl w-full mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[#6B46C1] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                1
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Your Professional Resume</h2>
            </div>
            {uploadDone && (
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                ✓ Resume Parsed & Linked
              </span>
            )}
          </div>

          {!uploadDone ? (
            uploading ? (
              <div className="border-2 border-dashed border-purple-200 bg-purple-50/30 rounded-2xl p-6 flex flex-col items-center gap-3 py-4">
                <Spinner />
                <p className="text-xs font-bold text-[#6B46C1]">Parsing and analyzing resume…</p>
              </div>
            ) : (
              <ResumeSourcePicker onChange={setResumeSource} />
            )
          ) : (
            <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-[#6B46C1] text-white font-bold flex items-center justify-center text-lg shadow-md shrink-0">
                  {rd?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">{rd?.name ?? 'Candidate Profile'}</h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {rd?.email} · {rd?.total_experience_years ?? 0}y experience
                  </p>
                  {rd?.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rd.skills.slice(0, 8).map(skill => (
                        <span key={skill} className="bg-white border border-purple-200 text-purple-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                          {skill}
                        </span>
                      ))}
                      {rd.skills.length > 8 && (
                        <span className="text-[9px] text-slate-400 font-bold px-1 py-0.5">
                          +{rd.skills.length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setUploadDone(false)}
                className="text-xs font-bold text-[#6B46C1] bg-white border border-purple-200 px-3.5 py-2 rounded-xl hover:bg-purple-50 transition-colors shrink-0"
              >
                Replace Resume
              </button>
            </div>
          )}
        </div>

        {/* ── STEP 2: MODE SPECIFIC SELECTION & CONFIGURATION ────────────────── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-xl w-full mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-full bg-[#6B46C1] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
              2
            </div>
            <h2 className="text-base font-extrabold text-slate-900">
              {activeTab === 'Role Based' && 'Select Target Role & Settings'}
              {activeTab === 'Company Based' && 'Select Target Company & Settings'}
              {activeTab === 'JD Based' && 'Paste Job Description & Settings'}
            </h2>
          </div>

          <AnimatePresence mode="wait">
            {/* TAB 1: ROLE BASED */}
            {activeTab === 'Role Based' && (
              <motion.div
                key="role-based"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {/* Search & Category Chips */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search from 3000+ roles (e.g. Full Stack, Data Scientist)"
                    className="w-full sm:w-80 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#6B46C1]"
                  />
                  <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                    {ROLE_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                          selectedCategory === cat
                            ? 'bg-[#6B46C1] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-purple-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Role Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 mb-6 max-h-72 overflow-y-auto pr-1">
                  {filteredRoles.map(role => {
                    const isSelected = selectedRole?.id === role.id;
                    return (
                      <button
                        key={role.id}
                        onClick={() => setSelectedRole(role)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? 'border-2 border-[#6B46C1] bg-purple-50/50 shadow-md'
                            : 'border-slate-200/80 hover:border-purple-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-2xl">{role.icon}</span>
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-900 mb-0.5">{role.title}</h4>
                          <p className="text-[10px] text-slate-500 font-medium">{role.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* TAB 2: COMPANY BASED */}
            {activeTab === 'Company Based' && (
              <motion.div
                key="company-based"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {/* Search & Category Chips */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search target company (e.g. Google, Amazon)"
                    className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#6B46C1]"
                  />
                  <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                    {COMPANY_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                          selectedCategory === cat
                            ? 'bg-[#6B46C1] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-purple-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Company Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 mb-6 max-h-72 overflow-y-auto pr-1">
                  {filteredCompanies.map(comp => {
                    const isSelected = selectedCompany?.id === comp.id;
                    return (
                      <button
                        key={comp.id}
                        onClick={() => setSelectedCompany(comp)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? 'border-2 border-[#6B46C1] bg-purple-50/50 shadow-md'
                            : 'border-slate-200/80 hover:border-purple-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-2xl">{comp.icon}</span>
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-900 mb-0.5">{comp.title}</h4>
                          <p className="text-[10px] text-slate-500 font-medium">{comp.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* TAB 3: JD BASED */}
            {activeTab === 'JD Based' && (
              <motion.div
                key="jd-based"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="mb-6"
              >
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Paste Job Description</label>
                  <span className={`text-xs font-semibold ${jobDescription.length > 4500 ? 'text-red-500' : 'text-slate-400'}`}>
                    {jobDescription.length} / 5000
                  </span>
                </div>
                <textarea
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value.slice(0, 5000))}
                  rows={5}
                  placeholder="Paste target Job Description requisition text here..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#6B46C1] resize-none"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Continue Button → reveals Step 3 */}
          <div className="mt-5 flex justify-end">
            <button onClick={handleContinueToStep3}
              className="px-8 py-3 bg-[#6B46C1] hover:bg-[#5b3da6] text-white font-extrabold text-sm rounded-2xl shadow-lg hover:shadow-purple-900/30 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-2">
              Continue <span>→</span>
            </button>
          </div>
        </div>

        {/* ── How it Works Section ── */}
        <section className="pt-24 pb-16">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
              How it <span className="text-[#6B46C1]">Works</span>
            </h2>
            <p className="text-slate-500 text-sm sm:text-base font-medium leading-relaxed">
              From picking your role to getting your report, your AI Interview is ready in under a minute.
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
                Choose your Role
              </h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-md">
                Search from 3000+ roles or browse by category. Pick the exact role you are preparing for, from software engineer to sales executive.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-purple-50 text-[#6B46C1] font-bold text-xs px-4 py-2 rounded-full border border-purple-100 shadow-sm">
                  3000+ Roles Available
                </span>
              </div>
            </motion.div>

            {/* Mock Card 1 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="order-1 lg:order-2 bg-gradient-to-br from-purple-50/60 to-white p-5 rounded-3xl border border-purple-100 shadow-xl shadow-purple-900/5"
            >
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
                <input
                  type="text"
                  readOnly
                  value="Search from 3000+ roles (e.g. Full Stack, Data Scientist)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-slate-500 outline-none"
                />
                <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] font-bold">
                  {['All', 'Tech', 'Management', 'Intern', 'Engineering', 'Finance', 'Analyst', 'Healthcare'].map((cat, idx) => (
                    <span key={cat} className={`px-2.5 py-1 rounded-full whitespace-nowrap ${idx === 0 ? 'bg-[#6B46C1] text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {cat}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 text-left">
                  {[
                    { icon: '💻', title: 'Full Stack Developer', sub: 'Frontend + Backend APIs' },
                    { icon: '📊', title: 'Data Scientist', sub: 'Machine Learning & Python' },
                    { icon: '🚀', title: 'Product Manager', sub: 'Roadmap & product sense' },
                    { icon: '🎨', title: 'Frontend Engineer', sub: 'React, UI & Web Performance' },
                    { icon: '🛡️', title: 'Cybersecurity Analyst', sub: 'Threat detection & security' },
                    { icon: '⚙️', title: 'DevOps Engineer', sub: 'Kubernetes, AWS & CI/CD' },
                    { icon: '💰', title: 'Financial Analyst', sub: 'Modeling & valuation' },
                    { icon: '👥', title: 'HR Specialist', sub: 'Talent & culture fit' },
                    { icon: '🧪', title: 'QA Automation Engineer', sub: 'Selenium, Cypress & testing' },
                    { icon: '📊', title: 'Business Analyst', sub: 'Requirements & SQL' },
                    { icon: '✏️', title: 'UX/UI Designer', sub: 'Figma, research & wireframes' },
                    { icon: '☁️', title: 'Cloud Architect', sub: 'AWS, Azure & Cloud Infra' },
                  ].map(r => (
                    <div key={r.title} className="p-2 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-purple-50/50 transition-colors">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs">{r.icon}</span>
                        <span className="text-[10px] font-bold text-slate-800 truncate">{r.title}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium truncate">{r.sub}</p>
                    </div>
                  ))}
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
              className="order-1 bg-gradient-to-br from-purple-50/60 to-white p-5 rounded-3xl border border-purple-100 shadow-xl shadow-purple-900/5"
            >
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <span className="text-sm">💻</span>
                  <span className="font-extrabold text-xs text-slate-800">Full Stack Developer</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-700 mb-1.5">Select Round *</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['Warm-up', 'Role-Specific', 'Behavioral'].map((rnd, i) => (
                      <div key={rnd} className={`p-2 rounded-xl text-center border text-[10px] font-bold ${i === 1 ? 'bg-[#6B46C1] text-white border-[#6B46C1]' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {rnd}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-700 mb-1.5">Interview Duration *</p>
                  <div className="flex gap-1.5">
                    {['15 mins', '30 mins ⭐', '45 mins'].map((dur, i) => (
                      <span key={dur} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${i === 0 ? 'bg-purple-50 text-[#6B46C1] border-purple-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {dur}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <span className="px-4 py-1.5 bg-[#6B46C1] text-white font-bold text-xs rounded-xl shadow-sm">
                    Continue →
                  </span>
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
                Set Round & Difficulty
              </h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-md">
                Choose the type of interview round, warm up, role related, behavioral, or coding, and set your difficulty level to match where you are in your prep.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-purple-50 text-[#6B46C1] font-bold text-xs px-4 py-2 rounded-full border border-purple-100 shadow-sm">
                  4 round types
                </span>
              </div>
            </motion.div>
          </div>

          {/* Step 3 */}
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
                  3
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#6B46C1]">
                  STEP 03
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Practice with AI
              </h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-md">
                Face a realistic AI Interview in a live video session. It asks real questions, listens carefully, and adapts follow-ups based on your answers.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-purple-50 text-[#6B46C1] font-bold text-xs px-4 py-2 rounded-full border border-purple-100 shadow-sm">
                  AI Video Interview
                </span>
              </div>
            </motion.div>

            {/* Mock Card 3 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="order-1 lg:order-2 bg-gradient-to-br from-purple-50/60 to-white p-5 rounded-3xl border border-purple-100 shadow-xl shadow-purple-900/5"
            >
              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden h-48 flex flex-col justify-between">
                <div className="flex items-center justify-between z-10">
                  <span className="text-[10px] font-extrabold bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE SESSION
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">Q 2 / 5</span>
                </div>
                <div className="flex items-center justify-center gap-3 my-auto z-10">
                  <div className="h-12 w-12 rounded-full bg-[#6B46C1] flex items-center justify-center text-xl shadow-lg border-2 border-purple-400">
                    🎙️
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">AI Technical Interviewer</p>
                    <p className="text-[10px] text-purple-300 font-medium">"Could you explain your approach to handling state in React?"</p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-2 z-10">
                  <span className="text-[10px] text-slate-400 font-medium">Audio & Video Active</span>
                  <span className="text-[10px] bg-purple-600 text-white font-bold px-2.5 py-0.5 rounded-full">Listening…</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Step 4 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Mock Card 4 */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="order-1 bg-gradient-to-br from-purple-50/60 to-white p-5 rounded-3xl border border-purple-100 shadow-xl shadow-purple-900/5"
            >
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-900">Performance Report</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Completed</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-purple-50 p-2 rounded-xl">
                    <p className="text-[9px] text-slate-500 font-bold">Overall</p>
                    <p className="text-sm font-black text-[#6B46C1]">8.6/10</p>
                  </div>
                  <div className="bg-purple-50 p-2 rounded-xl">
                    <p className="text-[9px] text-slate-500 font-bold">Confidence</p>
                    <p className="text-sm font-black text-[#6B46C1]">9.0/10</p>
                  </div>
                  <div className="bg-purple-50 p-2 rounded-xl">
                    <p className="text-[9px] text-slate-500 font-bold">Clarity</p>
                    <p className="text-sm font-black text-[#6B46C1]">8.4/10</p>
                  </div>
                </div>
                <div className="border border-slate-100 rounded-xl p-2.5 bg-slate-50/50 text-[10px] space-y-1">
                  <p className="font-bold text-slate-800">Key Strengths:</p>
                  <p className="text-slate-600">Great articulation of architecture trade-offs. Minimal filler words used.</p>
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
                  4
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#6B46C1]">
                  STEP 04
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Get Instant Feedback
              </h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-md">
                Receive a detailed report immediately after your session. The report evaluates your confidence, structure and relevance and provides clear tips for improvement.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-purple-50 text-[#6B46C1] font-bold text-xs px-4 py-2 rounded-full border border-purple-100 shadow-sm">
                  Instant AI report
                </span>
              </div>
            </motion.div>
          </div>
        </section>
      </div>

      </div>
      {!selectionDone && <Footer />}

      {/* ── STEP 3: INTERVIEW DETAILS (appears after Continue) ────────────── */}
      <AnimatePresence>
        {selectionDone && (
          <motion.div
            id="step3-section"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto px-4 sm:px-6 mb-32"
          >
            <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-xl">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded-full bg-[#6B46C1] text-white font-extrabold flex items-center justify-center text-sm shadow-md">3</div>
                <h2 className="text-base font-extrabold text-slate-900">Interview Details</h2>
              </div>

              {/* Context chip */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 mb-6 flex items-center gap-3">
                <span className="text-xl">{activeTab === 'Company Based' ? selectedCompany?.icon : selectedRole?.icon}</span>
                <span className="font-extrabold text-sm text-slate-800">
                  {activeTab === 'Company Based' ? selectedCompany?.title : activeTab === 'Role Based' ? selectedRole?.title : 'JD-Based Interview'}
                </span>
              </div>

              {/* SELECT ROUND */}
              <div className="mb-6">
                <p className="text-xs font-extrabold text-slate-800 mb-3">Select Round <span className="text-red-500">*</span></p>
                <div className="flex gap-3 flex-wrap">
                  {ROUNDS.map(r => (
                    <button key={r.id} onClick={() => setSelectedRound(r.id)}
                      className={`px-5 py-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        selectedRound === r.id
                          ? 'border-[#6B46C1] bg-[#6B46C1] text-white shadow-md'
                          : 'border-slate-200 bg-white hover:border-purple-300 text-slate-800'
                      }`}>
                      <p className="font-extrabold text-sm">{r.label}</p>
                      <p className={`text-[10px] font-bold tracking-wider uppercase mt-0.5 ${
                        selectedRound === r.id ? 'text-purple-200' : 'text-slate-400'}`}>{r.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* INTERVIEW DURATION */}
              <div className="mb-6">
                <p className="text-xs font-extrabold text-slate-800 mb-3">Interview Duration <span className="text-red-500">*</span></p>
                <div className="flex gap-3 flex-wrap">
                  {DURATIONS.map(d => (
                    <button key={d.value} onClick={() => setSelectedDuration(d.value)}
                      className={`px-5 py-2.5 rounded-2xl border-2 font-extrabold text-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedDuration === d.value
                          ? 'border-[#6B46C1] bg-purple-50 text-[#6B46C1]'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-purple-200'
                      }`}>
                      {d.label}
                      {d.premium && <span className="text-amber-400">⭐</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* SENIORITY / TRACK / LANGUAGE / FOCUS MODE */}
              <div className="mb-6">
                <p className="text-xs font-extrabold text-slate-800 mb-3">Interview Configuration <span className="text-red-500">*</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Seniority</label>
                    <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#6B46C1]">
                      {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Track</label>
                    <select value={type} onChange={e => setType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#6B46C1]">
                      {INTERVIEW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Language</label>
                    <select value={language} onChange={e => setLanguage(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#6B46C1]">
                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Focus Mode</p>
                      <p className="text-[10px] text-slate-500">Audio-only (No Avatar)</p>
                    </div>
                    <button type="button" onClick={() => setNoAvatar(p => !p)}
                      className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        noAvatar ? 'bg-[#6B46C1]' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        noAvatar ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* PRACTICE SETTINGS */}
              <div className="mb-6">
                <p className="text-xs font-extrabold text-slate-800 mb-3">Practice Settings <span className="text-red-500">*</span></p>
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={enableAudio} onChange={e => setEnableAudio(e.target.checked)}
                      className="w-4 h-4 accent-[#6B46C1] cursor-pointer" />
                    <span className="text-sm font-bold text-slate-700">Audio</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={enableVideo} onChange={e => setEnableVideo(e.target.checked)}
                      className="w-4 h-4 accent-[#6B46C1] cursor-pointer" />
                    <span className="text-sm font-bold text-slate-700">Video</span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1.5">Note: Video will be deleted after 30 mins.</p>
              </div>

              {/* TERMS */}
              <div className="mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={termsAgreed} onChange={e => setTermsAgreed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#6B46C1] cursor-pointer" />
                  <span className="text-sm text-slate-600 font-medium">
                    I agree with the <span className="text-[#6B46C1] font-bold underline cursor-pointer">terms and conditions</span>.
                  </span>
                </label>
              </div>

              {/* START BUTTON */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <button onClick={() => setSelectionDone(false)}
                  className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">
                  ← Back
                </button>
                <button onClick={handleStart} disabled={starting || !termsAgreed}
                  className={`w-full sm:w-auto px-10 py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 transition-all ${
                    starting || !termsAgreed
                      ? 'bg-slate-300 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-[#6B46C1] to-[#5b3da6] shadow-lg hover:shadow-purple-900/30 hover:scale-[1.02] cursor-pointer'
                  }`}>
                  {starting ? (<><Spinner size="sm" /><span>{loadingText}</span></>) : (<><span>Start Practice</span><span className="text-base">→</span></>)}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Required Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Log In to Start Interview"
        message="Please sign in or create a free account to generate your AI interview questions and start practicing."
      />
    </div>
  );
}

