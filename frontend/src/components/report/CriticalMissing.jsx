import React from 'react';
import { AlertTriangle, Square } from 'lucide-react';

const CriticalMissing = ({ items = [] }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 shadow-sm mb-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-100/50 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
      
      <div className="flex items-center gap-3 mb-5 relative z-10">
        <AlertTriangle className="w-8 h-8 text-red-600 animate-pulse" />
        <h2 className="text-xl font-bold text-red-700 uppercase tracking-wide">
          Critical Missing Items
        </h2>
      </div>
      
      <p className="text-red-600 text-sm mb-4 font-medium relative z-10">Fix these items first. Their absence will likely cause automatic rejection.</p>
      
      <ul className="space-y-3 relative z-10">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-red-100 shadow-sm">
            <Square className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <span className="text-slate-800 font-medium">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CriticalMissing;
