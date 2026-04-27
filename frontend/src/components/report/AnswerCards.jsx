import { motion } from 'framer-motion';

export default function AnswerCards({ answers }) {
  return (
    <div className="col-12 mt-8">
      <h3 className="section-header">Answer-by-Answer Analysis</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {answers.map((answer, idx) => (
          <AnswerCard key={answer.id} answer={answer} index={idx} />
        ))}
      </div>
    </div>
  );
}

function AnswerCard({ answer, index }) {
  const getScoreColor = (s) => {
    if (s <= 3) return '#EF4444';
    if (s <= 6) return '#F59E0B';
    return '#10B981';
  };

  const statusClass = answer.status === 'BEST ANSWER' ? 'badge-green' : 'badge-red';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      id={`answer-${answer.id}`}
      className="premium-card relative"
      style={{ borderLeft: `4px solid ${getScoreColor(answer.score)}` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="h-8 w-8 rounded-lg bg-bg-primary border border-border flex items-center justify-center text-xs font-black text-white">
            Q{answer.id}
          </span>
          <span className={`badge ${statusClass}`}>{answer.status}</span>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-white">{answer.score}</span>
          <span className="text-xs font-bold text-slate-500 ml-1">/10</span>
        </div>
      </div>

      <p className="text-white font-bold text-sm leading-relaxed mb-6 line-clamp-2">
        {answer.question}
      </p>

      <div className="grid grid-cols-4 gap-2 mb-8">
        <MetricChip icon="⏱" label={`${answer.duration}s`} />
        <MetricChip icon="💬" label={`${answer.wpm} WPM`} />
        <MetricChip icon="😐" label={answer.emotion} />
        <MetricChip icon="🔤" label={`${answer.fillerCount} Fillers`} />
      </div>

      <div className="flex items-center justify-between mb-8">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">STAR Coverage</span>
        <div className="flex gap-2">
          {['S', 'T', 'A', 'R'].map(char => (
            <div 
              key={char}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all ${
                answer.star[char.toLowerCase() === 's' ? 'situation' : char.toLowerCase() === 't' ? 'task' : char.toLowerCase() === 'a' ? 'action' : 'result']
                ? 'bg-green-500 text-bg-primary shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-bg-primary text-slate-600 border border-border'
              }`}
            >
              {char}
            </div>
          ))}
        </div>
      </div>

      <details className="group cursor-pointer">
        <summary className="list-none flex items-center justify-between text-[11px] font-black text-purple-400 uppercase tracking-widest p-3 bg-bg-primary/50 rounded-xl hover:bg-bg-primary transition-colors">
          <span>View Detailed Analysis & Transcript</span>
          <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="mt-4 space-y-4 px-1 pb-2">
          <div className="space-y-2">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Feedback</h5>
            <p className="text-xs text-white/80 leading-relaxed bg-bg-primary/30 p-3 rounded-lg border border-border/50">
              {answer.analysis}
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transcript</h5>
            <blockquote className="text-[11px] text-slate-400 italic leading-relaxed border-l-2 border-border pl-4">
              "{answer.transcript}"
            </blockquote>
          </div>
        </div>
      </details>
    </motion.div>
  );
}

function MetricChip({ icon, label }) {
  return (
    <div className="bg-bg-primary/50 border border-border rounded-xl p-2.5 flex flex-col items-center gap-1">
      <span className="text-sm">{icon}</span>
      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter text-center">{label}</span>
    </div>
  );
}
