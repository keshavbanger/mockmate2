import { motion } from 'framer-motion';

export default function HeroBanner({ candidate }) {
  return (
    <div className="col-12 premium-card overflow-hidden !p-0 border-none bg-transparent">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full p-10 flex flex-col md:flex-row items-center justify-between gap-8"
        style={{ 
          background: 'linear-gradient(135deg, #7C3AED 0%, #1E40AF 50%, #0A0E1A 100%)',
          borderRadius: '16px'
        }}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white/60 font-bold text-[10px] uppercase tracking-widest">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Interview Report
          </div>
          
          <h1 className="text-5xl font-black text-white tracking-tighter">
            {candidate.name}
          </h1>
          
          <div className="flex flex-wrap gap-3">
            <Tag icon="📅" label={candidate.date} />
            <Tag icon="🎯" label={candidate.role} />
            <Tag icon="⏱" label={candidate.duration} />
            <Tag icon="🏢" label={candidate.interviewType} />
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => window.print()}
            className="px-6 py-3 rounded-full border border-white/20 text-white text-sm font-bold hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </button>
          <button className="px-6 py-3 rounded-full bg-white text-purple-700 text-sm font-bold hover:shadow-xl transition-all shadow-white/10 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92zM18 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM6 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 7.02c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
            </svg>
            Share Report
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Tag({ icon, label }) {
  return (
    <span className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-white text-[11px] font-bold flex items-center gap-2">
      <span>{icon}</span> {label}
    </span>
  );
}
