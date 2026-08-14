import React from 'react';
import { Code, Plus, Trash2 } from 'lucide-react';
import { EMPTY_PROJECT } from '../../../utils/resumeDefaults';

export default function ProjectsEditor({ items = [], onChange }) {
  const addItem = () => {
    onChange([...items, { ...EMPTY_PROJECT }]);
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
          <Code className="w-4 h-4" /> Key Projects
        </div>
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Project
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          No projects added yet.
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="Mockmate AI Platform"
                    value={item.name || ''}
                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Technologies Used</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="React, Spring Boot, Postgres"
                    value={item.technologies || ''}
                    onChange={(e) => updateItem(idx, 'technologies', e.target.value)}
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
