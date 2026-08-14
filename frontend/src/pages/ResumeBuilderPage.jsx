import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Layout, Palette, ShieldCheck, Download,
  Loader2, Check, AlertCircle, Briefcase, List, TrendingUp,
  Edit3, Eye, Sparkles, Undo2, Redo2
} from 'lucide-react';
import { fetchResume, updateResume } from '../utils/resumeApi';
import { DEFAULT_SECTION_ORDER, DEFAULT_SETTINGS } from '../utils/resumeDefaults';

import PersonalInfoEditor    from '../components/resume/editor/PersonalInfoEditor';
import SummaryEditor         from '../components/resume/editor/SummaryEditor';
import ExperienceEditor      from '../components/resume/editor/ExperienceEditor';
import EducationEditor       from '../components/resume/editor/EducationEditor';
import ProjectsEditor        from '../components/resume/editor/ProjectsEditor';
import SkillsEditor          from '../components/resume/editor/SkillsEditor';
import SectionManager        from '../components/resume/editor/SectionManager';
import CustomSectionEditor   from '../components/resume/editor/CustomSectionEditor';

import TemplateGallery       from '../components/resume/panels/TemplateGallery';
import CustomizationPanel    from '../components/resume/panels/CustomizationPanel';
import ATSAnalysisPanel      from '../components/resume/panels/ATSAnalysisPanel';
import CompletenessPanel     from '../components/resume/panels/CompletenessPanel';
import JobMatchPanel         from '../components/resume/panels/JobMatchPanel';

import ResumeRenderer        from '../components/resume/shared/ResumeRenderer';

const TABS = [
  { id: 'content',     label: 'Content',      icon: Edit3 },
  { id: 'sections',    label: 'Sections',     icon: List },
  { id: 'templates',   label: 'Templates',    icon: Layout },
  { id: 'style',       label: 'Styling',      icon: Palette },
  { id: 'completeness',label: 'Completeness', icon: TrendingUp },
  { id: 'ats',         label: 'ATS Score',    icon: ShieldCheck },
  { id: 'jobmatch',    label: 'Job Match',    icon: Briefcase },
];

const DRAFT_KEY = (id) => `mockmate_resume_draft_${id}`;

