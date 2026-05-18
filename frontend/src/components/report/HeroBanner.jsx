import React from 'react';

export default function HeroBanner({ candidate }) {
  const handlePrint = () => window.print();

  return (
    <div className="bg-white border-b border-slate-200 px-8 py-6 mb-8 no-print">
      <div className="max-width-[1400px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          {/* Logo/Brand */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-lg">M</span>
            </div>
            <span className="text-slate-900 font-bold tracking-tight">MockMate<span className="text-slate-400 font-medium">Analytics</span></span>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* Candidate Profile Quick Info */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Candidate</p>
              <h1 className="text-sm font-bold text-slate-900">{candidate.name}</h1>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Position</p>
              <h2 className="text-sm font-bold text-slate-600">{candidate.role}</h2>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right mr-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Interview ID</p>
            <p className="text-[10px] font-mono text-slate-600">#{candidate.id}</p>
          </div>
          <button 
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Report
          </button>
        </div>
      </div>
    </div>
  );
}
