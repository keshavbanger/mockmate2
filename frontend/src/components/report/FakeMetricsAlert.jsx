import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';

const FakeMetricsAlert = ({ metrics = [] }) => {
  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 shadow-sm mb-8">
      <div className="flex items-center gap-3 mb-4 border-b border-orange-200/60 pb-4">
        <ShieldAlert className="w-8 h-8 text-orange-600" />
        <div>
          <h2 className="text-xl font-bold text-orange-700">Verifiability Warning</h2>
          <p className="text-sm text-orange-600 font-medium">These metrics may raise red flags with technical recruiters</p>
        </div>
      </div>
      
      <div className="space-y-4">
        {metrics.map((item, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm">
            <div className="mb-3">
              <span className="text-xs font-bold text-orange-600/70 uppercase tracking-wider block mb-1">Flagged Content</span>
              <p className="text-slate-800 italic border-l-2 border-orange-400 pl-3 py-1 font-medium">"{item.bullet}"</p>
            </div>
            
            <div className="mb-3">
              <span className="text-xs font-bold text-red-500/70 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Info size={12} /> Why it's flagged
              </span>
              <p className="text-slate-600 text-sm ml-4 font-medium">{item.issue}</p>
            </div>
            
            {item.fix && (
              <div>
                <span className="text-xs font-bold text-green-600/80 uppercase tracking-wider block mb-1">How to fix</span>
                <p className="text-slate-700 text-sm ml-4 bg-slate-50 border border-slate-200 p-2 rounded inline-block font-medium">{item.fix}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FakeMetricsAlert;