export default function ResumeBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved' | 'failed'
  const [isDirty,    setIsDirty]    = useState(false);
  const [activeTab,  setActiveTab]  = useState('content');
  const [mobileView, setMobileView] = useState('edit'); // 'edit' | 'preview'
  const [isMobile,   setIsMobile]   = useState(window.innerWidth < 768);

  const [title,      setTitle]      = useState('My Resume');
  const [templateId, setTemplateId] = useState('modern');
  const [resumeData, setResumeData] = useState({ personalInfo: {}, summary: '', experience: [], education: [], projects: [], skills: [] });
  const [settings,   setSettings]   = useState(DEFAULT_SETTINGS);
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_SECTION_ORDER);
  const [hiddenSections, setHiddenSections] = useState([]);
  const [customSections, setCustomSections] = useState([]);

  // Undo / Redo history stacks
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const debounceRef = useRef(null);
  const isDirtyRef  = useRef(false);

  // Helper to snapshot current resume state
  const getCurrentSnapshot = useCallback(() => ({
    title,
    templateId,
    resumeData,
    settings,
    sectionOrder,
    hiddenSections,
    customSections,
  }), [title, templateId, resumeData, settings, sectionOrder, hiddenSections, customSections]);

  // Push state to undo stack before making changes
  const recordHistory = useCallback(() => {
    const current = getCurrentSnapshot();
    const last = pastRef.current[pastRef.current.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(current)) return;
    pastRef.current.push(current);
    if (pastRef.current.length > 40) pastRef.current.shift();
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [getCurrentSnapshot]);

  // Undo Action
  const handleUndo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const current = getCurrentSnapshot();
    const previous = pastRef.current.pop();
    futureRef.current.push(current);

    setTitle(previous.title);
    setTemplateId(previous.templateId);
    setResumeData(previous.resumeData);
    setSettings(previous.settings);
    setSectionOrder(previous.sectionOrder);
    setHiddenSections(previous.hiddenSections);
    setCustomSections(previous.customSections);

    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);

    markDirty();
    scheduleAutosave(previous);
  }, [getCurrentSnapshot]);

  // Redo Action
  const handleRedo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const current = getCurrentSnapshot();
    const next = futureRef.current.pop();
    pastRef.current.push(current);

    setTitle(next.title);
    setTemplateId(next.templateId);
    setResumeData(next.resumeData);
    setSettings(next.settings);
    setSectionOrder(next.sectionOrder);
    setHiddenSections(next.hiddenSections);
    setCustomSections(next.customSections);

    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);

    markDirty();
    scheduleAutosave(next);
  }, [getCurrentSnapshot]);

  // Keyboard Shortcuts (Ctrl+Z / Cmd+Z for Undo, Ctrl+Y / Cmd+Shift+Z for Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            e.preventDefault();
            handleRedo();
          } else {
            // Check if user is typing in a text field where native undo might be preferred, or trigger app-level undo
            e.preventDefault();
            handleUndo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // ── Responsive ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Unsaved changes protection ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Load resume ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (id) loadResume();
  }, [id]);

  const loadResume = async () => {
    setLoading(true);
    try {
      const draft = getDraft();
      const data = await fetchResume(id);

      let useData = data;
      if (draft && draft.savedAt && data?.updatedAt) {
        const draftTime = new Date(draft.savedAt).getTime();
        const serverTime = new Date(data.updatedAt).getTime();
        if (draftTime > serverTime) {
          const useDraft = window.confirm('A newer unsaved draft was found. Recover unsaved changes?');
          if (useDraft) useData = draft;
        }
      }

      if (useData) {
        setTitle(useData.title || 'My Resume');
        setTemplateId(useData.templateId || 'modern');
        setResumeData(useData.resumeData || {});
        setSettings({ ...DEFAULT_SETTINGS, ...(useData.settings || {}) });
        setSectionOrder(useData.sectionOrder || useData.resumeData?.sectionOrder || DEFAULT_SECTION_ORDER);
        setHiddenSections(useData.hiddenSections || useData.resumeData?.hiddenSections || []);
        setCustomSections(useData.customSections || useData.resumeData?.customSections || []);
      }
    } catch (err) {
      console.error('Failed to fetch resume:', err);
    } finally {
      setLoading(false);
      setIsDirty(false);
      isDirtyRef.current = false;
      pastRef.current = [];
      futureRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
    }
  };

  // ── Draft helpers ───────────────────────────────────────────────────────────
  const saveDraft = useCallback((payload) => {
    try {
      localStorage.setItem(DRAFT_KEY(id), JSON.stringify({ ...payload, savedAt: new Date().toISOString() }));
    } catch (_) {}
  }, [id]);

  const getDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY(id));
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  };

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY(id)); } catch (_) {}
  };

  // ── Dirty-state tracker ─────────────────────────────────────────────────────
  const markDirty = () => {
    setIsDirty(true);
    isDirtyRef.current = true;
    setSaveStatus('unsaved');
  };

  // ── Data change helpers ─────────────────────────────────────────────────────
  const handleResumeDataChange = (newData) => {
    recordHistory();
    setResumeData(newData);
    markDirty();
    scheduleAutosave({ resumeData: newData });
  };

  const handleTemplateChange = (newTemplateId) => {
    recordHistory();
    setTemplateId(newTemplateId);
    markDirty();
    scheduleAutosave({ templateId: newTemplateId });
  };

  const handleSettingsChange = (newSettings) => {
    recordHistory();
    setSettings(newSettings);
    markDirty();
    scheduleAutosave({ settings: newSettings });
  };

  const handleSectionManagerChange = ({ order, hidden }) => {
    recordHistory();
    setSectionOrder(order);
    setHiddenSections(hidden);
    markDirty();
    scheduleAutosave({ sectionOrder: order, hiddenSections: hidden });
  };

  const handleTitleChange = (newTitle) => {
    recordHistory();
    setTitle(newTitle);
    markDirty();
    scheduleAutosave({ title: newTitle });
  };

  // ── Autosave ────────────────────────────────────────────────────────────────
  const scheduleAutosave = (overridePayload = {}) => {
    const payload = {
      title,
      templateId,
      resumeData,
      settings,
      sectionOrder,
      hiddenSections,
      customSections,
      ...overridePayload,
    };

    saveDraft(payload);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSave(payload);
    }, 2000);
  };

  const doSave = async (overridePayload = null) => {
    if (!id) return;
    setSaving(true);
    setSaveStatus('saving');

    const payload = overridePayload || {
      title,
      templateId,
      resumeData,
      settings,
      sectionOrder,
      hiddenSections,
      customSections,
    };

    try {
      await updateResume(id, payload);
      setSaveStatus('saved');
      setIsDirty(false);
      isDirtyRef.current = false;
      clearDraft();
    } catch (err) {
      console.error('Autosave failed:', err);
      setSaveStatus('failed');
    } finally {
      setSaving(false);
    }
  };

  const handleManualSave = () => doSave();

  const handleDownloadPdf = () => {
    document.body.classList.add('printing-resume');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-resume');
    }, 100);
  };

  // ── Save status UI ──────────────────────────────────────────────────────────
  const SaveIndicator = () => {
    if (saveStatus === 'saving') return (
      <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" /> Saving...
      </span>
    );
    if (saveStatus === 'saved') return (
      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
        <Check className="w-3.5 h-3.5" /> Saved
      </span>
    );
    if (saveStatus === 'unsaved') return (
      <span className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
        <AlertCircle className="w-3.5 h-3.5" /> Unsaved changes
      </span>
    );
    if (saveStatus === 'failed') return (
      <span className="text-xs font-semibold text-red-700 flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
        <AlertCircle className="w-3.5 h-3.5" /> Save failed — click Save
      </span>
    );
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] text-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  // ── Left pane content ───────────────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'content':
        return (
          <div className="space-y-5">
            <PersonalInfoEditor
              data={resumeData.personalInfo || {}}
              onChange={(val) => handleResumeDataChange({ ...resumeData, personalInfo: val })}
            />
            <SummaryEditor
              summary={resumeData.summary || ''}
              personalInfo={resumeData.personalInfo}
              onChange={(val) => handleResumeDataChange({ ...resumeData, summary: val })}
            />
            <ExperienceEditor
              items={resumeData.experience || []}
              onChange={(val) => handleResumeDataChange({ ...resumeData, experience: val })}
            />
            <EducationEditor
              items={resumeData.education || []}
              onChange={(val) => handleResumeDataChange({ ...resumeData, education: val })}
            />
            <ProjectsEditor
              items={resumeData.projects || []}
              onChange={(val) => handleResumeDataChange({ ...resumeData, projects: val })}
            />
            <SkillsEditor
              items={resumeData.skills || []}
              onChange={(val) => handleResumeDataChange({ ...resumeData, skills: val })}
            />
            {customSections.length > 0 && (
              <CustomSectionEditor
                customSections={customSections}
                onChange={(cs) => { recordHistory(); setCustomSections(cs); markDirty(); scheduleAutosave({ customSections: cs }); }}
              />
            )}
          </div>
        );

      case 'sections':
        return (
          <SectionManager
            sectionOrder={sectionOrder}
            hiddenSections={hiddenSections}
            customSections={customSections}
            onChange={handleSectionManagerChange}
          />
        );

      case 'templates':
        return <TemplateGallery selectedId={templateId} onSelect={handleTemplateChange} />;

      case 'style':
        return <CustomizationPanel settings={settings} onChange={handleSettingsChange} />;

      case 'completeness':
        return <CompletenessPanel resumeData={{ ...resumeData, personalInfo: resumeData.personalInfo || {} }} />;

      case 'ats':
        return <ATSAnalysisPanel resumeData={resumeData} />;

      case 'jobmatch':
        return <JobMatchPanel resumeData={resumeData} />;

      default:
        return null;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 flex flex-col font-sans print:bg-white">
      {/* Top Navbar — Landing Page Styled Header */}
      <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between shrink-0 print:hidden z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              if (isDirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
              navigate('/resume-builder');
            }}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition shrink-0"
            title="Back to Resumes"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl">📄</span>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="bg-transparent font-extrabold text-sm text-slate-900 focus:outline-none border-b border-transparent focus:border-purple-500 px-1 py-0.5 min-w-0 max-w-[180px] md:max-w-xs truncate"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* Undo & Redo Controls */}
          <div className="flex items-center bg-slate-100/90 rounded-full p-1 border border-slate-200/80 shadow-xs">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-white rounded-full transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-white rounded-full transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600"
              title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <SaveIndicator />

          {/* Mobile view toggle */}
          {isMobile && (
            <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200">
              <button
                onClick={() => setMobileView('edit')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${mobileView === 'edit' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600'}`}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setMobileView('preview')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${mobileView === 'preview' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600'}`}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={handleManualSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full text-xs font-semibold shadow-sm transition"
          >
            <Save className="w-4 h-4 text-purple-600" /> Save
          </button>

          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-4 md:px-5 py-2 bg-[#6B46C1] hover:bg-[#5a3aa6] text-white rounded-full text-xs font-semibold shadow-md shadow-purple-900/15 transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Export PDF</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden print:block">

        {/* LEFT PANE — editor controls */}
        {(!isMobile || mobileView === 'edit') && (
          <div className={`${isMobile ? 'w-full' : 'w-1/2'} flex flex-col border-r border-slate-200/80 bg-white print:hidden shadow-sm`}>
            {/* Tabs */}
            <div className="overflow-x-auto border-b border-slate-200/80 bg-slate-50/50 shrink-0">
              <div className="flex items-center px-3 gap-1">
                {TABS.map(({ id: tabId, label, icon: Icon }) => (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    className={`px-3.5 py-3 text-xs font-bold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${
                      activeTab === tabId
                        ? 'border-[#6B46C1] text-[#6B46C1] bg-purple-50/60'
                        : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content scrollable */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#fafafa]">
              {renderTabContent()}
            </div>
          </div>
        )}

        {/* RIGHT PANE — live preview */}
        {(!isMobile || mobileView === 'preview') && (
          <div className={`${isMobile ? 'w-full' : 'w-1/2'} bg-slate-100/70 overflow-y-auto p-6 md:p-8 flex justify-center items-start print:p-0 print:block border-l border-slate-200/50`}>
            <div id="resume-preview-target" className="w-full max-w-[794px] bg-white shadow-xl shadow-purple-950/5 rounded-xl border border-slate-200/80 overflow-hidden print:rounded-none print:shadow-none print:max-w-full">
              <ResumeRenderer
                resume={resumeData}
                settings={settings}
                templateId={templateId}
                sectionOrder={sectionOrder}
                hiddenSections={hiddenSections}
                customSections={customSections}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
