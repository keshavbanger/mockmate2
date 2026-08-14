import React from 'react';
import { Sparkles, Check, X, RefreshCw, Loader2 } from 'lucide-react';

/**
 * AI Suggestion Box — never auto-applies. Shows original vs suggestion.
 * User must explicitly click [Use], [Regenerate], or [Cancel].
 */
export default function AISuggestionBox({ original, suggestion, loading, error, onUse, onRegenerate, onCancel }) {
  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-xl p-3.5">
        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
        Generating AI suggestion...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-2">
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <X className="w-4 h-4" /> AI suggestion unavailable. Please try again.
        </p>
        <div className="flex gap-2">
          <button onClick={onRegenerate} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg transition font-semibold">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
          <button onClick={onCancel} className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg transition">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!suggestion) return null;

  return (
    <div className="mt-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700">
        <Sparkles className="w-3.5 h-3.5 text-purple-600" /> AI Generated Recommendation
      </div>

      {original && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Current Text</p>
          <p className="text-xs text-slate-600 italic bg-white/80 rounded-xl p-2.5 leading-relaxed border border-slate-200/60">
            {original}
          </p>
        </div>
      )}

      <div>
        <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1">AI Suggestion</p>
        <p className="text-xs text-slate-900 font-medium bg-white rounded-xl p-3 leading-relaxed border border-purple-200/80 shadow-xs">
          {suggestion}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap pt-1">
        <button
          onClick={() => onUse(suggestion)}
          className="flex items-center gap-1.5 text-xs bg-[#6B46C1] hover:bg-[#5a3aa6] text-white px-3.5 py-1.5 rounded-full font-semibold transition shadow-sm"
        >
          <Check className="w-3.5 h-3.5" /> Apply Suggestion
        </button>
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1.5 text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-full font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-purple-600" /> Regenerate
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-full transition"
        >
          <X className="w-3.5 h-3.5" /> Dismiss
        </button>
      </div>
    </div>
  );
}
