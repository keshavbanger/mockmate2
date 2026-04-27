import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function OverallScoreGauge({ score }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = score;
    if (start === end) return;
    
    const timer = setInterval(() => {
      start += 1;
      setDisplayScore(start);
      if (start >= end) clearInterval(timer);
    }, 20);
    
    return () => clearInterval(timer);
  }, [score]);

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore / 100) * circumference * 0.75; // 270 degree sweep

  const getColor = (s) => {
    if (s < 40) return '#EF4444';
    if (s < 70) return '#F59E0B';
    return '#10B981';
  };

  return (
    <div className="col-3 premium-card flex flex-col items-center justify-center text-center">
      <h3 className="section-header w-full">Overall Performance</h3>
      
      <div className="relative mt-4">
        <svg className="w-48 h-48 transform -rotate-[225deg]">
          {/* Background Arc */}
          <circle
            cx="96"
            cy="96"
            r={radius}
            fill="transparent"
            stroke="#1F2937"
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.25}
            strokeLinecap="round"
          />
          {/* Progress Arc */}
          <motion.circle
            cx="96"
            cy="96"
            r={radius}
            fill="transparent"
            stroke={getColor(displayScore)}
            strokeWidth="12"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-6xl font-black tracking-tighter" style={{ color: getColor(displayScore) }}>
            {displayScore}
          </span>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-[-5px]">Score / 100</span>
        </div>
      </div>

      <div className="mt-8 space-y-1">
        <p className="text-white font-bold text-sm">
          {score > 70 ? 'Above Average' : score > 40 ? 'Average' : 'Needs Improvement'}
        </p>
        <p className="text-slate-500 text-[10px] font-medium leading-relaxed max-w-[140px]">
          Based on Senior Developer benchmarks
        </p>
      </div>
    </div>
  );
}
