import React, { useState } from 'react';
import { Briefcase, Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { EMPTY_EXPERIENCE } from '../../../utils/resumeDefaults';
import { improveBullet } from '../../../utils/resumeApi';

export default function ExperienceEditor({ items = [], onChange }) {
  const [improvingIdx, setImprovingIdx] = useState(null);

  const addItem = () => {
    onChange([...items, { ...EMPTY_EXPERIENCE, id: crypto.randomUUID() }]);
  };

  const removeItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, val) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    onChange(next);
  };

  const updateBullet = (itemIdx, bulletIdx, val) => {
    const next = [...items];
    const bullets = [...(next[itemIdx].bullets || [])];
    bullets[bulletIdx] = val;
    next[itemIdx] = { ...next[itemIdx], bullets };
    onChange(next);
  };

  const addBullet = (itemIdx) => {
    const next = [...items];
    const bullets = [...(next[itemIdx].bullets || []), ''];
    next[itemIdx] = { ...next[itemIdx], bullets };
    onChange(next);
  };

  const removeBullet = (itemIdx, bulletIdx) => {
    const next = [...items];
    const bullets = (next[itemIdx].bullets || []).filter((_, i) => i !== bulletIdx);
    next[itemIdx] = { ...next[itemIdx], bullets };
    onChange(next);
  };

  const handleImprove = async (itemIdx, bulletIdx, text) => {
    if (!text.trim()) return;
    setImprovingIdx(`${itemIdx}-${bulletIdx}`);
    try {
      const res = await improveBullet({ original: text, style: 'achievement-focused' });
      if (res?.suggestion) {
        updateBullet(itemIdx, bulletIdx, res.suggestion);
      }
    } catch (e) {
      console.error('Bullet AI improve failed:', e);
    } finally {
      setImprovingIdx(null);
    }
  };

  const inputClasses = "w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition";

  return (
    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
          <Briefcase className="w-4 h-4" /> Work Experience
        </div>
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Position
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          No work experience added yet. Click "Add Position" above.
        </p>
      ) : (
        <div className="space-y-5">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="p-4 bg-slate-50/50 rounded-xl border border-slate-200/80 space-y-3 relative group">
              <button
                onClick={() => removeItem(idx)}
                className="absolute top-3 right-3 text-slate-400 hover:text-red-600 p-1 transition rounded-full hover:bg-red-50"
                title="Remove experience"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="Software Engineer"
                    value={item.jobTitle || ''}
                    onChange={(e) => updateItem(idx, 'jobTitle', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="Acme Corp"
                    value={item.company || ''}
                    onChange={(e) => updateItem(idx, 'company', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="Jan 2022"
                    value={item.startDate || ''}
                    onChange={(e) => updateItem(idx, 'startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={item.isCurrent}
                      className={`${inputClasses} disabled:opacity-50`}
                      placeholder={item.isCurrent ? 'Present' : 'Dec 2023'}
                      value={item.isCurrent ? 'Present' : item.endDate || ''}
                      onChange={(e) => updateItem(idx, 'endDate', e.target.value)}
                    />
                    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 whitespace-nowrap cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!item.isCurrent}
                        onChange={(e) => updateItem(idx, 'isCurrent', e.target.checked)}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      Current
                    </label>
                  </div>
                </div>
              </div>

              {/* Bullets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Key Responsibilities & Impact</label>
                <div className="space-y-2">
                  {(item.bullets || []).map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs font-bold">•</span>
                      <input
                        type="text"
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                        placeholder="Increased system efficiency by 35% by optimizing SQL queries..."
                        value={bullet}
                        onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                      />
                      <button
                        onClick={() => handleImprove(idx, bIdx, bullet)}
                        disabled={improvingIdx === `${idx}-${bIdx}`}
                        className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 transition"
                        title="AI Improve Bullet"
                      >
                        {improvingIdx === `${idx}-${bIdx}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-purple-600" />}
                      </button>
                      <button
                        onClick={() => removeBullet(idx, bIdx)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addBullet(idx)}
                    className="text-xs text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1 mt-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Bullet Point
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
