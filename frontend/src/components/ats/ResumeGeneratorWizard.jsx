import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getResumeGeneratorParsed, generateVerifiedResume,
  previewResumeHtml, downloadResumeHtml, downloadResumeLatex,
} from '../../utils/api.js';
import { useToast } from '../Toast.jsx';

// Bullet fragment connector words the backend's own validator treats as
// "dangling" (ResumeGenerationValidator.DANGLING_ENDINGS) — reused here so a
// clause we strip client-side doesn't leave a limp trailing word behind.
const DANGLING = new Set(['and', 'with', 'the', 'using', 'a', 'an', 'of', 'for', 'to', 'in', 'on']);
const PLACEHOLDER_TOKEN_RE = /\[[^\]]+\]/g;
const PII_DETECT_RE = /date of birth|\bdob\b|\bgender\b|marital status|\breligion\b|\bnationality\b|passport|father'?s|mother tongue/i;

function extractEndYear(resume) {
  const y = resume?.education?.year || '';
  const matches = y.match(/(19|20)\d{2}/g);
  return matches ? parseInt(matches[matches.length - 1], 10) : null;
}

/** Removes the clause containing a placeholder token when the user leaves the
 *  metric blank — "Blank must remove the clause, not fill it." (Prompt Pack
 *  Part 1). The writer LLM still polishes wording; this just needs to avoid
 *  leaving a visible [N]/[X]% in a bullet the candidate chose not to answer. */
function removePlaceholderClause(text, token) {
  const parts = text.split(',');
  const idx = parts.findIndex(p => p.includes(token));
  if (idx === -1) return text;
  if (parts.length === 1) {
    const connectorRe = /\s+(resulting in|supporting|achieving|leading to|serving|totaling|totalling)\b.*$/i;
    const cut = text.replace(connectorRe, '');
    return (cut === text ? text.replace(token, '') : cut).replace(/\s{2,}/g, ' ').trim();
  }
  parts.splice(idx, 1);
  let joined = parts.join(',').replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').replace(/,\s*,/g, ',').trim();
  const words = joined.split(/\s+/);
  while (words.length && DANGLING.has(words[words.length - 1].toLowerCase().replace(/[.,]$/, ''))) {
    words.pop();
  }
  return words.join(' ').replace(/,$/, '').trim();
}

function extractPlaceholderRows(resume) {
  const rows = [];
  (resume?.projects || []).forEach((p, pi) => {
    (p.bullets || []).forEach((b, bi) => {
      const matches = b.match(PLACEHOLDER_TOKEN_RE);
      if (matches) rows.push({ key: `project:${pi}:${bi}`, kind: 'project', label: p.title, text: b, token: matches[0] });
    });
  });
  (resume?.experience || []).forEach((e, ei) => {
    (e.bullets || []).forEach((b, bi) => {
      const matches = b.match(PLACEHOLDER_TOKEN_RE);
      if (matches) rows.push({ key: `experience:${ei}:${bi}`, kind: 'experience', label: e.company, text: b, token: matches[0] });
    });
  });
  return rows;
}

function existingSkillItems(resume) {
  const items = [];
  (resume?.skills || []).forEach(sc => {
    (sc.value || '').split(',').map(s => s.trim()).filter(Boolean).forEach(s => items.push(s));
  });
  return items;
}

const HARD_BLOCK_MESSAGES = {
  projects_or_experience: 'Your resume has no projects or work experience for the writer to draw from. Add at least one before generating.',
  demo_string_leak: 'A placeholder/demo bullet (e.g. "Improved performance by 30%") was detected in your source resume — it looks like sample text rather than your own content. Please replace it and re-upload.',
};

/**
 * ResumeGeneratorWizard
 * ────────────────────────────────────────────────────────────────────────────
 * Fill Gaps Wizard → resume-writer pipeline (Resume Generator Prompt Pack,
 * Part 1). Deliberately a separate component/API surface from
 * GenerateResumeModal, which drives the older AI-reconstruction Studio path —
 * this one talks only to /api/resume-generator/*.
 */
