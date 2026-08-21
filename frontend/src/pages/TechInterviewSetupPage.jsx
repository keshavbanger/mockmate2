import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateInterviewPlan, startTechInterview, createSession, parseResume } from '../utils/api';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import LoginModal from '../components/LoginModal.jsx';
import ResumeUploadCard, { ResumeParsedBadge } from '../components/shared/ResumeUploadCard.jsx';
import { ROLE_LEVELS, INTERVIEW_TYPES, COMPANY_STYLES, LANGUAGES } from '../constants/interviewOptions.js';

export default function TechInterviewSetupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Core Form State (3 Essential Fields primary, optional advanced)
  // Either { mode: 'upload', file, saveAsResume, label } or
  // { mode: 'saved', savedResumeId } — see ResumeSourcePicker.
  const [resumeSource, setResumeSource] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [parsedResumeData, setParsedResumeData] = useState(null);
  // Throwaway session used only to satisfy parseResume's session_id
  // requirement for this eager preview — handleGeneratePlan below neither
  // reads nor reuses it, it submits resumeSource straight to its own
  // FormData exactly as before.
  const [previewSessionId, setPreviewSessionId] = useState(null);
  const [roleLevel, setRoleLevel]     = useState('SDE_1');
  const [jdText, setJdText]           = useState('');

  // Advanced accordion state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [interviewType, setInterviewType] = useState('BACKEND');
  const [companyStyle, setCompanyStyle]   = useState('GENERIC');
  const [durationMinutes, setDuration]    = useState(45);
  const [preferredLanguage, setLanguage]  = useState('java');
  const [startDirectlyToDsa, setStartDirectlyToDsa] = useState(false);

  // Pre-fill from the account's saved Interview Preferences (set on
  // Profile) once the user loads — only overrides the hardcoded defaults
  // above when a preference actually exists, and only once, so it doesn't
  // clobber whatever the user is actively picking on this page.
  useEffect(() => {
    if (!user) return;
    if (user.prefRoleLevel) setRoleLevel(user.prefRoleLevel);
    if (user.prefInterviewType) setInterviewType(user.prefInterviewType);
    if (user.prefCompanyStyle) setCompanyStyle(user.prefCompanyStyle);
    if (user.prefDurationMinutes) setDuration(user.prefDurationMinutes);
    if (user.prefLanguage) setLanguage(user.prefLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Step state: 'setup' | 'preview' | 'starting'
  const [step, setStep]       = useState('setup');
  const [plan, setPlan]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Fires whenever ResumeSourcePicker (inside ResumeUploadCard) reports a
  // usable source — parses eagerly, same pattern as SetupPage/Interview
  // Studio, so the "Resume Parsed & Linked" summary shows before Generate
  // Plan is even clicked. Purely additive: handleGeneratePlan below still
  // submits resumeSource through its own FormData exactly as before, so
  // this can't affect the actual plan-generation call.
  const handleResumeSource = useCallback(async (source) => {
    setUploading(true);
    try {
      let sid = previewSessionId;
      if (!sid) {
        const { data } = await createSession();
        sid = data.session_id;
        setPreviewSessionId(sid);
      }
      const { data } = await parseResume(source, sid);
      setParsedResumeData(data.resume_data);
      setUploadDone(true);
    } catch (err) {
      console.error('[TechInterviewSetup] Resume parse failed:', err);
      setError(err?.response?.data?.detail ?? 'Resume upload failed. Please try again.');
      setUploadDone(false);
    } finally {
      setUploading(false);
    }
  }, [previewSessionId]);

  useEffect(() => {
    if (!resumeSource) return;
    if (resumeSource.mode === 'upload' && !resumeSource.file) return;
    if (resumeSource.mode === 'saved' && !resumeSource.savedResumeId) return;
    handleResumeSource(resumeSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSource]);

  const handleReplaceResume = () => {
    setUploadDone(false);
    setResumeSource(null);
    setParsedResumeData(null);
  };

  // Auto-detect role track from JD text when pasted
  const handleJdChange = (text) => {
    setJdText(text);
    const lower = text.toLowerCase();
    if (lower.includes('react') || lower.includes('frontend') || lower.includes('css')) {
      setInterviewType('FRONTEND');
    } else if (lower.includes('machine learning') || lower.includes('data science') || lower.includes('pytorch')) {
      setInterviewType('DATA_SCIENCE');
    } else if (lower.includes('kubernetes') || lower.includes('docker') || lower.includes('aws')) {
      setInterviewType('DEVOPS');
    }
  };

  // Generate Plan Preview
  const handleGeneratePlan = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    // Resume upload used to be silently optional — skipping it meant the
    // backend generated the whole interview (theory questions, candidate
    // profile, everything) with an empty resumeText, so nothing was ever
    // actually personalized even though the personalization prompt/plumbing
    // was working correctly. The page promises "Tailored specifically to
    // your resume" — enforce that instead of degrading silently.
    const hasResumeSource = (resumeSource?.mode === 'saved' && resumeSource.savedResumeId)
      || (resumeSource?.mode === 'upload' && resumeSource.file);
    if (!hasResumeSource) {
      setError('Please upload your resume first — without it, every question defaults to generic and nothing is tailored to your actual background.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      if (resumeSource.mode === 'saved') {
        formData.append('savedResumeId', resumeSource.savedResumeId);
      } else {
        formData.append('resume', resumeSource.file);
        if (resumeSource.saveAsResume) formData.append('saveAsResume', 'true');
        if (resumeSource.label) formData.append('label', resumeSource.label);
      }
      formData.append('jdText', jdText || 'Software Engineer general technical assessment');
      formData.append('roleLevel', roleLevel);
      formData.append('interviewType', interviewType);
      formData.append('companyStyle', companyStyle);
      formData.append('durationMinutes', String(durationMinutes));
      formData.append('preferredLanguage', preferredLanguage);
      if (startDirectlyToDsa) {
        formData.append('startDirectlyToDsa', 'true');
      }

      const { data } = await generateInterviewPlan(formData);
      setPlan(data.plan);
      setStep('preview');
    } catch (err) {
      console.error('[TechInterviewSetupPage] generatePlan failed:', err);
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to generate interview plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Start Interview Session
  const handleStart = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setStep('starting');
    setLoading(true);
    try {
      const { data } = await startTechInterview({ planId: plan.planId, plan });
      navigate(`/tech-interview/${data.sessionId}`, {
        state: {
          sessionId: data.sessionId,
          firstMessage: data.firstMessage,
          plan,
          editorConfig: data.editorConfig
        }
      });
    } catch (err) {
      setError('Failed to launch interview session. Please try again.');
      setStep('preview');
      setLoading(false);
    }
  };

  const roundColor = (type) => {
    const map = {
      INTRO: '#8b5cf6', TECHNICAL_THEORY: '#3b82f6', DSA: '#10b981',
      SQL: '#f59e0b', SYSTEM_DESIGN: '#ef4444', LLD: '#ec4899',
      PROJECT_DEEP_DIVE: '#06b6d4', BEHAVIORAL: '#64748b', WRAP_UP: '#14b8a6',
    };
    return map[type] || '#64748b';
  };

  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif] text-slate-900 overflow-x-hidden flex flex-col items-center pt-32 pb-16 px-5">
        <Navbar />

        {/* ── Background Blobs ── */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 -left-60 w-[400px] h-[400px] bg-indigo-200/15 rounded-full blur-[100px]" />
        </div>

        <div className="w-full max-w-[1150px]">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 bg-purple-100/70 text-[#6B46C1] px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest mb-6 border border-purple-200 shadow-sm">
              ⚡ TECHNICAL INTERVIEW LAB
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#111] leading-[1.15] mb-4">
              AI Technical Interview<br />
              <span className="bg-gradient-to-r from-[#6B46C1] via-[#8B5CF6] to-[#A855F7] bg-clip-text text-transparent">
                Sandbox & Engine
              </span>
            </h1>
            <p className="text-slate-500 text-base leading-relaxed max-w-xl mx-auto mb-8 font-medium">
              Tailored specifically to your resume & target role with real-time code execution, live DSA sandbox & logic-driven round progression.
            </p>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          {/* 3 Essential Steps Grid */}
          <div style={styles.grid}>
            {/* Step 1: Resume Upload */}
            <div style={styles.card}>
              <div style={{ ...styles.cardHeader, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={styles.stepNum}>1</span>
                  <div>
                    <h3 style={styles.cardTitle}>Upload Resume <span style={{ color: '#EF4444' }}>*</span></h3>
                    <p style={styles.cardSub}>Required — parses your projects & tech stack so questions are actually about you, not generic</p>
                  </div>
                </div>
                {uploadDone && <ResumeParsedBadge />}
              </div>

              <ResumeUploadCard
                uploading={uploading}
                uploadDone={uploadDone}
                resumeData={parsedResumeData}
                onSourceChange={setResumeSource}
                onReplace={handleReplaceResume}
              />
            </div>

            {/* Step 2: Experience Level */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.stepNum}>2</span>
                <div>
                  <h3 style={styles.cardTitle}>Experience Level</h3>
                  <p style={styles.cardSub}>Sets difficulty, DSA rigor & System Design inclusion</p>
                </div>
              </div>

              <div style={styles.pillStack}>
                {ROLE_LEVELS.map((lvl) => (
                  <button
                    key={lvl.value}
                    style={{
                      ...styles.pillBtn,
                      ...(roleLevel === lvl.value ? styles.pillBtnActive : {}),
                    }}
                    onClick={() => setRoleLevel(lvl.value)}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Job Description */}
            <div style={{ ...styles.card, gridColumn: 'span 2' }}>
              <div style={styles.cardHeader}>
                <span style={styles.stepNum}>3</span>
                <div>
                  <h3 style={styles.cardTitle}>Target Job Description</h3>
                  <p style={styles.cardSub}>Paste JD text to align interview topics with company requirements</p>
                </div>
              </div>

              <textarea
                style={styles.jdTextarea}
                placeholder="Paste Job Description here (e.g. Seeking Senior Java Engineer proficient in Spring Boot, PostgreSQL, Microservices & Redis...)"
                value={jdText}
                onChange={(e) => handleJdChange(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          {/* Advanced Accordion Toggle */}
          <div style={styles.accordionContainer}>
            <button
              style={styles.accordionToggle}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>⚙️ Advanced Settings (Track, Company Style, Language, Duration)</span>
              <span>{showAdvanced ? '▲ Hide' : '▼ Expand'}</span>
            </button>

            {showAdvanced && (
              <div style={styles.advancedGrid}>
                <div>
                  <label style={styles.label}>Interview Track</label>
                  <select
                    style={styles.selectInput}
                    value={interviewType}
                    onChange={(e) => setInterviewType(e.target.value)}
                  >
                    {INTERVIEW_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Company Style</label>
                  <select
                    style={styles.selectInput}
                    value={companyStyle}
                    onChange={(e) => setCompanyStyle(e.target.value)}
                  >
                    {COMPANY_STYLES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Code Language</label>
                  <select
                    style={styles.selectInput}
                    value={preferredLanguage}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Session Duration</label>
                  <select
                    style={styles.selectInput}
                    value={durationMinutes}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes (Recommended)</option>
                    <option value={60}>60 Minutes</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Fast-Track Compiler Test Toggle */}
          <div
            style={{
              marginTop: '20px',
              padding: '14px 18px',
              background: startDirectlyToDsa ? 'rgba(16, 185, 129, 0.08)' : '#ffffff',
              border: startDirectlyToDsa ? '1px solid #10b981' : '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onClick={() => setStartDirectlyToDsa(!startDirectlyToDsa)}
          >
            <input
              type="checkbox"
              checked={startDirectlyToDsa}
              onChange={(e) => setStartDirectlyToDsa(e.target.checked)}
              style={{ cursor: 'pointer', width: '20px', height: '20px', accentColor: '#10b981' }}
            />
            <div>
              <strong style={{ color: startDirectlyToDsa ? '#059669' : '#111827', fontSize: '0.95rem', display: 'block', marginBottom: '2px' }}>
                ⚡ Fast-Track Compiler Test Mode
              </strong>
              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                Skip introductory dialogue and start the interview directly inside the DSA Coding Round with Two Sum loaded!
              </span>
            </div>
          </div>

          {/* Action Footer */}
          <div style={styles.actionFooter}>
            <button
              style={{
                ...styles.primarySubmitBtn,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onClick={handleGeneratePlan}
              disabled={loading}
            >
              {loading ? '⏳ Generating Custom Interview Plan...' : 'Generate Interview Plan ✨'}
            </button>
          </div>
          {/* Login Required Modal */}
          <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            title="Log In for Technical Interview"
            message="Please sign in or create a free account to generate your AI coding plan and start your live DSA sandbox session."
          />
        </div>
        <Footer />
      </div>
    );
  }

  // ── Step: Preview Plan ──────────────────────────────────────
  if (step === 'preview' && plan) {
    const roundsList = plan.interviewPlan?.rounds || plan.rounds || [];
    const config = plan.interviewPlan?.config || plan.config || {};
    const totalMin = roundsList.reduce((acc, r) => acc + (r.allocatedMinutes || 0), 0);

    return (
      <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif] text-slate-900 overflow-x-hidden flex flex-col items-center pt-32 pb-16 px-5">
        <Navbar />

        {/* ── Background Blobs ── */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 -left-60 w-[400px] h-[400px] bg-indigo-200/15 rounded-full blur-[100px]" />
        </div>

        <div className="w-full max-w-[1150px]">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 bg-purple-100/70 text-[#6B46C1] px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest mb-6 border border-purple-200 shadow-sm">
              ✨ INTERVIEW PLAN GENERATED
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#111] leading-[1.15] mb-4">
              Your Personalized<br />
              <span className="bg-gradient-to-r from-[#6B46C1] via-[#8B5CF6] to-[#A855F7] bg-clip-text text-transparent">
                Technical Roadmap
              </span>
            </h1>
            <p className="text-slate-500 text-base leading-relaxed max-w-xl mx-auto mb-8 font-medium">
              Review the structured interview rounds generated by MockMate AI tailored for your profile.
            </p>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          {/* Plan Summary Card */}
          <div style={{ ...styles.card, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', color: '#111827', fontWeight: '700' }}>
                  {config.interviewType} ({config.roleLevel})
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '4px' }}>
                  Target Company Style: {config.companyStyle} • Total Duration: {totalMin} minutes
                </div>
              </div>
              <button
                style={styles.secondaryBtn}
                onClick={() => setStep('setup')}
              >
                ✏️ Reconfigure
              </button>
            </div>
          </div>

          {/* Rounds List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            {roundsList.map((r, i) => (
              <div key={r.roundId || i} style={styles.roundCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      ...styles.roundBadge,
                      backgroundColor: roundColor(r.roundType),
                    }}
                  >
                    {r.roundType}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', color: '#111827', fontWeight: '600', margin: 0 }}>
                      {r.roundName}
                    </h4>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>
                      {r.allocatedMinutes} min • {r.questionCount || 2} questions • {r.difficulty}
                    </div>
                  </div>
                </div>

                {r.topics && r.topics.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {r.topics.map((tp, idx) => (
                      <span key={idx} style={styles.topicChip}>
                        {tp}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Start Action */}
          <div style={styles.actionFooter}>
            <button
              style={{
                ...styles.primarySubmitBtn,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? '🚀 Initializing Engine...' : 'Begin Technical Interview Session 🎙️'}
            </button>
          </div>
          {/* Login Required Modal */}
          <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            title="Log In for Technical Interview"
            message="Please sign in or create a free account to generate your AI coding plan and start your live DSA sandbox session."
          />
        </div>
        <Footer />
      </div>
    );
  }

  return null;
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#fafafa',
    color: '#111827',
    paddingTop: '128px',
    paddingBottom: '60px',
    paddingLeft: '20px',
    paddingRight: '20px',
    fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: '1150px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  badge: {
    display: 'inline-block',
    background: '#F3E8FF',
    color: '#6B46C1',
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '4px 12px',
    borderRadius: '20px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '12px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#111827',
    letterSpacing: '-0.02em',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: '#6b7280',
    margin: 0,
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    marginBottom: '20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '20px',
  },
  card: {
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  stepNum: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#6B46C1',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
  },
  cardSub: {
    fontSize: '0.75rem',
    color: '#6b7280',
    margin: '2px 0 0 0',
  },
  dropzone: {
    border: '2px dashed rgba(0, 0, 0, 0.12)',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#fafafa',
    transition: 'all 0.2s ease',
  },
  fileSelected: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.88rem',
    color: '#111827',
  },
  changeBtn: {
    background: 'transparent',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    color: '#6b7280',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  pillStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  pillBtn: {
    background: '#fafafa',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    color: '#6b7280',
    borderRadius: '10px',
    padding: '8px 14px',
    fontSize: '0.82rem',
    fontWeight: '500',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  pillBtnActive: {
    background: '#F3E8FF',
    border: '1px solid #6B46C1',
    color: '#6B46C1',
    fontWeight: '600',
  },
  jdTextarea: {
    width: '100%',
    background: '#fafafa',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '12px',
    color: '#111827',
    padding: '12px',
    fontSize: '0.88rem',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
  accordionContainer: {
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '16px',
    padding: '14px 20px',
    marginBottom: '24px',
  },
  accordionToggle: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#374151',
    fontSize: '0.85rem',
    fontWeight: '600',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  advancedGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '14px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    color: '#6b7280',
    marginBottom: '6px',
    fontWeight: '500',
  },
  selectInput: {
    width: '100%',
    background: '#fafafa',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
    color: '#111827',
    padding: '8px 10px',
    fontSize: '0.8rem',
    outline: 'none',
  },
  actionFooter: {
    display: 'flex',
    justifyContent: 'center',
  },
  primarySubmitBtn: {
    width: '100%',
    maxWidth: '400px',
    background: '#6B46C1',
    border: 'none',
    color: '#ffffff',
    padding: '14px 28px',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: '700',
    boxShadow: '0 4px 20px rgba(107, 70, 193, 0.3)',
    cursor: 'pointer',
    transition: 'transform 0.15s ease',
  },
  secondaryBtn: {
    background: '#fafafa',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    color: '#374151',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  roundCard: {
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '14px',
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  roundBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#ffffff',
    padding: '3px 8px',
    borderRadius: '6px',
    textTransform: 'uppercase',
  },
  topicChip: {
    background: '#F3E8FF',
    border: '1px solid rgba(107, 70, 193, 0.15)',
    color: '#6B46C1',
    fontSize: '0.72rem',
    padding: '3px 8px',
    borderRadius: '6px',
  },
};
