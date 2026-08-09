import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getResumeConfidence, previewResumeHtml, downloadResumeHtml, downloadResumeLatex } from '../../utils/api.js';

/**
 * GenerateResumeModal
 * ────────────────────────────────────────────────────────────────────────────
 * Multi-step modal:
 *   Step 1 — Loading confidence check
 *   Step 2 — Fill in missing / uncertain fields
 *   Step 3 — Template selector + Live HTML preview
 *   Step 4 — Download options (HTML / Studio DOCX)
 */
export default function GenerateResumeModal({ reportId, jd = '', onClose }) {
  const [step, setStep]         = useState('loading'); // loading | missing | preview | done
  const [resume, setResume]     = useState(null);
  const [conf, setConf]         = useState(null);
  const [template, setTemplate] = useState('classic');
  const [fields, setFields]     = useState({}); // user-typed overrides for missing fields
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewing, setPreviewing]   = useState(false);
  const [error, setError]       = useState('');
  const iframeRef               = useRef(null);

  // ── Step 1: run confidence check ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await getResumeConfidence(reportId, jd, 'classic');
        setConf(data.confidence);
        setResume(data.resume);
        // Pre-fill user fields from current resume
        const initFields = {};
        (data.confidence.missingFields || []).forEach(mf => {
          initFields[mf.fieldKey] = '';
        });
        setFields(initFields);
        // If nothing is missing, jump straight to preview
        if ((data.confidence.missingFields || []).length === 0) {
          setStep('preview');
        } else {
          setStep('missing');
        }
      } catch (e) {
        setError(e.message);
        setStep('error');
      }
    })();
  }, [reportId, jd]);

  // ── Merge user-typed values into resume ───────────────────────────────────
  const mergedResume = () => {
    if (!resume) return null;
    const r = { ...resume };
    Object.entries(fields).forEach(([key, val]) => {
      if (!val) return;
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        r[parent] = { ...(r[parent] || {}), [child]: val };
      } else {
        r[key] = val;
      }
    });
    return r;
  };

  // ── Step 2 → 3: generate preview ─────────────────────────────────────────
  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const { html } = await previewResumeHtml(mergedResume(), template);
      setPreviewHtml(html);
      setStep('preview');
    } catch (e) {
      setError(e.message);
    }
    setPreviewing(false);
  };

  // Re-generate preview when template changes (only in preview step)
  useEffect(() => {
    if (step !== 'preview' || !resume) return;
    (async () => {
      setPreviewing(true);
      try {
        const { html } = await previewResumeHtml(mergedResume(), template);
        setPreviewHtml(html);
      } catch {}
      setPreviewing(false);
    })();
  }, [template]); // eslint-disable-line

  const handleDownloadHtml = async () => {
    try { await downloadResumeHtml(mergedResume(), template); }
    catch (e) { alert('Download failed: ' + e.message); }
  };

  const handleDownloadLatex = async () => {
    try { await downloadResumeLatex(mergedResume(), template); }
    catch (e) { alert('Download failed: ' + e.message); }
  };

  const handleDownloadPdf = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      alert("Please wait for the preview to load.");
    }
  };

  const handleOpenStudio = () => {
    window.open(`/ats/studio/${reportId}?jd=${encodeURIComponent(jd)}`, '_blank');
  };

  // ── Overlay click to close ────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: '92vh' }}
          initial={{ scale: 0.92, opacity: 0, y: 32 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          {/* ── Modal Header ── */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-black/[0.06] bg-gradient-to-r from-purple-50 to-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white text-base">
                ✨
              </div>
              <div>
                <h2 className="font-black text-[#111] text-lg leading-tight">Generate My Resume</h2>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {step === 'loading' ? 'Checking resume fields…'
                    : step === 'missing' ? `${conf?.missingFields?.length} field(s) need your input`
                    : step === 'preview' ? 'Preview & Download'
                    : 'Error'}
                </p>
              </div>
            </div>
            {/* Step indicator */}
            <div className="hidden sm:flex items-center gap-2 mr-8">
              {[['loading', '1', 'Analyze'], ['missing', '2', 'Fill Gaps'], ['preview', '3', 'Preview']].map(([s, num, lbl]) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all
                    ${step === s ? 'bg-purple-600 text-white' :
                      ((['missing','preview'].includes(step) && s === 'loading') ||
                       (step === 'preview' && s === 'missing'))
                        ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {((['missing','preview'].includes(step) && s === 'loading') ||
                       (step === 'preview' && s === 'missing')) ? '✓' : num}
                  </div>
                  <span className={`text-[10px] font-bold hidden md:block ${step === s ? 'text-purple-600' : 'text-slate-400'}`}>{lbl}</span>
                  {s !== 'preview' && <div className="w-6 h-px bg-slate-200 hidden md:block" />}
                </div>
              ))}
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all text-lg font-bold">
              ×
            </button>
          </div>

          {/* ── Modal Body ── */}
          <div className="flex-1 overflow-y-auto">

            {/* LOADING */}
            {step === 'loading' && (
              <div className="flex flex-col items-center justify-center py-24 gap-6">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">✨</div>
                </div>
                <div className="text-center">
                  <p className="font-black text-[#111] text-base">Analyzing Your Resume</p>
                  <p className="text-sm text-slate-400 mt-1">Checking field completeness…</p>
                </div>
              </div>
            )}

            {/* ERROR */}
            {step === 'error' && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 px-8 text-center">
                <div className="text-5xl">⚠️</div>
                <p className="font-black text-[#111] text-lg">Something went wrong</p>
                <p className="text-sm text-slate-500">{error}</p>
                <button onClick={onClose} className="px-6 py-2.5 rounded-full bg-[#111] text-white text-sm font-bold hover:bg-black transition-all mt-2">
                  Close
                </button>
              </div>
            )}

            {/* MISSING FIELDS */}
            {step === 'missing' && conf && (
              <div className="px-8 py-6 space-y-6">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3 items-start">
                  <span className="text-xl flex-shrink-0 mt-0.5">⚡</span>
                  <p className="text-sm text-amber-800 font-medium leading-relaxed">
                    These fields were missing or unclear in your resume. Fill them in for the best result — you can leave optional ones blank.
                  </p>
                </div>

                {/* Group by section */}
                {['contact', 'education', 'summary'].map(section => {
                  const sectionFields = (conf.missingFields || []).filter(f => f.section === section);
                  if (!sectionFields.length) return null;
                  return (
                    <div key={section}>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        {section === 'contact' ? '📇 Contact Information'
                          : section === 'education' ? '🎓 Education'
                          : '📝 Professional Summary'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {sectionFields.map(mf => (
                          <div key={mf.fieldKey} className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                              {mf.label}
                              {mf.required && <span className="text-red-500 text-[10px]">*required</span>}
                            </label>
                            {mf.fieldKey === 'professionalSummary' ? (
                              <textarea
                                rows={3}
                                value={fields[mf.fieldKey] || ''}
                                onChange={e => setFields(f => ({ ...f, [mf.fieldKey]: e.target.value }))}
                                placeholder={mf.placeholder}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-[#111] placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all resize-none"
                              />
                            ) : (
                              <input
                                type="text"
                                value={fields[mf.fieldKey] || ''}
                                onChange={e => setFields(f => ({ ...f, [mf.fieldKey]: e.target.value }))}
                                placeholder={mf.placeholder}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-[#111] placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Uncertain fields notice */}
                {(conf.uncertainFields || []).length > 0 && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="text-xs text-blue-700 font-medium">
                      🔍 These fields were auto-detected and may need review in the Studio:{' '}
                      <span className="font-bold">{conf.uncertainFields.join(', ')}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* PREVIEW */}
            {step === 'preview' && (
              <div className="flex flex-col">
                {/* Template switcher */}
                <div className="px-8 py-4 border-b border-black/[0.05] flex items-center gap-3 flex-shrink-0 bg-slate-50/70">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Template</span>
                  {['classic', 'modern', 'minimal', 'professional', 'compact', 'harvard'].map(t => (
                    <button
                      key={t}
                      onClick={() => setTemplate(t)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all
                        ${template === t
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-200'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-purple-300 hover:text-purple-600'}`}
                    >
                      {t === 'professional' ? 'Professional Accent' : t === 'harvard' ? 'Harvard' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                  {previewing && (
                    <div className="ml-auto flex items-center gap-2 text-xs text-purple-500 font-bold">
                      <div className="h-3 w-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                      Rendering…
                    </div>
                  )}
                </div>

                {/* iframe preview */}
                <div className="flex-1 bg-slate-100 p-4" style={{ minHeight: '480px' }}>
                  {previewHtml ? (
                    <iframe
                      ref={iframeRef}
                      srcDoc={previewHtml}
                      title="Resume Preview"
                      className="w-full h-full rounded-2xl shadow-xl bg-white border border-black/[0.05]"
                      style={{ minHeight: '460px', border: 'none' }}
                      sandbox="allow-same-origin allow-scripts allow-modals"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-slate-400 font-medium text-sm">
                      {previewing ? 'Generating preview…' : 'Preview will appear here'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Modal Footer (actions) ── */}
          <div className="flex items-center justify-between px-8 py-5 border-t border-black/[0.06] bg-white flex-shrink-0">
            <button onClick={onClose}
              className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
              Cancel
            </button>

            <div className="flex items-center gap-3">
              {/* Back button in preview step */}
              {step === 'preview' && conf?.missingFields?.length > 0 && (
                <button onClick={() => setStep('missing')}
                  className="px-5 py-2.5 rounded-full border border-slate-200 text-sm font-bold text-slate-500 hover:border-slate-300 transition-all">
                  ← Edit Fields
                </button>
              )}

              {/* Missing → Preview */}
              {step === 'missing' && (
                <button
                  onClick={handlePreview}
                  disabled={previewing}
                  className="px-7 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-purple-200 hover:opacity-90 transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  {previewing ? (
                    <><div className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Generating…</>
                  ) : '✨ Preview Resume →'}
                </button>
              )}

              {/* Preview → Download */}
              {step === 'preview' && (
                <>
                  <div className="relative group">
                    <button
                      onClick={handleDownloadPdf}
                      className="px-5 py-2.5 rounded-full bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm"
                    >
                      📄 Download PDF
                    </button>
                    {/* PDF export goes through the browser's print dialog —
                        if "Headers and footers" is checked there, Chrome
                        prints its own page URL/timestamp onto the resume.
                        We can't disable that from the page itself, so tell
                        the user how to. */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 rounded-lg bg-slate-900 text-white text-[11px] leading-snug opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none text-center">
                      In the print dialog, turn off <strong>"Headers and footers"</strong> under "More settings" — otherwise Chrome adds its own timestamp/URL to the page.
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadHtml}
                    className="px-5 py-2.5 rounded-full bg-[#111827] text-white text-sm font-bold hover:bg-black transition-all flex items-center gap-2 shadow-sm"
                  >
                    ⬇ Download HTML
                  </button>
                  <button
                    onClick={handleDownloadLatex}
                    className="px-5 py-2.5 rounded-full bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm"
                  >
                    ⚛ Download LaTeX
                  </button>
                  <button
                    onClick={handleOpenStudio}
                    className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-purple-200 hover:opacity-90 transition-all flex items-center gap-2"
                  >
                    🖊 Edit in Studio →
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
