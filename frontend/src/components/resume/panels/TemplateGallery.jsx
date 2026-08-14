import React, { useState } from 'react';
import { CheckCircle2, Search, ShieldCheck, Layout } from 'lucide-react';
import { getAllTemplates } from '../templateRegistry';

const CATEGORIES = ['All', 'ATS Friendly', 'Modern', 'Professional', 'Minimal', 'Creative', 'Academic', 'Executive', 'Tech'];

function TemplateThumbnail({ template, isSelected }) {
  const accent = isSelected ? '#6B46C1' : template.accentColor || '#6B46C1';

  const styles = {
    modern: (
      <div className="w-full h-full bg-white p-2 flex flex-col gap-1">
        <div className="h-4 rounded" style={{ backgroundColor: accent }} />
        <div className="h-1.5 bg-slate-200 rounded w-3/4" />
        <div className="h-1 bg-slate-100 rounded w-1/2 mt-0.5" />
        <div className="h-px bg-slate-300 my-1" />
        <div className="space-y-0.5">
          <div className="h-1 bg-slate-200 rounded" />
          <div className="h-1 bg-slate-200 rounded w-4/5" />
          <div className="h-1 bg-slate-100 rounded w-2/3" />
        </div>
      </div>
    ),
    classic: (
      <div className="w-full h-full bg-white p-2 flex flex-col gap-1">
        <div className="text-center space-y-0.5">
          <div className="h-2 bg-slate-800 rounded mx-auto w-1/2" />
          <div className="h-1 bg-slate-400 rounded mx-auto w-1/3" />
          <div className="h-px bg-slate-300 mt-1" />
        </div>
        <div className="space-y-0.5 mt-1">
          <div className="h-1 bg-slate-300 rounded w-1/4" />
          <div className="h-1 bg-slate-200 rounded" />
          <div className="h-1 bg-slate-200 rounded w-4/5" />
        </div>
      </div>
    ),
    minimal: (
      <div className="w-full h-full bg-white p-2 flex flex-col gap-1">
        <div className="h-2 bg-slate-900 rounded w-2/3" />
        <div className="h-1 bg-slate-400 rounded w-1/2" />
        <div className="mt-2 space-y-1">
          <div className="h-1 bg-slate-200 rounded" />
          <div className="h-1 bg-slate-100 rounded w-4/5" />
        </div>
      </div>
    ),
    professional: (
      <div className="w-full h-full flex">
        <div className="w-1/3 h-full p-1.5" style={{ backgroundColor: accent }}>
          <div className="w-5 h-5 rounded-full bg-white/30 mx-auto mb-1" />
          <div className="space-y-0.5">
            <div className="h-1 bg-white/40 rounded" />
            <div className="h-1 bg-white/40 rounded w-2/3" />
          </div>
        </div>
        <div className="flex-1 p-1.5 bg-white space-y-0.5">
          <div className="h-1 bg-slate-300 rounded w-2/3" />
          <div className="h-1 bg-slate-200 rounded" />
          <div className="h-1 bg-slate-100 rounded w-4/5" />
        </div>
      </div>
    ),
    tech: (
      <div className="w-full h-full bg-slate-900 p-2 flex flex-col gap-1">
        <div className="h-1.5 rounded w-3/4" style={{ backgroundColor: accent }} />
        <div className="h-1 bg-slate-700 rounded w-1/2" />
        <div className="flex gap-1 mt-1 flex-wrap">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-2 px-1 rounded text-[4px] flex items-center" style={{ backgroundColor: `${accent}30`, border: `0.5px solid ${accent}60` }}>
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: accent }} />
            </div>
          ))}
        </div>
        <div className="space-y-0.5 mt-1">
          <div className="h-1 bg-slate-700 rounded" />
          <div className="h-1 bg-slate-800 rounded w-4/5" />
        </div>
      </div>
    ),
    elegant: (
      <div className="w-full h-full bg-[#FAF9F6] p-2 flex flex-col gap-1 items-center">
        <div className="h-2 rounded w-2/3" style={{ backgroundColor: accent }} />
        <div className="h-1 bg-stone-400 rounded w-1/2" />
        <div className="h-px w-4/5 mt-0.5" style={{ backgroundColor: accent }} />
        <div className="space-y-0.5 mt-1 w-full text-center">
          <div className="h-1 bg-stone-300 rounded mx-auto w-4/5" />
          <div className="h-1 bg-stone-200 rounded mx-auto w-2/3" />
        </div>
      </div>
    ),
    executive: (
      <div className="w-full h-full bg-white p-2 flex flex-col gap-1">
        <div className="h-5 rounded" style={{ backgroundColor: accent }} />
        <div className="space-y-0.5 mt-1">
          <div className="h-1.5 bg-slate-800 rounded w-1/2" />
          <div className="h-1 bg-slate-400 rounded w-1/3" />
        </div>
        <div className="h-px bg-slate-300 my-1" />
        <div className="space-y-0.5">
          <div className="h-1 bg-slate-200 rounded" />
          <div className="h-1 bg-slate-100 rounded w-4/5" />
        </div>
      </div>
    ),
    academic: (
      <div className="w-full h-full bg-white p-2 flex flex-col gap-1">
        <div className="text-center space-y-0.5">
          <div className="h-2 bg-slate-900 rounded mx-auto w-1/2" />
          <div className="h-1 bg-slate-500 rounded mx-auto w-1/4" />
        </div>
        <div className="h-px bg-slate-400 my-1" />
        <div className="space-y-0.5">
          <div className="h-1 rounded w-1/3" style={{ backgroundColor: accent }} />
          <div className="h-1 bg-slate-200 rounded w-full" />
          <div className="h-1 bg-slate-100 rounded w-4/5" />
        </div>
      </div>
    ),
    compact: (
      <div className="w-full h-full bg-white p-1.5 flex flex-col gap-0.5">
        <div className="h-2 rounded w-1/2" style={{ backgroundColor: accent }} />
        <div className="h-0.5 bg-slate-300 rounded" />
        <div className="space-y-0.5 mt-0.5">
          {[1,2,3,4,5].map(i => <div key={i} className="h-0.5 bg-slate-200 rounded" style={{ width: `${65+i*5}%` }} />)}
        </div>
      </div>
    ),
    creative: (
      <div className="w-full h-full bg-white p-2 flex flex-col gap-1">
        <div className="flex gap-1.5">
          <div className="w-8 rounded-sm shrink-0 h-8" style={{ backgroundColor: accent }} />
          <div className="flex-1 space-y-0.5 pt-0.5">
            <div className="h-1.5 bg-slate-800 rounded" />
            <div className="h-1 bg-slate-400 rounded w-2/3" />
          </div>
        </div>
        <div className="space-y-0.5 mt-1">
          <div className="h-1 rounded w-1/3" style={{ backgroundColor: `${accent}60` }} />
          <div className="h-1 bg-slate-200 rounded" />
        </div>
      </div>
    ),
  };

  return (
    <div className={`w-full aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${
      isSelected ? 'border-purple-600 shadow-md shadow-purple-900/10' : 'border-slate-200'
    }`}>
      {styles[template.id] || styles.modern}
    </div>
  );
}

