import { useState } from 'react';
import { motion } from 'framer-motion';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch { const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <motion.button onClick={handleCopy} whileTap={{ scale: 0.96 }}
      className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all flex-shrink-0 ${
        copied
          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
          : 'bg-[var(--brand-light)] text-[var(--brand-primary)] border-purple-200 hover:bg-purple-100'
      }`}>
      {copied ? '✓ Copied' : 'Copy'}
    </motion.button>
  );
}

export default function BulletRewrites({ rewrites = [] }) {
  if (rewrites.length === 0) return (
    <div className="premium-card flex flex-col items-center justify-center gap-4 py-12">
      <div className="h-14 w-14 rounded-2xl bg-[var(--brand-light)] flex items-center justify-center text-2xl">✏️</div>
      <p className="text-sm font-bold text-slate-500">No Rewrite Suggestions</p>
      <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed">
        Your bullet points may already be well-structured, or no specific improvements were identified.
      </p>
    </div>
  );

  return (
    <div className="premium-card">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Bullet Rewrites</p>
      <p className="text-sm text-slate-500 font-medium mb-6">
        AI-suggested rewrites to strengthen impact and keyword alignment.
      </p>

      <div className="space-y-5">
        {rewrites.map((item, i) => (
          <div key={i} className="border border-black/[0.04] rounded-3xl overflow-hidden bg-[#fafafa]">
            {/* Before */}
            <div className="p-5 border-b border-black/[0.04]">
              <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-2">Before</p>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">{item.original}</p>
            </div>
            {/* After */}
            <div className="p-5 bg-[var(--brand-light)]/40">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-[9px] font-black text-[var(--brand-primary)] uppercase tracking-widest">After</p>
                <CopyButton text={item.rewritten} />
              </div>
              <p className="text-sm text-[#111] font-semibold leading-relaxed">{item.rewritten}</p>
              {item.reason && (
                <p className="text-[11px] text-slate-500 font-medium mt-3 leading-relaxed italic">
                  💡 {item.reason}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
