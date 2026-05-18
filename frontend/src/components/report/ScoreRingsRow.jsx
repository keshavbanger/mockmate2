import React from 'react';

export default function ScoreRingsRow({ scores }) {
  const categories = [
    { key: 'technical', label: 'Technical Accuracy', color: 'indigo' },
    { key: 'communication', label: 'Comm. Clarity', color: 'indigo' },
    { key: 'softSkills', label: 'Soft Skills', color: 'indigo' },
    { key: 'problemSolving', label: 'Problem Solving', color: 'indigo' }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 h-full">
      {categories.map((cat) => (
        <div key={cat.key} className="premium-card">
          <p className="kpi-label mb-4">{cat.label}</p>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-black text-slate-900">{scores[cat.key]}</span>
            <span className="text-sm font-bold text-slate-300">/ 10</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 rounded-full" 
              style={{ width: `${scores[cat.key] * 10}%` }} 
            />
          </div>
        </div>
      ))}
    </div>
  );
}
