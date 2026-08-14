import React, { useState } from 'react';
import { Wrench, Plus, Trash2 } from 'lucide-react';

export default function SkillsEditor({ items = [], onChange }) {
  const [newSkill, setNewSkill] = useState('');
  const [newCategory, setNewCategory] = useState('Technical');

  const addSkill = () => {
    if (!newSkill.trim()) return;
    onChange([...items, { skill: newSkill.trim(), category: newCategory }]);
    setNewSkill('');
  };

  const removeSkill = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
      <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
        <Wrench className="w-4 h-4" /> Skills & Technologies
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
          placeholder="e.g. React, Docker, Python..."
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSkill()}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="bg-slate-50/70 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:border-purple-500"
        >
          <option value="Technical">Technical</option>
          <option value="Frontend">Frontend</option>
          <option value="Backend">Backend</option>
          <option value="Databases">Databases</option>
          <option value="DevOps">DevOps</option>
          <option value="Languages">Languages</option>
          <option value="Tools">Tools</option>
          <option value="Other">Other</option>
        </select>
        <button
          onClick={addSkill}
          className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold transition flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {items.map((item, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-xs text-purple-900 shadow-2xs"
          >
            <span className="font-bold text-purple-700">{item.category}:</span> {item.skill}
            <button
              onClick={() => removeSkill(idx)}
              className="text-purple-400 hover:text-red-600 transition ml-1"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
