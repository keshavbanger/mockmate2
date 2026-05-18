import { motion } from 'framer-motion';

export default function VocabularyBreakdown({ vocabulary }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (vocabulary.richnessScore / 100) * circumference;

  return (
    <div className="premium-card h-full">
      <h3 className="section-title">Semantic Diversity</h3>
      
      <div className="flex items-center gap-10 mb-10">
        <div className="relative h-24 w-24 flex items-center justify-center">
          <svg className="h-full w-full transform -rotate-90">
            <circle cx="48" cy="48" r={radius} fill="transparent" stroke="#F1F5F9" strokeWidth="10" />
            <motion.circle
              cx="48"
              cy="48"
              r={radius}
              fill="transparent"
              stroke="#4F46E5"
              strokeWidth="10"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-900">{vocabulary.richnessScore}</span>
            <span className="text-[8px] font-black text-slate-400 uppercase">Index</span>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
              <span className="text-slate-400">Word Complexity</span>
              <span className="text-indigo-600">Advanced Tier</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '70%' }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-indigo-500" 
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Analyzed {vocabulary.totalWords} unique tokens with high industry relevance.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-50">
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            Professional Lexicon
          </h4>
          <div className="flex flex-wrap gap-2">
            {vocabulary.domainTermsUsed?.length > 0 ? vocabulary.domainTermsUsed.map(term => (
              <span key={term} className="px-3 py-1.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">
                {term}
              </span>
            )) : <span className="text-slate-500 text-[10px] italic">No industry-specific terms detected</span>}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            Missed Opportunities
          </h4>
          <div className="flex flex-wrap gap-2">
            {vocabulary.missingDomainTerms?.map(term => (
              <span key={term} className="px-3 py-1.5 rounded bg-slate-50 text-slate-500 border border-slate-100 text-[10px] font-bold">
                {term}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