export default function TemplateGallery({ selectedId = 'modern', onSelect }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const templates = getAllTemplates();

  const filtered = templates.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeCategory === 'All' || t.tags?.some(tag => tag.toLowerCase() === activeCategory.toLowerCase());
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
      <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
        <Layout className="w-4 h-4" /> Template Gallery
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              activeCategory === cat
                ? 'bg-[#6B46C1] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">No templates match your search.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 pt-1">
          {filtered.map(tmpl => {
            const isSelected = tmpl.id === selectedId;
            return (
              <button
                key={tmpl.id}
                onClick={() => onSelect(tmpl.id)}
                className={`text-left rounded-2xl overflow-hidden border-2 transition-all hover:scale-[1.02] shadow-xs ${
                  isSelected ? 'border-purple-600 ring-2 ring-purple-500/20' : 'border-slate-200 hover:border-purple-300'
                }`}
              >
                {/* Thumbnail */}
                <TemplateThumbnail template={tmpl} isSelected={isSelected} />

                {/* Info */}
                <div className={`p-3 ${isSelected ? 'bg-purple-50/70' : 'bg-white'}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-slate-900">{tmpl.name}</span>
                    {tmpl.tags?.includes('ATS Friendly') && (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" title="ATS Friendly" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight line-clamp-2">{tmpl.description}</p>
                  {isSelected && (
                    <p className="text-[11px] text-purple-700 font-bold mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active Template
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