export default function ResumeGeneratorWizard({ reportId, jd = '', onClose }) {
  const { addToast, ToastContainer } = useToast();
  const [step, setStep] = useState('loading'); // loading | blocked | wizard | generating | review | validation_error | error
  const [error, setError] = useState('');
  const [violations, setViolations] = useState([]);
  const [blockingFields, setBlockingFields] = useState([]);
  const [resume, setResume] = useState(null);
  const [suggestedSkills, setSuggestedSkills] = useState([]);
  const [qIndex, setQIndex] = useState(0);

  const [wizard, setWizard] = useState({
    name: '',
    targetJobTitle: '',
    graduationMonthYear: '',
    graduationEndYear: '',
    degree: '',
    specialization: '',
    includeCgpa: false,
    cgpaValue: '',
    skillConfirmations: {},
    placeholderResolutions: {},
    includePersonalDetails: false,
  });

  const [generated, setGenerated] = useState(null); // { resume, omittedFields, unresolvedPlaceholders }
  const [template, setTemplate] = useState('classic');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const iframeRef = useRef(null);

  const placeholderRows = useMemo(() => extractPlaceholderRows(resume), [resume]);
  const personalDetailsDetected = useMemo(
    () => resume && PII_DETECT_RE.test(JSON.stringify(resume)),
    [resume]
  );

  // ── Load parsed resume + gate result ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await getResumeGeneratorParsed(reportId);
        const blocked = data.blockingFields || [];
        setResume(data.resume);
        setSuggestedSkills(data.suggestedSkills || []);
        setBlockingFields(blocked);

        const hardBlock = blocked.find(f => HARD_BLOCK_MESSAGES[f]);
        if (hardBlock) { setStep('blocked'); return; }

        setWizard(w => ({
          ...w,
          name: data.resume?.name || '',
          targetJobTitle: data.resume?.jobTitle || '',
          graduationMonthYear: data.resume?.education?.year || '',
          graduationEndYear: extractEndYear(data.resume) || '',
          degree: data.resume?.education?.degree || '',
          cgpaValue: data.resume?.education?.cgpa || '',
          includeCgpa: !!(data.resume?.education?.cgpa && parseFloat(data.resume.education.cgpa) >= 7.0),
          placeholderResolutions: Object.fromEntries(extractPlaceholderRows(data.resume).map(r => [r.key, ''])),
        }));
        setStep('wizard');
      } catch (e) {
        setError(e.message);
        setStep('error');
      }
    })();
  }, [reportId]);

  // ── Build the question list for this resume ──────────────────────────────
  const questions = useMemo(() => {
    if (!resume) return [];
    const qs = [];
    if (blockingFields.includes('name')) {
      qs.push({ key: 'name', title: 'Confirm your name', required: true });
    }
    qs.push({ key: 'targetJobTitle', title: 'Target job title', required: true });
    if (blockingFields.includes('education') || blockingFields.includes('education.end_year')) {
      qs.push({ key: 'graduation', title: 'Graduation month & year', required: true });
    }
    if (blockingFields.includes('education')) {
      qs.push({ key: 'degree', title: 'Degree & specialization', required: true });
    }
    qs.push({ key: 'cgpa', title: 'CGPA', required: true });
    if (suggestedSkills.length) {
      qs.push({ key: 'skills', title: 'Confirm suggested skills', required: true });
    }
    if (placeholderRows.length) {
      qs.push({ key: 'placeholders', title: 'Real numbers for your metrics', required: false });
    }
    if (personalDetailsDetected) {
      qs.push({ key: 'personal', title: 'Include personal details?', required: true });
    }
    return qs;
  }, [resume, blockingFields, suggestedSkills, placeholderRows, personalDetailsDetected]);

  const current = questions[qIndex];

  const isCurrentAnswered = () => {
    if (!current) return true;
    switch (current.key) {
      case 'name': return wizard.name.trim().length > 0;
      case 'targetJobTitle': return wizard.targetJobTitle.trim().length > 0;
      case 'graduation': return wizard.graduationMonthYear.trim().length > 0 && !!wizard.graduationEndYear;
      case 'degree': return wizard.degree.trim().length > 0;
      case 'cgpa': return !wizard.includeCgpa || wizard.cgpaValue.trim().length > 0;
      case 'skills': return suggestedSkills.every(s => wizard.skillConfirmations[s] !== undefined);
      case 'placeholders': return true; // never blocks — placeholder stays if unanswered
      case 'personal': return true; // boolean toggle always has a value
      default: return true;
    }
  };

  const goNext = () => {
    if (qIndex < questions.length - 1) setQIndex(qIndex + 1);
    else handleGenerate();
  };
  const goBack = () => {
    if (qIndex > 0) setQIndex(qIndex - 1);
  };

  // ── Build the verified payload and call the writer ────────────────────────
  const resolveBulletText = (kind, idx, bulletIdx, text) => {
    const key = `${kind}:${idx}:${bulletIdx}`;
    const row = placeholderRows.find(r => r.key === key);
    if (!row) return text;
    const val = wizard.placeholderResolutions[key];
    return val && val.trim() ? text.replace(row.token, val.trim()) : removePlaceholderClause(text, row.token);
  };

  const buildVerifiedPayload = () => {
    const confirmedSuggested = Object.entries(wizard.skillConfirmations)
      .filter(([, v]) => v === true).map(([k]) => k);

    return {
      name: blockingFields.includes('name') ? wizard.name : (resume.name || ''),
      targetJobTitle: wizard.targetJobTitle,
      email: resume.email || '',
      phone: resume.phone || '',
      location: resume.location || '',
      linkedinUrl: resume.linkedin || '',
      githubUrl: resume.github || '',
      degree: wizard.degree || resume.education?.degree || '',
      specialization: wizard.specialization || '',
      institution: resume.education?.institution || '',
      graduationMonthYear: wizard.graduationMonthYear || resume.education?.year || '',
      graduationEndYear: wizard.graduationEndYear ? parseInt(wizard.graduationEndYear, 10) : extractEndYear(resume),
      includeCgpa: wizard.includeCgpa,
      cgpaValue: wizard.includeCgpa ? wizard.cgpaValue : null,
      coursework: [],
      confirmedSkills: [...existingSkillItems(resume), ...confirmedSuggested],
      experience: (resume.experience || []).map((e, ei) => ({
        title: e.role || '', org: e.company || '', techStack: '', duration: e.duration || '',
        url: '', bullets: (e.bullets || []).map((b, bi) => resolveBulletText('experience', ei, bi, b)),
      })),
      projects: (resume.projects || []).map((p, pi) => ({
        title: p.title || '', org: '', techStack: p.techStack || '', duration: p.duration || '',
        url: '', bullets: (p.bullets || []).map((b, bi) => resolveBulletText('project', pi, bi, b)),
      })),
      achievements: resume.achievements || [],
      certifications: resume.certifications || [],
      leadership: resume.leadership || [],
      placeholderResolutions: wizard.placeholderResolutions,
      includePersonalDetails: wizard.includePersonalDetails,
      jdText: jd || '',
    };
  };

  const handleGenerate = async () => {
    setStep('generating');
    try {
      const result = await generateVerifiedResume(buildVerifiedPayload());
      setGenerated(result);
      setStep('review');
      try {
        setPreviewing(true);
        const { html } = await previewResumeHtml(result.resume, template);
        setPreviewHtml(html);
      } catch { /* preview is best-effort; download still works without it */ }
      setPreviewing(false);
    } catch (e) {
      if (e.violations) { setViolations(e.violations); setStep('validation_error'); }
      else { setError(e.message); setStep('error'); }
    }
  };

  useEffect(() => {
    if (step !== 'review' || !generated) return;
    (async () => {
      setPreviewing(true);
      try {
        const { html } = await previewResumeHtml(generated.resume, template);
        setPreviewHtml(html);
      } catch { /* best-effort */ }
      setPreviewing(false);
    })();
  }, [template]); // eslint-disable-line

  const handleDownloadHtml = async () => {
    try { await downloadResumeHtml(generated.resume, template); }
    catch (e) { addToast('Download failed: ' + e.message, 'error'); }
  };
  const handleDownloadLatex = async () => {
    try { await downloadResumeLatex(generated.resume, template); }
    catch (e) { addToast('Download failed: ' + e.message, 'error'); }
  };
  const handleDownloadPdf = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      addToast('Please wait for the preview to load.', 'error');
    }
  };

  const setSkillAnswer = (skill, val) =>
    setWizard(w => ({ ...w, skillConfirmations: { ...w.skillConfirmations, [skill]: val } }));
  const setPlaceholderAnswer = (key, val) =>
    setWizard(w => ({ ...w, placeholderResolutions: { ...w.placeholderResolutions, [key]: val } }));

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: '92vh' }}
          initial={{ scale: 0.92, opacity: 0, y: 32 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-8 py-5 border-b border-black/[0.06] bg-gradient-to-r from-purple-50 to-white flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white text-base flex-shrink-0">✨</div>
              <div className="min-w-0">
                <h2 className="font-black text-[#111] text-lg leading-tight">Generate My Resume</h2>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                  {step === 'loading' ? 'Checking your resume…'
                    : step === 'blocked' ? 'Needs attention before generating'
                    : step === 'wizard' ? `Step ${qIndex + 1} of ${questions.length}: ${current?.title || ''}`
                    : step === 'generating' ? 'Writing your resume…'
                    : step === 'review' ? 'Preview & Download'
                    : step === 'validation_error' ? 'Generation failed validation'
                    : 'Error'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all text-lg font-bold flex-shrink-0">×</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {step === 'loading' && (
              <div className="flex flex-col items-center justify-center py-24 gap-6">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">✨</div>
                </div>
                <p className="font-black text-[#111] text-base">Checking your resume</p>
              </div>
            )}

            {step === 'blocked' && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 px-4 sm:px-8 text-center">
                <div className="text-5xl">🛑</div>
                <p className="font-black text-[#111] text-lg">Can't generate yet</p>
                <div className="space-y-2 max-w-lg">
                  {blockingFields.filter(f => HARD_BLOCK_MESSAGES[f]).map(f => (
                    <p key={f} className="text-sm text-slate-500 font-medium">{HARD_BLOCK_MESSAGES[f]}</p>
                  ))}
                </div>
              </div>
            )}

            {step === 'error' && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 px-4 sm:px-8 text-center">
                <div className="text-5xl">⚠️</div>
                <p className="font-black text-[#111] text-lg">Something went wrong</p>
                <p className="text-sm text-slate-500">{error}</p>
              </div>
            )}

            {step === 'validation_error' && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 px-4 sm:px-8 text-center">
                <div className="text-5xl">⚠️</div>
                <p className="font-black text-[#111] text-lg">The generated resume didn't pass validation</p>
                <div className="text-left max-w-lg w-full bg-red-50 border border-red-100 rounded-2xl p-4 space-y-1">
                  {violations.map((v, i) => (
                    <p key={i} className="text-xs text-red-700 font-medium">• {v}</p>
                  ))}
                </div>
                <button onClick={handleGenerate} className="px-6 py-2.5 rounded-full bg-[#111] text-white text-sm font-bold hover:bg-black transition-all mt-2">
                  Try again
                </button>
              </div>
            )}

            {step === 'wizard' && current && (
              <div className="px-4 sm:px-8 py-8 space-y-5">
                {current.key === 'name' && (
                  <Field label="What's your full name?" hint="We couldn't confidently detect this from your resume.">
                    <TextInput value={wizard.name} onChange={v => setWizard(w => ({ ...w, name: v }))} placeholder="e.g. Keshav Banger" />
                  </Field>
                )}

                {current.key === 'targetJobTitle' && (
                  <Field label="What role are you targeting?" hint="This appears right under your name.">
                    <TextInput value={wizard.targetJobTitle} onChange={v => setWizard(w => ({ ...w, targetJobTitle: v }))} placeholder="e.g. Java Developer" />
                  </Field>
                )}

                {current.key === 'graduation' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Graduation month & year" hint="As it should appear on the resume.">
                      <TextInput value={wizard.graduationMonthYear} onChange={v => setWizard(w => ({ ...w, graduationMonthYear: v }))} placeholder="e.g. May 2026" />
                    </Field>
                    <Field label="Graduation end year (number)" hint="Used to confirm eligibility.">
                      <TextInput value={String(wizard.graduationEndYear || '')} onChange={v => setWizard(w => ({ ...w, graduationEndYear: v.replace(/\D/g, '').slice(0, 4) }))} placeholder="e.g. 2026" />
                    </Field>
                  </div>
                )}

                {current.key === 'degree' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Degree">
                      <TextInput value={wizard.degree} onChange={v => setWizard(w => ({ ...w, degree: v }))} placeholder="e.g. B.Tech" />
                    </Field>
                    <Field label="Specialization">
                      <TextInput value={wizard.specialization} onChange={v => setWizard(w => ({ ...w, specialization: v }))} placeholder="e.g. Computer Science & Engineering" />
                    </Field>
                  </div>
                )}

                {current.key === 'cgpa' && (
                  <div className="space-y-4">
                    <Field label="Include your CGPA on the resume?" hint="Your call — we default to leaving it off if it's below 7.0.">
                      <YesNo value={wizard.includeCgpa} onChange={v => setWizard(w => ({ ...w, includeCgpa: v }))} />
                    </Field>
                    {wizard.includeCgpa && (
                      <Field label="CGPA value">
                        <TextInput value={wizard.cgpaValue} onChange={v => setWizard(w => ({ ...w, cgpaValue: v }))} placeholder="e.g. 8.2" />
                      </Field>
                    )}
                  </div>
                )}

                {current.key === 'skills' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500 font-medium">
                      Your project bullets suggest these skills, but they aren't listed in your Skills section. Confirm each one — unconfirmed skills are dropped, not added.
                    </p>
                    {suggestedSkills.map(skill => (
                      <div key={skill} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                        <p className="text-sm font-bold text-[#111]">Did you use <span className="text-purple-600">{skill}</span>?</p>
                        <YesNo value={wizard.skillConfirmations[skill]} onChange={v => setSkillAnswer(skill, v)} />
                      </div>
                    ))}
                  </div>
                )}

                {current.key === 'placeholders' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500 font-medium">
                      You wrote these bullets — do you have a real number for each? Leave blank to remove the claim entirely rather than show a placeholder.
                    </p>
                    {placeholderRows.map(row => (
                      <div key={row.key} className="p-4 rounded-2xl border border-slate-200 space-y-2">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">{row.label}</p>
                        <p className="text-sm text-[#111]">{row.text}</p>
                        <TextInput
                          value={wizard.placeholderResolutions[row.key] || ''}
                          onChange={v => setPlaceholderAnswer(row.key, v)}
                          placeholder={`Real value for ${row.token} (leave blank to remove)`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {current.key === 'personal' && (
                  <Field label="Include personal details (DOB, gender, marital status, etc.)?" hint="We recommend leaving these off — most employers don't need them and some regions prohibit asking.">
                    <YesNo value={wizard.includePersonalDetails} onChange={v => setWizard(w => ({ ...w, includePersonalDetails: v }))} />
                  </Field>
                )}
              </div>
            )}

            {step === 'generating' && (
              <div className="flex flex-col items-center justify-center py-24 gap-6">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">✍️</div>
                </div>
                <p className="font-black text-[#111] text-base">Writing your resume</p>
              </div>
            )}

            {step === 'review' && generated && (
              <div className="flex flex-col">
                {generated.unresolvedPlaceholders?.length > 0 && (
                  <div className="mx-8 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-xs text-amber-800 font-bold">
                      ⚠ {generated.unresolvedPlaceholders.length} bullet(s) still contain a placeholder you left unanswered — check the preview before sending this out.
                    </p>
                  </div>
                )}
                {generated.omittedFields?.length > 0 && (
                  <div className="mx-8 mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-xs text-slate-600 font-medium">Omitted: {generated.omittedFields.join(', ')}</p>
                  </div>
                )}

                <div className="px-4 sm:px-8 py-4 border-b border-black/[0.05] flex items-center gap-3 flex-shrink-0 bg-slate-50/70 mt-2">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Template</span>
                  {['classic', 'modern', 'minimal', 'professional', 'compact', 'harvard'].map(t => (
                    <button key={t} onClick={() => setTemplate(t)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all
                        ${template === t ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-200'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-purple-300 hover:text-purple-600'}`}>
                      {t === 'professional' ? 'Professional Accent' : t === 'harvard' ? 'Harvard' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                  {previewing && (
                    <div className="ml-auto flex items-center gap-2 text-xs text-purple-500 font-bold">
                      <div className="h-3 w-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" /> Rendering…
                    </div>
                  )}
                </div>

                <div className="flex-1 bg-slate-100 p-4" style={{ minHeight: '480px' }}>
                  {previewHtml ? (
                    <iframe ref={iframeRef} srcDoc={previewHtml} title="Resume Preview"
                      className="w-full h-full rounded-2xl shadow-xl bg-white border border-black/[0.05]"
                      style={{ minHeight: '460px', border: 'none' }}
                      // The generated resume HTML never contains a <script> tag, so
                      // allow-scripts + allow-same-origin was pure downside: that
                      // combination lets any injected script run with the app's own
                      // origin instead of being sandboxed away. allow-modals is kept
                      // because handleDownloadPdf calls contentWindow.print(), which
                      // the sandbox blocks without it.
                      sandbox="allow-modals" />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-slate-400 font-medium text-sm">
                      {previewing ? 'Generating preview…' : 'Preview will appear here'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-5 border-t border-black/[0.06] bg-white flex-shrink-0">
            <button onClick={onClose} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors order-2 sm:order-1">Cancel</button>

            <div className="flex flex-wrap items-center gap-3 order-1 sm:order-2">
              {step === 'wizard' && qIndex > 0 && (
                <button onClick={goBack} className="px-5 py-2.5 rounded-full border border-slate-200 text-sm font-bold text-slate-500 hover:border-slate-300 transition-all">← Back</button>
              )}
              {step === 'wizard' && (
                <button onClick={goNext} disabled={current?.required && !isCurrentAnswered()}
                  className="px-7 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-purple-200 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  {qIndex < questions.length - 1 ? 'Next →' : '✨ Generate Resume'}
                </button>
              )}
              {step === 'review' && (
                <>
                  <div className="relative group">
                    <button onClick={handleDownloadPdf} className="px-5 py-2.5 rounded-full bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm">
                      📄 Download PDF
                    </button>
                    <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 rounded-lg bg-slate-900 text-white text-[11px] leading-snug opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none text-center">
                      In the print dialog, turn off <strong>"Headers and footers"</strong> under "More settings".
                    </div>
                  </div>
                  <button onClick={handleDownloadHtml} className="px-5 py-2.5 rounded-full bg-[#111827] text-white text-sm font-bold hover:bg-black transition-all flex items-center gap-2 shadow-sm">⬇ Download HTML</button>
                  <button onClick={handleDownloadLatex} className="px-5 py-2.5 rounded-full bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm">⚛ Download LaTeX</button>
                </>
              )}
            </div>
          </div>
        </motion.div>
        {/* Rendered outside the scale-animated panel above: framer-motion's
            transform on that panel makes it a containing block for
            position:fixed descendants, which would otherwise clip/misplace
            the toast container instead of anchoring it to the viewport. */}
        <ToastContainer />
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-[#111]">{label}</label>
      {hint && <p className="text-xs text-slate-400 font-medium">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-[#111] placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
    />
  );
}

function YesNo({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(true)}
        className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${value === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'}`}>
        Yes
      </button>
      <button onClick={() => onChange(false)}
        className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${value === false ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
        No
      </button>
    </div>
  );
}
