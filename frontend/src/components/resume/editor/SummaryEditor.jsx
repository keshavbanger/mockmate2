import React, { useState } from 'react';
import { Sparkles, FileText } from 'lucide-react';
import { generateSummary } from '../../../utils/resumeApi';
import AISuggestionBox from '../shared/AISuggestionBox';

export default function SummaryEditor({ summary = '', personalInfo = {}, onChange }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiError, setAiError] = useState(false);

  const handleGenerate = async () => {
    setAiLoading(true);
    setAiSuggestion(null);
    setAiError(false);
    try {
      const res = await generateSummary({
        jobTitle: personalInfo.professionalTitle || '',
        skills: '',
        experience: '',
      });
      setAiSuggestion(res.summary || res.result || '');
    } catch (err) {
      console.error('AI summary failed:', err);
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleUseSuggestion = (text) => {
    onChange(text);
    setAiSuggestion(null);
    setAiError(false);
  };

  const handleCancel = () => {
    setAiSuggestion(null);
    setAiError(false);
  };

  const wordCount = summary.trim() ? summary.trim().split(/\s+/).length : 0;
  const wordColor = wordCount < 30 ? 'text-amber-600' : wordCount > 100 ? 'text-red-600' : 'text-emerald-600';

  return (
    <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
          <FileText className="w-4 h-4" /> Professional Summary
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold ${wordColor}`}>{wordCount} words</span>
          <button
            onClick={handleGenerate}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" /> Generate with AI
          </button>
        </div>
      </div>

      <textarea
        rows={4}
        className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition resize-none leading-relaxed"
        placeholder="Write a 3–4 sentence professional summary highlighting your experience, skills, and key achievements..."
        value={summary}
        onChange={(e) => onChange(e.target.value)}
      />

      <p className="text-[11px] text-slate-500 font-medium">Aim for 40–80 words. Be specific — avoid generic phrases like "team player" or "hardworking".</p>

      <AISuggestionBox
        original={summary}
        suggestion={aiSuggestion}
        loading={aiLoading}
        error={aiError}
        onUse={handleUseSuggestion}
        onRegenerate={handleGenerate}
        onCancel={handleCancel}
      />
    </div>
  );
}
