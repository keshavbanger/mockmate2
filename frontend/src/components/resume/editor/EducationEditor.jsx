import React from 'react';
import { GraduationCap, Plus, Trash2 } from 'lucide-react';
import { EMPTY_EDUCATION } from '../../../utils/resumeDefaults';

export default function EducationEditor({ items = [], onChange }) {
  const addItem = () => {
    onChange([...items, { ...EMPTY_EDUCATION }]);
  };

  const removeItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, val) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    onChange(next);
  };

  const inputClasses = "w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition";

  return (
    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
          <GraduationCap className="w-4 h-4" /> Education
        </div>
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Degree
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          No education entries added yet.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="p-4 bg-slate-50/50 rounded-xl border border-slate-200/80 space-y-3 relative">
              <button
                onClick={() => removeItem(idx)}
                className="absolute top-3 right-3 text-slate-400 hover:text-red-600 p-1 transition rounded-full hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Institution</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="Stanford University"
                    value={item.institution || ''}
                    onChange={(e) => updateItem(idx, 'institution', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Degree</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="B.S. in Computer Science"
                    value={item.degree || ''}
                    onChange={(e) => updateItem(idx, 'degree', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date / Year</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="2018"
                    value={item.startDate || ''}
                    onChange={(e) => updateItem(idx, 'startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date / Graduation</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="2022"
                    value={item.endDate || ''}
                    onChange={(e) => updateItem(idx, 'endDate', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
