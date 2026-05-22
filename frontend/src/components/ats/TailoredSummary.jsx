import { useState } from 'react';
import { motion } from 'framer-motion';

export default function TailoredSummary({ summary = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(summary); }
    catch {
      const el = document.createElement('textarea');
      el.value = summary;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!summary || summary.trim() === '') return (
    <div className="premium-card flex flex-col items-center justify-center gap-4 py-12">
      <div className="h-14 w-14 rounded-2xl bg-[var(--brand-light)] flex items-center justify-center text-2xl">✍️</div>
      <p className="text-sm font-bold text-slate-500">No Tailored Summary Generated</p>
      <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed">
        AI analysis was unavailable. Try again with a valid Groq API key.
      </p>
    </div>
  );

  return (
    <div className="premium-card">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          AI-Tailored Professional Summary
        </p>
        <motion.button
          onClick={handleCopy}
          whileTap={{ scale: 0.96 }}
          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all flex-shrink-0 ${
            copied
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : 'bg-[var(--brand-light)] text-[var(--brand-primary)] border-purple-200 hover:bg-purple-100'
          }`}
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </motion.button>
      </div>

      <p className="text-sm text-slate-500 font-medium mb-5">
        Replace your existing summary with this version — it naturally incorporates JD keywords
        while showcasing your strengths.
      </p>

      {/* Summary box */}
      <div className="relative bg-gradient-to-br from-[var(--brand-light)] to-purple-50/60
                      border border-purple-200/60 rounded-2xl p-6">
        {/* Decorative quote */}
        <span className="absolute top-3 left-4 text-4xl text-purple-200/60 font-serif leading-none select-none">"</span>
        <p className="text-[15px] text-[#111] font-semibold leading-relaxed pl-4 pr-2 italic">
          {summary}
        </p>
        <span className="absolute bottom-3 right-4 text-4xl text-purple-200/60 font-serif leading-none select-none">"</span>
      </div>

      {/* Instruction row */}
      <div className="flex items-center gap-2 mt-4 p-3 bg-amber-50 border border-amber-200/60 rounded-xl">
        <span className="text-base">💡</span>
        <p className="text-xs text-amber-700 font-semibold leading-relaxed">
          Paste this at the top of your resume under a <strong>Professional Summary</strong> heading.
          Customize the specific years/company names to match your background.
        </p>
      </div>
    </div>
  );
}
