import React, { useMemo } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, Star, Type } from 'lucide-react';
import { analyzeResume, getContentQuality, getFormattingScore, getCompletenessScore } from '../../../utils/atsAnalyzer';

function ScoreRing({ score, size = 72 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={radius} stroke="#f1f5f9" strokeWidth={6} fill="none" />
      <circle
        cx={size/2} cy={size/2} r={radius}
        stroke={color} strokeWidth={6} fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s ease' }}
      />
    </svg>
  );
}

function CategoryCard({ icon, label, score, issues }) {
  const color = score >= 70 ? 'text-emerald-600' : score >= 45 ? 'text-amber-600' : 'text-red-600';
  const bar = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          {icon}
          {label}
        </div>
        <span className={`text-sm font-extrabold ${color}`}>{score}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full ${bar} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
      {issues.length > 0 && (
        <ul className="space-y-1 mt-1">
          {issues.slice(0, 2).map((iss, i) => (
            <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
              {iss}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ATSAnalysisPanel({ resumeData }) {
  const analysis = useMemo(() => analyzeResume(resumeData), [resumeData]);
  const content = useMemo(() => getContentQuality(resumeData), [resumeData]);
  const formatting = useMemo(() => getFormattingScore(resumeData), [resumeData]);
  const completeness = useMemo(() => getCompletenessScore(resumeData), [resumeData]);

  const overallScore = analysis.score;

  return (
    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
      {/* Overall Score */}
      <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
        <div className="relative shrink-0">
          <ScoreRing score={overallScore} size={72} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-extrabold text-slate-900">{overallScore}</span>
          </div>
        </div>
        <div>
          <p className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-purple-600" /> ATS Compatibility Score
          </p>
          <p className="text-xs text-slate-500 leading-snug mt-1 font-medium">
            {overallScore >= 75 ? '🟢 Looking strong! Optimized for major ATS software.'
              : overallScore >= 50 ? '🟡 Good foundation — add more quantitative impact details.'
              : '🔴 Needs targeted improvements before applying.'}
          </p>
        </div>
      </div>

      {/* 4 Category Breakdown */}
      <div className="space-y-2.5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category Breakdown</p>

        <CategoryCard
          icon={<CheckCircle2 className="w-4 h-4 text-purple-600" />}
          label="Completeness"
          score={completeness.percent}
          issues={completeness.suggestions.slice(0, 2)}
        />

        <CategoryCard
          icon={<Type className="w-4 h-4 text-indigo-600" />}
          label="Content Quality"
          score={content.score}
          issues={content.issues}
        />

        <CategoryCard
          icon={<ShieldCheck className="w-4 h-4 text-sky-600" />}
          label="ATS Formatting"
          score={formatting.score}
          issues={formatting.issues}
        />

        <CategoryCard
          icon={<Star className="w-4 h-4 text-amber-500" />}
          label="Overall Quality"
          score={overallScore}
          issues={[]}
        />
      </div>

      {/* All Issues */}
      {analysis.issues.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Action Items</p>
          {analysis.issues.map((iss, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200/80 p-2.5 rounded-xl font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
              {iss}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center font-medium">
        This score is calculated using industry ATS parsing criteria.
      </p>
    </div>
  );
}
