import React from 'react';
import { motion } from 'framer-motion';

const HonestScoreGauge = ({ score }) => {
  // 90-100: "Exceptional"    → deep green
  // 75-89:  "Strong"         → green
  // 60-74:  "Decent"         → blue
  // 45-59:  "Below Average"  → amber
  // 30-44:  "Needs Work"     → orange
  // 0-29:   "Not Ready"      → red
  const getScoreInfo = (score) => {
    if (score >= 90) return { label: 'Exceptional', color: '#166534', stroke: 'stroke-green-800' };
    if (score >= 75) return { label: 'Strong', color: '#22c55e', stroke: 'stroke-green-500' };
    if (score >= 60) return { label: 'Decent', color: '#3b82f6', stroke: 'stroke-blue-500' };
    if (score >= 45) return { label: 'Below Average', color: '#f59e0b', stroke: 'stroke-amber-500' };
    if (score >= 30) return { label: 'Needs Work', color: '#f97316', stroke: 'stroke-orange-500' };
    return { label: 'Not Ready', color: '#ef4444', stroke: 'stroke-red-500' };
  };

  const { label, color, stroke } = getScoreInfo(score);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="premium-card h-full flex flex-col items-center justify-center py-10 gap-5">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ATS Score</p>
      <div className="relative flex items-center justify-center">
        <svg className="w-40 h-40 transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#F3E8FF"
            strokeWidth="12"
            fill="transparent"
          />
          <motion.circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={stroke}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-[#111]">{score}</span>
          <span className="text-xs font-bold text-slate-400">/100</span>
        </div>
      </div>
      <div className="mt-2 text-center flex flex-col items-center gap-1">
        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border`} style={{ color, borderColor: color, backgroundColor: `${color}15` }}>{label}</span>
      </div>
    </div>
  );
};

export default HonestScoreGauge;
