import React, { useState } from 'react';
import { GripVertical, Eye, EyeOff, ChevronUp, ChevronDown, Plus, Trash2, List } from 'lucide-react';
import { SECTION_LABELS } from '../../../utils/resumeDefaults';

const ALL_SECTIONS = [
  'summary', 'experience', 'education', 'projects', 'skills',
  'certifications', 'achievements', 'languages', 'volunteerExperience',
  'publications', 'interests',
];

export default function SectionManager({ sectionOrder = [], hiddenSections = [], customSections = [], onChange }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const orderedSections = [...sectionOrder];
  ALL_SECTIONS.forEach(s => {
    if (!orderedSections.includes(s)) orderedSections.push(s);
  });

  const isHidden = (key) => hiddenSections.includes(key);

  const toggleVisibility = (key) => {
    const next = isHidden(key)
      ? hiddenSections.filter(s => s !== key)
      : [...hiddenSections, key];
    onChange({ sectionOrder: orderedSections, hiddenSections: next, customSections });
  };

  const moveSection = (idx, direction) => {
    const arr = [...orderedSections];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= arr.length) return;
    [arr[idx], arr[targetIdx]] = [arr[targetIdx], arr[idx]];
    onChange({ sectionOrder: arr, hiddenSections, customSections });
  };

  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const arr = [...orderedSections];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    onChange({ sectionOrder: arr, hiddenSections, customSections });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const addCustomSection = () => {
    const name = prompt('Enter custom section name (e.g. Leadership, Publications, Awards):');
    if (!name?.trim()) return;
    const newSection = { id: crypto.randomUUID(), name: name.trim(), items: [] };
    const newCustom = [...customSections, newSection];
    const newOrder = [...orderedSections, `custom_${newSection.id}`];
    onChange({ sectionOrder: newOrder, hiddenSections, customSections: newCustom });
  };

  const removeCustomSection = (id) => {
    const newCustom = customSections.filter(cs => cs.id !== id);
    const newOrder = orderedSections.filter(s => s !== `custom_${id}`);
    onChange({ sectionOrder: newOrder, hiddenSections, customSections: newCustom });
  };

  const getSectionLabel = (key) => {
    if (key.startsWith('custom_')) {
      const id = key.replace('custom_', '');
      return customSections.find(cs => cs.id === id)?.name || 'Custom Section';
    }
    return SECTION_LABELS[key] || key;
  };

  return (
    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
          <List className="w-4 h-4" /> Section Order & Visibility
        </div>
        <button
          onClick={addCustomSection}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Custom Section
        </button>
      </div>

      <p className="text-xs text-slate-500 font-medium">Drag items to reorder · Click eye icon to show/hide sections</p>

      <div className="space-y-2 pt-1">
        {orderedSections.map((sectionKey, idx) => {
          const hidden = isHidden(sectionKey);
          const isCustom = sectionKey.startsWith('custom_');
          const customId = isCustom ? sectionKey.replace('custom_', '') : null;
          const isDragging = dragIdx === idx;
          const isDragOver = dragOverIdx === idx;

          return (
            <div
              key={sectionKey}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition cursor-grab active:cursor-grabbing ${
                isDragging ? 'opacity-40' : ''
              } ${
                isDragOver ? 'border-purple-500 bg-purple-50' : 'border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-purple-200'
              } ${hidden ? 'opacity-60 bg-slate-50/30' : ''}`}
            >
              <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />

              <span className={`flex-1 text-xs font-semibold ${hidden ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                {getSectionLabel(sectionKey)}
                {hidden && <span className="ml-1 text-[10px] text-slate-400 no-underline font-normal">(hidden)</span>}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveSection(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 transition"
                  title="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveSection(idx, 1)}
                  disabled={idx === orderedSections.length - 1}
                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 transition"
                  title="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleVisibility(sectionKey)}
                  className={`p-1 transition ${hidden ? 'text-slate-400 hover:text-slate-600' : 'text-purple-600 hover:text-purple-700'}`}
                  title={hidden ? 'Show section' : 'Hide section'}
                >
                  {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {isCustom && (
                  <button
                    onClick={() => removeCustomSection(customId)}
                    className="p-1 text-slate-400 hover:text-red-600 transition"
                    title="Delete custom section"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
