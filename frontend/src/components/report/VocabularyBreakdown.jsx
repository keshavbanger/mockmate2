import { motion } from 'framer-motion';

export default function VocabularyBreakdown({ vocabulary }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (vocabulary.richnessScore / 100) * circumference;

  return (
    <div className="col-6 premium-card">
      <h3 className="section-header">Vocabulary Breakdown</h3>
      
      <div className="flex items-center gap-10 mb-10">
        <div className="relative h-24 w-24 flex items-center justify-center">
          <svg className="h-full w-full transform -rotate-90">
            <circle cx="48" cy="48" r={radius} fill="transparent" stroke="#1F2937" strokeWidth="8" />
            <motion.circle
              cx="48"
              cy="48"
              r={radius}
              fill="transparent"
              stroke="#7C3AED"
              strokeWidth="8"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-white">{vocabulary.richnessScore}</span>
            <span className="text-[8px] font-bold text-slate-500 uppercase">Richness</span>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
              <span className="text-slate-400">Vocabulary Level</span>
              <span className="text-purple-400">Advanced B2</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '70%' }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-purple-500 shadow-[0_0_12px_rgba(124,58,237,0.5)]" 
              />
            </div>
            <div className="flex justify-between text-[8px] font-bold text-slate-600 mt-1">
              <span>A1</span>
              <span>A2</span>
              <span>B1</span>
              <span>B2</span>
              <span>C1</span>
              <span>C2</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            You used {vocabulary.totalWords} words with high semantic diversity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Domain Terms Used
          </h4>
          <div className="flex flex-wrap gap-2">
            {vocabulary.domainTermsUsed.length > 0 ? vocabulary.domainTermsUsed.map(term => (
              <span key={term} className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold flex items-center gap-2">
                ✓ {term}
              </span>
            )) : <span className="text-slate-500 text-[10px] italic">No specific domain terms detected</span>}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Missing Opportunities
          </h4>
          <div className="flex flex-wrap gap-2">
            {vocabulary.missingDomainTerms.map(term => (
              <button key={term} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-all flex items-center gap-2 group">
                + {term}
                <div className="hidden group-hover:block absolute bg-bg-card border border-border p-2 rounded-lg text-xs z-50 transform -translate-y-full">
                  Definition and example coming soon...
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
