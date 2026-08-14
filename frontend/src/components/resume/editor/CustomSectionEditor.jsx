import React from 'react';
import { Plus, Trash2, Layers } from 'lucide-react';

function CustomItemEditor({ item, onChange, onDelete }) {
  const update = (field, val) => onChange({ ...item, [field]: val });

  const updateBullet = (i, val) => {
    const bullets = [...(item.bullets || [])];
    bullets[i] = val;
    update('bullets', bullets);
  };

  const addBullet = () => update('bullets', [...(item.bullets || []), '']);
  const removeBullet = (i) => update('bullets', (item.bullets || []).filter((_, idx) => idx !== i));

  const inputClasses = "w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition";

  return (
    <div className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-200/80 space-y-2.5">
      <div className="flex justify-between items-center">
        <input
          type="text"
          className="flex-1 bg-transparent text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none border-b border-transparent focus:border-purple-500"
          placeholder="Title / Role (e.g. Student Leader)"
          value={item.title || ''}
          onChange={e => update('title', e.target.value)}
        />
        <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-600 transition ml-2">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          className={inputClasses}
          placeholder="Organization"
          value={item.organization || ''}
          onChange={e => update('organization', e.target.value)}
        />
        <input
          type="text"
          className={inputClasses}
          placeholder="Date (e.g. 2024–2025)"
          value={item.date || ''}
          onChange={e => update('date', e.target.value)}
        />
      </div>

      <textarea
        rows={2}
        className={`${inputClasses} resize-none`}
        placeholder="Description (optional)"
        value={item.description || ''}
        onChange={e => update('description', e.target.value)}
      />

      <div className="space-y-1.5 pt-1">
        {(item.bullets || []).map((b, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-slate-400 text-xs font-bold">•</span>
            <input
              type="text"
              className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500"
              placeholder="Bullet point"
              value={b}
              onChange={e => updateBullet(i, e.target.value)}
            />
            <button onClick={() => removeBullet(i)} className="text-slate-400 hover:text-red-600 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button onClick={addBullet} className="text-xs text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1 mt-1">
          <Plus className="w-3.5 h-3.5" /> Add Bullet Point
        </button>
      </div>
    </div>
  );
}

export default function CustomSectionEditor({ customSections = [], onChange }) {
  const updateSection = (idx, updated) => {
    const next = [...customSections];
    next[idx] = updated;
    onChange(next);
  };

  const addItem = (sectionIdx) => {
    const section = customSections[sectionIdx];
    const newItem = { id: crypto.randomUUID(), title: '', organization: '', date: '', description: '', bullets: [] };
    updateSection(sectionIdx, { ...section, items: [...(section.items || []), newItem] });
  };

  const updateItem = (sectionIdx, itemIdx, updated) => {
    const section = customSections[sectionIdx];
    const items = [...(section.items || [])];
    items[itemIdx] = updated;
    updateSection(sectionIdx, { ...section, items });
  };

  const deleteItem = (sectionIdx, itemIdx) => {
    const section = customSections[sectionIdx];
    const items = (section.items || []).filter((_, i) => i !== itemIdx);
    updateSection(sectionIdx, { ...section, items });
  };

  if (customSections.length === 0) return null;

  return (
    <div className="space-y-4">
      {customSections.map((section, sIdx) => (
        <div key={section.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-purple-600 flex items-center gap-2">
              <Layers className="w-4 h-4" /> {section.name}
            </h4>
            <button
              onClick={() => addItem(sIdx)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Entry
            </button>
          </div>

          {(section.items || []).length === 0 ? (
            <p className="text-xs text-slate-500 italic py-3 text-center bg-slate-50/50 rounded-xl">No entries yet. Click "Add Entry" to start.</p>
          ) : (
            <div className="space-y-3">
              {(section.items || []).map((item, iIdx) => (
                <CustomItemEditor
                  key={item.id || iIdx}
                  item={item}
                  onChange={(updated) => updateItem(sIdx, iIdx, updated)}
                  onDelete={() => deleteItem(sIdx, iIdx)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
