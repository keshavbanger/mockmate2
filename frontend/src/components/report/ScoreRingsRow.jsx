import { motion } from 'framer-motion';

export default function ScoreRingsRow({ scores }) {
  const metrics = [
    { label: 'Communication', key: 'communication' },
    { label: 'Confidence', key: 'confidence' },
    { label: 'Technical', key: 'technical' },
    { label: 'Role Fit', key: 'roleFit' },
    { label: 'Grammar', key: 'grammar' },
    { label: 'Vocabulary', key: 'vocabulary' }
  ];

  return (
    <div className="col-5 premium-card">
      <h3 className="section-header">Metric Breakdown</h3>
      <div className="grid grid-cols-3 gap-6 mt-4">
        {metrics.map((m, idx) => (
          <ScoreRing 
            key={m.key} 
            label={m.label} 
            score={scores[m.key]} 
            delay={idx * 0.1}
          />
        ))}
      </div>
    </div>
  );
}

function ScoreRing({ label, score, delay }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 10) * circumference;

  const getColor = (s) => {
    if (s <= 3) return '#EF4444';
    if (s <= 6) return '#F59E0B';
    return '#10B981';
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-20 w-20 flex items-center justify-center">
        <svg className="h-full w-full transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="transparent"
            stroke="#1F2937"
            strokeWidth="5"
          />
          <motion.circle
            cx="40"
            cy="40"
            r={radius}
            fill="transparent"
            stroke={getColor(score)}
            strokeWidth="5"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, delay, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black text-white">{score}</span>
          <span className="text-[10px] font-bold text-slate-500 ml-0.5 mt-1">/10</span>
        </div>
      </div>
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
        {label}
      </span>
    </div>
  );
}
