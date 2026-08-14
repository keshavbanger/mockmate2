import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FileText, Trash2, Copy, Edit3, ArrowLeft, Loader2, Upload, Sparkles, CheckCircle2, Download, Wand2, ShieldCheck, Zap } from 'lucide-react';
import { fetchResumes, createResume, deleteResume, duplicateResume, importResume } from '../utils/resumeApi';
import { SAMPLE_RESUME_DATA } from '../utils/resumeDefaults';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function ResumeDashboardPage() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadResumes();
  }, []);

  const loadResumes = async () => {
    setLoading(true);
    try {
      const data = await fetchResumes();
      setResumes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load resumes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async (withSample = false) => {
    setCreating(true);
    try {
      const newResume = await createResume({
        title: withSample ? 'Software Engineer Resume' : 'My Resume',
        templateId: 'modern',
        resumeData: withSample ? SAMPLE_RESUME_DATA : {},
      });
      if (newResume?.id) {
        navigate(`/resume-builder/${newResume.id}/edit`);
      }
    } catch (err) {
      console.error('Failed to create resume:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resume?')) return;
    try {
      await deleteResume(id);
      setResumes(resumes.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete resume:', err);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const copy = await duplicateResume(id);
      if (copy?.id) {
        setResumes([copy, ...resumes]);
      }
    } catch (err) {
      console.error('Failed to duplicate resume:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await importResume(file);
      if (res?.parsed) {
        const parsed = res.parsed;
        const newResume = await createResume({
          title: `Imported - ${file.name.replace(/\.[^/.]+$/, '')}`,
          templateId: 'modern',
          resumeData: {
            personalInfo: {
              fullName: parsed.name || '',
              professionalTitle: parsed.professionalTitle || parsed.jobTitles?.[0] || '',
              email: parsed.email || '',
              phone: parsed.phone || '',
              location: parsed.location || '',
              linkedin: parsed.linkedin || '',
              github: parsed.github || '',
              portfolio: parsed.portfolio || '',
            },
            summary: parsed.summary || '',
            experience: (parsed.experience || []).map((e) => ({
              jobTitle: e.jobTitle || '',
              company: e.company || '',
              location: e.location || '',
              startDate: e.startDate || '',
              endDate: e.endDate || '',
              isCurrent: !!e.isCurrent,
              description: '',
              bullets: e.bullets?.length ? e.bullets : [''],
            })),
            education: (parsed.educationDetails || []).map((ed) => ({
              institution: ed.institution || '',
              degree: ed.degree || '',
              fieldOfStudy: ed.fieldOfStudy || '',
              location: ed.location || '',
              startDate: ed.startDate || '',
              endDate: ed.endDate || '',
              gpa: ed.gpa || '',
              relevantCoursework: '',
            })),
            projects: (parsed.projects || []).map((p) => ({
              name: p.name || '',
              description: p.description || '',
              technologies: p.technologies || '',
              projectUrl: '',
              githubUrl: '',
              startDate: '',
              endDate: '',
              bullets: p.bullets?.length ? p.bullets : [''],
            })),
            skills: (parsed.skillDetails?.length ? parsed.skillDetails : (parsed.skills || []).map((s) => ({ skill: s, category: '' })))
              .map((s) => ({ skill: s.skill || '', category: s.category || 'Technical', proficiency: '' })),
            certifications: (parsed.certifications || []).map((c) => ({
              name: c.name || '',
              issuingOrganization: c.issuingOrganization || '',
              issueDate: c.issueDate || '',
              expiryDate: '',
              credentialId: '',
              credentialUrl: '',
            })),
            achievements: (parsed.achievements || []).map((a) => ({
              title: a.title || '',
              description: a.description || '',
              date: a.date || '',
            })),
          },
        });
        if (newResume?.id) {
          navigate(`/resume-builder/${newResume.id}/edit`);
        }
      }
    } catch (err) {
      console.error('Failed to import resume:', err);
      alert(err?.message || 'Failed to parse resume file.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-[Outfit,Inter,sans-serif] text-slate-900 overflow-x-hidden flex flex-col">
      <Navbar />

      {/* ── Background Blobs ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -left-60 w-[400px] h-[400px] bg-indigo-200/15 rounded-full blur-[100px]" />
      </div>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-16 space-y-12">
        {/* ── Hero Header Section ── */}
        <div className="text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 bg-purple-100/70 text-[#6B46C1] px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest mb-6 border border-purple-200 shadow-sm"
          >
            ✨ AI Resume Builder & Studio
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl sm:text-5xl font-black text-[#111] tracking-tight leading-[1.15] mb-4"
          >
            Build & Customize Your<br />
            <span className="bg-gradient-to-r from-[#6B46C1] via-[#8B5CF6] to-[#A855F7] bg-clip-text text-transparent">
              ATS-Friendly Resume
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-xl mx-auto mb-8 font-medium"
          >
            Create high-impact, professional resumes tailored for hiring managers. Choose from 10+ recruiter-approved templates, generate bullet points with AI, and land more interviews.
          </motion.p>

          {/* Action Row Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <button
              onClick={() => handleCreateNew(true)}
              disabled={creating}
              className="px-6 py-3.5 bg-[#6B46C1] hover:bg-[#5b3da6] text-white rounded-full text-xs font-bold uppercase tracking-wider shadow-lg shadow-purple-900/20 hover:scale-[1.02] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Start with Sample Data
            </button>

            <button
              onClick={() => handleCreateNew(false)}
              disabled={creating}
              className="px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm hover:border-purple-300 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 text-purple-600" />}
              Create Blank Resume
            </button>

            <label className="px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm hover:border-purple-300 transition-all flex items-center gap-2 cursor-pointer">
              {importing ? <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> : <Upload className="w-4 h-4 text-purple-600" />}
              Import PDF / DOCX
              <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} className="hidden" />
            </label>
          </motion.div>
        </div>

        {/* ── Saved Resumes Section ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-xl shadow-purple-900/5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-purple-100 text-[#6B46C1] font-black flex items-center justify-center text-sm shadow-sm">
                📄
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Your Resumes</h2>
                <p className="text-xs text-slate-400 font-medium">Manage and edit your saved resume versions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-purple-50 text-[#6B46C1] text-xs font-bold px-3 py-1 rounded-full border border-purple-100">
                {resumes.length} {resumes.length === 1 ? 'Resume' : 'Resumes'} Saved
              </span>
            </div>
          </div>

          {/* Grid or Empty State */}
          {loading ? (
            <div className="flex justify-center items-center py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : resumes.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/50 rounded-2xl border-2 border-dashed border-purple-200 max-w-xl mx-auto space-y-4 p-8">
              <div className="w-14 h-14 bg-purple-100 text-[#6B46C1] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">No resumes created yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed font-medium">
                  Start with pre-filled sample data, start blank, or import your existing PDF/DOCX resume.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => handleCreateNew(true)}
                  className="px-5 py-2.5 bg-[#6B46C1] hover:bg-[#5b3da6] text-white rounded-full text-xs font-bold shadow-md shadow-purple-900/15 transition cursor-pointer"
                >
                  Start with Sample Data
                </button>
                <button
                  onClick={() => handleCreateNew(false)}
                  className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  Start Blank
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resumes.map((resume) => (
                <div
                  key={resume.id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-xl hover:border-purple-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group shadow-sm"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-purple-50 text-[#6B46C1] rounded-xl border border-purple-100">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase bg-purple-100/70 text-purple-700 px-2.5 py-1 rounded-full border border-purple-200">
                        {resume.templateId || 'Modern'} Template
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-[#6B46C1] transition line-clamp-1">
                      {resume.title || 'Untitled Resume'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      Updated {new Date(resume.updatedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6">
                    <button
                      onClick={() => navigate(`/resume-builder/${resume.id}/edit`)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#6B46C1] hover:bg-[#5b3da6] text-white rounded-full text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Resume
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDuplicate(resume.id)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(resume.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── How it Works Section ── */}
        <section className="pt-16 pb-12">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111] tracking-tight mb-3">
              How it <span className="bg-gradient-to-r from-[#6B46C1] via-[#8B5CF6] to-[#A855F7] bg-clip-text text-transparent">Works</span>
            </h2>
            <p className="text-slate-500 text-base leading-relaxed font-medium">
              Build a polished, recruiter-ready resume in 3 effortless steps with real-time AI assistance.
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
              <h3 className="text-2xl font-bold text-[#111] tracking-tight">
                Select Template or Import Resume
              </h3>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-md font-medium">
                Start from scratch, pick one of our 10+ battle-tested ATS templates, or upload your existing PDF/DOCX resume to automatically extract contact info, work history, and skills.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-purple-50 text-[#6B46C1] font-bold text-xs px-4 py-2 rounded-full border border-purple-100 shadow-sm">
                  10+ ATS Templates Supported
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
                    <h4 className="text-xs font-bold text-slate-900">Choose Template</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Select a design layout tailored for your target role.</p>
                  </div>
                  <span className="text-[10px] bg-purple-100 text-[#6B46C1] font-bold px-2 py-0.5 rounded-full">Pro Choice</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {['Modern', 'Minimal', 'Executive'].map((tpl, i) => (
                    <div key={tpl} className={`p-3 rounded-xl border text-center transition-all ${i === 0 ? 'border-2 border-[#6B46C1] bg-purple-50/50 shadow-sm' : 'border-slate-200 bg-slate-50/50'}`}>
                      <div className="h-10 bg-slate-200/60 rounded mb-2 flex items-center justify-center text-[10px] text-slate-400">📄</div>
                      <p className="text-[10px] font-bold text-slate-800">{tpl}</p>
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
              className="order-1 bg-gradient-to-br from-purple-50/60 to-white p-6 rounded-3xl border border-purple-100 shadow-xl shadow-purple-900/5"
            >
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-[#6B46C1]" />
                    <h4 className="text-xs font-bold text-slate-900">AI Bullet Enhancer</h4>
                  </div>
                  <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Active</span>
                </div>
                <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-1.5">
                  <p className="text-[10px] font-semibold text-slate-500">Original Bullet:</p>
                  <p className="text-[11px] text-slate-700 font-medium">"Managed a team of developers to build web apps."</p>
                  <div className="pt-1.5 border-t border-purple-200/80">
                    <p className="text-[10px] font-bold text-[#6B46C1]">✨ AI Action-Oriented Bullet:</p>
                    <p className="text-[11px] font-bold text-slate-900 mt-0.5">"Spearheaded a cross-functional team of 6 engineers, delivering 4 production web applications that boosted user engagement by 35%."</p>
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
              <h3 className="text-2xl font-bold text-[#111] tracking-tight">
                Enhance Bullets & Optimize Content
              </h3>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-md font-medium">
                Use built-in AI tools to rewrite experience bullet points, generate professional summaries, add custom technical sections, and tailor content to high-scoring action verbs.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-purple-50 text-[#6B46C1] font-bold text-xs px-4 py-2 rounded-full border border-purple-100 shadow-sm">
                  Powered by Groq LLM AI
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
              <h3 className="text-2xl font-bold text-[#111] tracking-tight">
                Download PDF & Scan ATS Score
              </h3>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-md font-medium">
                Export high-resolution PDFs directly from your browser. Seamlessly cross-check your finished resume with our ATS Resume Analyzer to get recruiter feedback.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-purple-50 text-[#6B46C1] font-bold text-xs px-4 py-2 rounded-full border border-purple-100 shadow-sm">
                  Instant PDF Export & ATS Ready
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
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-[#6B46C1]" />
                    <h4 className="text-xs font-bold text-slate-900">Export & ATS Score</h4>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">100% Ready</span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">ATS Parsing Verification</p>
                      <p className="text-[10px] text-emerald-700 font-medium">Single-column layout passes all modern ATS parsers</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <span className="px-4 py-2 bg-[#6B46C1] text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
