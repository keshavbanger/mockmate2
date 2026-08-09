import React from 'react';
import { Building2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const MarketReadiness = ({ readiness }) => {
  if (!readiness) return null;

  const renderStatus = (isReady) => {
    if (isReady === true) return <CheckCircle2 className="w-6 h-6 text-green-500" />;
    if (isReady === false) return <XCircle className="w-6 h-6 text-red-500" />;
    return <AlertCircle className="w-6 h-6 text-yellow-500" />; // For "almost ready" or warnings
  };

  return (
    <div className="premium-card mb-8">
      <div className="flex items-center gap-3 mb-6 border-b border-black/[0.04] pb-4">
        <Building2 className="w-6 h-6 text-[var(--brand-primary)]" />
        <h2 className="text-xl font-bold text-[#111]">Market Readiness</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`p-4 rounded-xl border ${readiness.tier1Companies ? 'border-green-200 bg-green-50 shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex justify-between items-start mb-2">
            <h3 className={`font-bold ${readiness.tier1Companies ? 'text-green-800' : 'text-slate-700'}`}>Tier 1</h3>
            {renderStatus(readiness.tier1Companies)}
          </div>
          <p className="text-xs text-slate-500 font-medium leading-tight">Google, Microsoft, Amazon, Top Product Cos</p>
        </div>

        <div className={`p-4 rounded-xl border ${readiness.tier2Companies ? 'border-green-200 bg-green-50 shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex justify-between items-start mb-2">
            <h3 className={`font-bold ${readiness.tier2Companies ? 'text-green-800' : 'text-slate-700'}`}>Tier 2</h3>
            {renderStatus(readiness.tier2Companies)}
          </div>
          <p className="text-xs text-slate-500 font-medium leading-tight">Mid-size Product Companies, Funded Startups</p>
        </div>

        <div className={`p-4 rounded-xl border ${readiness.tier3Companies ? 'border-green-200 bg-green-50 shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex justify-between items-start mb-2">
            <h3 className={`font-bold ${readiness.tier3Companies ? 'text-green-800' : 'text-slate-700'}`}>Tier 3</h3>
            {renderStatus(readiness.tier3Companies)}
          </div>
          <p className="text-xs text-slate-500 font-medium leading-tight">Service Companies, Local Firms, Agencies</p>
        </div>
      </div>

      {readiness.readinessNote && (
        <div className="bg-slate-50 p-4 rounded-lg border-l-4 border-[var(--brand-primary)] text-slate-700 font-medium italic text-sm">
          {readiness.readinessNote}
        </div>
      )}
    </div>
  );
};

export default MarketReadiness;
