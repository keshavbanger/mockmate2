import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import '../studio.css';

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');
const getToken = () => localStorage.getItem('mockmate_token') || '';

// ── colour constants for preview matching the 3 templates ─────────────────────
const TEMPLATE_STYLES = {
  classic:      { name: '#1A1A2E', accent: '#2C5F8A', body: '#222222', gray: '#555555', font: 'Calibri, Georgia, serif' },
  modern:       { name: '#0F172A', accent: '#059669', body: '#1E293B', gray: '#64748B', font: 'Calibri, Inter, sans-serif' },
  minimal:      { name: '#000000', accent: '#000000', body: '#222222', gray: '#666666', font: 'Georgia, serif' },
  professional: { name: '#1E3A8A', accent: '#2563EB', body: '#1E293B', gray: '#475569', font: 'Times New Roman, Georgia, serif' },
  compact:      { name: '#0F172A', accent: '#0D9488', body: '#334155', gray: '#64748B', font: 'Arial, Helvetica, sans-serif' },
};

// ── Debounce hook ──────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Score ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 72 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = ((score || 0) / 100) * circ;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%', fill: color, fontSize: 15, fontWeight: 700 }}>
        {score ?? '--'}
      </text>
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ResumeStudioPage() {
  const { reportId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jdFromUrl = searchParams.get('jd') || '';

  const [resume, setResume]       = useState(null);
  const [jd, setJd]               = useState(jdFromUrl);
  const [template, setTemplate]   = useState('classic');
  const [atsScore, setAtsScore]   = useState(null);
  const [scoring, setScoring]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError]         = useState('');
  const [activeTab, setActiveTab] = useState('experience'); // editor panel tab
  const [missing, setMissing]     = useState([]);
  const [quickFixes, setQuickFixes] = useState([]);

  const debouncedResume   = useDebounce(resume, 800);
  const debouncedTemplate = useDebounce(template, 800);
  const styles = TEMPLATE_STYLES[template] || TEMPLATE_STYLES.classic;

  // ── Load from API ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!reportId) return;
    setLoading(true);
    fetch(`${BASE}/api/resume-studio/load/${reportId}?jd=${encodeURIComponent(jd)}&template=${template}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setResume(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [reportId]); // load once on mount

  // ── Live ATS scoring (debounced) ──────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedResume) return;
    setScoring(true);
    fetch(`${BASE}/api/resume-studio/score?jd=${encodeURIComponent(jd)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(debouncedResume),
    })
      .then(r => r.json())
      .then(data => {
        setAtsScore(data.overallScore);
        setMissing(data.missingKeywords || []);
        setQuickFixes(data.quickFixes || []);
        setScoring(false);
      })
      .catch(() => setScoring(false));
  }, [debouncedResume, jd]);

  // ── Auto-save edited resume (debounced) ──────────────────────────────────────
  useEffect(() => {
    if (!debouncedResume || !reportId) return;
    setSaving(true);
    fetch(`${BASE}/api/resume-studio/save/${reportId}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(debouncedResume),
    })
      .then(r => {
        if (!r.ok) throw new Error('Save failed');
        return r.json();
      })
      .then(() => setSaving(false))
      .catch(e => {
        console.error('[Studio] Auto-save error:', e);
        setSaving(false);
      });
  }, [debouncedResume, reportId]);

  // ── Download DOCX ─────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!resume) return;
    setDownloading(true);
    try {
      const res = await fetch(`${BASE}/api/resume-studio/download?template=${template}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(resume),
      });
      if (!res.ok) throw new Error('Download failed');
      const score = res.headers.get('X-ATS-Score');
      if (score) setAtsScore(parseInt(score));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(resume.name || 'resume').replace(/\s+/g,'_').toLowerCase()}_resume.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    setDownloading(false);
  };

  // ── Download LaTeX ────────────────────────────────────────────────────────────
  const handleDownloadLatex = async () => {
    if (!resume) return;
    setDownloading(true);
    try {
      const res = await fetch(`${BASE}/api/resume-studio/generate-latex?template=${template}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(resume),
      });
      if (!res.ok) throw new Error('LaTeX Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(resume.name || 'resume').replace(/\s+/g,'_').toLowerCase()}_resume.tex`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    setDownloading(false);
  };

  // ── Field updaters ────────────────────────────────────────────────────────────
  const set = (field, val) => setResume(r => ({ ...r, [field]: val }));

  const setExpField = (idx, field, val) => setResume(r => {
    const list = [...(r.experience || [])];
    list[idx] = { ...list[idx], [field]: val };
    return { ...r, experience: list };
  });
  const setExpBullet = (eIdx, bIdx, val) => setResume(r => {
    const list = [...(r.experience || [])];
    const bullets = [...(list[eIdx].bullets || [])];
    bullets[bIdx] = val;
    list[eIdx] = { ...list[eIdx], bullets };
    return { ...r, experience: list };
  });
  const addExpBullet = (eIdx) => setResume(r => {
    const list = [...(r.experience || [])];
    list[eIdx] = { ...list[eIdx], bullets: [...(list[eIdx].bullets||[]), ''] };
    return { ...r, experience: list };
  });
  const removeExpBullet = (eIdx, bIdx) => setResume(r => {
    const list = [...(r.experience || [])];
    const bullets = [...(list[eIdx].bullets || [])].filter((_,i) => i !== bIdx);
    list[eIdx] = { ...list[eIdx], bullets };
    return { ...r, experience: list };
  });

  const setProjField = (idx, field, val) => setResume(r => {
    const list = [...(r.projects || [])];
    list[idx] = { ...list[idx], [field]: val };
    return { ...r, projects: list };
  });
  const setProjBullet = (pIdx, bIdx, val) => setResume(r => {
    const list = [...(r.projects || [])];
    const bullets = [...(list[pIdx].bullets || [])];
    bullets[bIdx] = val;
    list[pIdx] = { ...list[pIdx], bullets };
    return { ...r, projects: list };
  });
  const addProjBullet = (pIdx) => setResume(r => {
    const list = [...(r.projects || [])];
    list[pIdx] = { ...list[pIdx], bullets: [...(list[pIdx].bullets||[]), ''] };
    return { ...r, projects: list };
  });

  const setSkillField = (idx, field, val) => setResume(r => {
    const list = [...(r.skills || [])];
    list[idx] = { ...list[idx], [field]: val };
    return { ...r, skills: list };
  });

  const setListItem = (field, idx, val) => setResume(r => {
    const list = [...(r[field] || [])];
    list[idx] = val;
    return { ...r, [field]: list };
  });
  const addListItem = (field) => setResume(r => ({ ...r, [field]: [...(r[field]||[]), ''] }));
  const removeListItem = (field, idx) => setResume(r => ({
    ...r, [field]: (r[field]||[]).filter((_,i) => i !== idx)
  }));

  const setEduField = (field, val) => setResume(r => ({
    ...r, education: { ...(r.education||{}), [field]: val }
  }));

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="studio-loading">
      <div className="studio-spinner" />
      <p>Rebuilding your resume with AI — this takes ~10s…</p>
    </div>
  );
  if (error) return (
    <div className="studio-error">
      <h2>⚠ Error</h2><p>{error}</p>
      <button onClick={() => navigate(-1)}>← Back</button>
    </div>
  );
  if (!resume) return null;

  return (
    <div className="studio-root">
      {/* ── Top bar ── */}
      <header className="studio-header">
        <div className="studio-header-left">
          <button className="studio-back" onClick={() => navigate(-1)}>← Report</button>
          <span className="studio-title">Resume Studio</span>
          <span className="studio-name">{resume.name}</span>
        </div>
        <div className="studio-header-center">
          {['classic','modern','minimal','professional','compact','harvard'].map(t => (
            <button key={t} className={`studio-tmpl-btn ${template===t?'active':''}`}
              onClick={() => setTemplate(t)}>
              {t === 'professional' ? 'Professional' : t === 'harvard' ? 'Harvard' : t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        <div className="studio-header-right">
          {saving && <span className="studio-save-status" style={{ fontSize: '12px', color: '#94a3b8', marginRight: '12px' }}>Saving...</span>}
          {!saving && debouncedResume && <span className="studio-save-status" style={{ fontSize: '12px', color: '#10b981', marginRight: '12px' }}>Saved</span>}
          <div className="studio-score-wrap">
            <ScoreRing score={atsScore} size={60} />
            {scoring && <span className="studio-scoring-dot" />}
            <span className="studio-score-label">ATS Score</span>
          </div>
          <button className="studio-dl-btn" onClick={handleDownload} disabled={downloading}>
            {downloading ? '⏳ DOCX…' : '⬇ Download DOCX'}
          </button>
          <button className="studio-dl-btn" onClick={handleDownloadLatex} disabled={downloading} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            {downloading ? '⏳ LaTeX…' : '⚛ Download LaTeX'}
          </button>
        </div>
      </header>

      <div className="studio-body">
        {/* ═══════════ LEFT: EDITOR ═══════════ */}
        <aside className="studio-editor">
          {/* Contact */}
          <section className="studio-section">
            <h3 className="studio-section-title">Contact</h3>
            <div className="studio-grid-2">
              {[['name','Full Name'],['jobTitle','Job Title'],['phone','Phone'],['email','Email'],
                ['location','Location'],['github','GitHub'],['linkedin','LinkedIn']].map(([f,lbl]) => (
                <label key={f} className="studio-field">
                  <span>{lbl}</span>
                  <input value={resume[f]||''} onChange={e=>set(f,e.target.value)} placeholder={lbl} />
                </label>
              ))}
            </div>
          </section>

          {/* Summary */}
          <section className="studio-section">
            <h3 className="studio-section-title">Professional Summary</h3>
            <textarea rows={4} value={resume.professionalSummary||''}
              onChange={e=>set('professionalSummary',e.target.value)}
              placeholder="3 sentences: who you are, what you bring, what you want" />
          </section>

          {/* Education */}
          <section className="studio-section">
            <h3 className="studio-section-title">Education</h3>
            <div className="studio-grid-2">
              {[['degree','Degree'],['institution','Institution'],['year','Year'],['cgpa','CGPA']].map(([f,lbl])=>(
                <label key={f} className="studio-field">
                  <span>{lbl}</span>
                  <input value={resume.education?.[f]||''} onChange={e=>setEduField(f,e.target.value)} placeholder={lbl} />
                </label>
              ))}
            </div>
          </section>

          {/* Tab switcher for big sections */}
          <div className="studio-tabs">
            {['skills','experience','projects','achievements','certifications','leadership'].map(t=>(
              <button key={t} className={`studio-tab ${activeTab===t?'active':''}`}
                onClick={()=>setActiveTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
            ))}
          </div>

          {/* Skills */}
          {activeTab==='skills' && (
            <section className="studio-section">
              {(resume.skills||[]).map((sk,i)=>(
                <div key={i} className="studio-skill-row">
                  <input className="studio-skill-label" value={sk.label||''} onChange={e=>setSkillField(i,'label',e.target.value)} placeholder="Category (e.g. Languages)" />
                  <input className="studio-skill-value" value={sk.value||''} onChange={e=>setSkillField(i,'value',e.target.value)} placeholder="Skills (comma separated)" />
                </div>
              ))}
              <button className="studio-add-btn" onClick={()=>setResume(r=>({...r,skills:[...(r.skills||[]),{label:'',value:'',priority:1}]}))}>+ Add Skill Category</button>
            </section>
          )}

          {/* Experience */}
          {activeTab==='experience' && (
            <section className="studio-section">
              {(resume.experience||[]).map((exp,i)=>(
                <div key={i} className="studio-entry-card">
                  <div className="studio-grid-2">
                    <label className="studio-field"><span>Company</span><input value={exp.company||''} onChange={e=>setExpField(i,'company',e.target.value)} /></label>
                    <label className="studio-field"><span>Role</span><input value={exp.role||''} onChange={e=>setExpField(i,'role',e.target.value)} /></label>
                    <label className="studio-field"><span>Duration</span><input value={exp.duration||''} onChange={e=>setExpField(i,'duration',e.target.value)} /></label>
                    <label className="studio-field"><span>Location</span><input value={exp.location||''} onChange={e=>setExpField(i,'location',e.target.value)} /></label>
                  </div>
                  <div className="studio-bullets">
                    {(exp.bullets||[]).map((b,bi)=>(
                      <div key={bi} className="studio-bullet-row">
                        <span className="studio-bullet-dot">•</span>
                        <textarea rows={2} value={b} onChange={e=>setExpBullet(i,bi,e.target.value)} />
                        <button className="studio-remove-btn" onClick={()=>removeExpBullet(i,bi)}>✕</button>
                      </div>
                    ))}
                    <button className="studio-add-btn small" onClick={()=>addExpBullet(i)}>+ Bullet</button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Projects */}
          {activeTab==='projects' && (
            <section className="studio-section">
              {(resume.projects||[]).map((proj,i)=>(
                <div key={i} className="studio-entry-card">
                  <div className="studio-grid-2">
                    <label className="studio-field"><span>Title</span><input value={proj.title||''} onChange={e=>setProjField(i,'title',e.target.value)} /></label>
                    <label className="studio-field"><span>Tech Stack</span><input value={proj.techStack||''} onChange={e=>setProjField(i,'techStack',e.target.value)} /></label>
                    <label className="studio-field"><span>Duration</span><input value={proj.duration||''} onChange={e=>setProjField(i,'duration',e.target.value)} /></label>
                    <label className="studio-field"><span>GitHub Link</span><input value={proj.githubLink||''} onChange={e=>setProjField(i,'githubLink',e.target.value)} /></label>
                  </div>
                  <div className="studio-bullets">
                    {(proj.bullets||[]).map((b,bi)=>(
                      <div key={bi} className="studio-bullet-row">
                        <span className="studio-bullet-dot">•</span>
                        <textarea rows={2} value={b} onChange={e=>setProjBullet(i,bi,e.target.value)} />
                      </div>
                    ))}
                    <button className="studio-add-btn small" onClick={()=>addProjBullet(i)}>+ Bullet</button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Achievements / Certifications / Leadership */}
          {['achievements','certifications','leadership'].includes(activeTab) && (
            <section className="studio-section">
              {(resume[activeTab]||[]).map((item,i)=>(
                <div key={i} className="studio-bullet-row">
                  <span className="studio-bullet-dot">•</span>
                  <textarea rows={2} value={item} onChange={e=>setListItem(activeTab,i,e.target.value)} />
                  <button className="studio-remove-btn" onClick={()=>removeListItem(activeTab,i)}>✕</button>
                </div>
              ))}
              <button className="studio-add-btn" onClick={()=>addListItem(activeTab)}>+ Add Item</button>
            </section>
          )}

          {/* Quick fixes */}
          {quickFixes.length > 0 && (
            <section className="studio-section studio-fixes">
              <h3 className="studio-section-title">⚡ Quick Fixes</h3>
              {quickFixes.map((f,i)=><div key={i} className="studio-fix-item">⚠ {f}</div>)}
            </section>
          )}
          {missing.length > 0 && (
            <section className="studio-section studio-fixes">
              <h3 className="studio-section-title">🔍 Missing Keywords</h3>
              <div className="studio-keyword-chips">
                {missing.map((k,i)=><span key={i} className="studio-chip">{k}</span>)}
              </div>
            </section>
          )}
        </aside>

        {/* ═══════════ RIGHT: LIVE PREVIEW ═══════════ */}
        <div className="studio-preview-panel">
          <div className="studio-preview-label">Live Preview — {template.charAt(0).toUpperCase()+template.slice(1)} Template</div>
          <div className="studio-preview-scroll">
            <ResumePreview resume={resume} styles={styles} template={template} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Live preview component ─────────────────────────────────────────────────────
function ResumePreview({ resume: r, styles: s, template }) {
  if (!r) return null;
  const sectionHeader = (text) => (
    <div style={{
      fontFamily: s.font, fontSize: template==='compact'?10:11, fontWeight: 700, color: s.name, textTransform: 'uppercase',
      marginTop: template==='compact'?10:14, marginBottom: 4,
      ...(template==='modern' ? { borderLeft: `3px solid ${s.accent}`, paddingLeft: 6 } :
         template==='minimal' ? { borderBottom: '1px solid #000', paddingBottom: 2 } :
         { borderBottom: `${template==='professional'?2:1.5}px solid ${s.accent}`, paddingBottom: 2 }),
    }}>{text}</div>
  );
  const bullet = (text, key) => (
    <div key={key} style={{ display:'flex', gap:6, marginBottom:2 }}>
      <span style={{ color: s.body, fontSize: 10, marginTop: 1 }}>•</span>
      <span style={{ fontFamily: s.font, fontSize: 10, color: s.body, lineHeight: 1.4 }}>{text}</span>
    </div>
  );

  return (
    <div style={{ background:'white', padding:'28px 32px', minHeight:1000, maxWidth:680, margin:'0 auto',
      boxShadow:'0 4px 32px rgba(0,0,0,0.18)', fontFamily: s.font }}>
      {/* Name */}
      <div style={{ textAlign:'center', marginBottom:2 }}>
        <div style={{ fontSize: template==='classic'?28:template==='modern'?26:24, fontWeight:700, color: s.name,
          letterSpacing:1.5, textTransform:'uppercase' }}>{r.name}</div>
        {r.jobTitle && <div style={{ fontSize:11, color: s.accent, marginTop:2 }}>{r.jobTitle}</div>}
        <div style={{ fontSize:9, color: s.gray, marginTop:4 }}>
          {[r.phone, r.email, r.location, r.github, r.linkedin].filter(Boolean).join('  •  ')}
        </div>
      </div>

      {/* Education */}
      {r.education && (
        <div>
          {sectionHeader('Education')}
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontWeight:700, fontSize:10, color: s.body }}>{r.education.institution}</span>
            <span style={{ fontSize:10, color: s.gray }}>{r.education.year}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:1 }}>
            <span style={{ fontStyle:'italic', fontSize:10, color: s.body }}>{r.education.degree}</span>
            {r.education.cgpa && <span style={{ fontSize:10, color: s.gray }}>CGPA: {r.education.cgpa}</span>}
          </div>
        </div>
      )}

      {/* Skills */}
      {r.skills?.length > 0 && (
        <div>
          {sectionHeader('Technical Skills')}
          {r.skills.map((sk,i)=>(
            <div key={i} style={{ fontSize:10, marginBottom:2, color: s.body }}>
              <span style={{ fontWeight:700, color: s.accent }}>{sk.label}: </span>{sk.value}
            </div>
          ))}
        </div>
      )}

      {/* Experience */}
      {r.experience?.length > 0 && (
        <div>
          {sectionHeader('Experience')}
          {r.experience.map((exp,i)=>(
            <div key={i} style={{ marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, fontSize:10, color: s.body }}>{exp.role}</span>
                <span style={{ fontSize:10, color: s.gray }}>{exp.company}{exp.duration?` | ${exp.duration}`:''}</span>
              </div>
              {exp.location && <div style={{ fontStyle:'italic', fontSize:9, color: s.gray }}>{exp.location}</div>}
              <div style={{ marginTop:3 }}>{(exp.bullets||[]).map((b,bi)=>bullet(b,bi))}</div>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {r.projects?.length > 0 && (
        <div>
          {sectionHeader('Projects')}
          {r.projects.map((proj,i)=>(
            <div key={i} style={{ marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, fontSize:10, color: s.body }}>{proj.title}</span>
                <span style={{ fontSize:10, color: s.gray }}>{proj.techStack}{proj.duration?` | ${proj.duration}`:''}</span>
              </div>
              {proj.githubLink && <div style={{ fontSize:9, color: s.accent }}>{proj.githubLink}</div>}
              <div style={{ marginTop:3 }}>{(proj.bullets||[]).map((b,bi)=>bullet(b,bi))}</div>
            </div>
          ))}
        </div>
      )}

      {/* Achievements */}
      {r.achievements?.length > 0 && (
        <div>
          {sectionHeader('Achievements')}
          {r.achievements.map((a,i)=>bullet(a,i))}
        </div>
      )}

      {/* Certifications */}
      {r.certifications?.length > 0 && (
        <div>
          {sectionHeader('Certifications')}
          {r.certifications.map((c,i)=>bullet(c,i))}
        </div>
      )}

      {/* Leadership */}
      {r.leadership?.length > 0 && (
        <div>
          {sectionHeader('Leadership & Extracurriculars')}
          {r.leadership.map((l,i)=>bullet(l,i))}
        </div>
      )}

      {/* Summary */}
      {r.professionalSummary && (
        <div>
          {sectionHeader('Professional Summary')}
          <div style={{ fontSize:10, color: s.body, lineHeight:1.5 }}>{r.professionalSummary}</div>
        </div>
      )}
    </div>
  );
}
