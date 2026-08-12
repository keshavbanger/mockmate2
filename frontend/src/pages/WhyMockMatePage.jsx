import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// ─── Content ────────────────────────────────────────────────────────────────

const PROBLEMS = [
  { icon: '🎭', title: 'Friends are too kind', desc: 'They tell you it went great. A recruiter never will.' },
  { icon: '🤖', title: 'ATS bots reject on formatting', desc: 'Good candidates get filtered before a human ever sees the resume.' },
  { icon: '✅', title: 'Coding tools only check output', desc: 'Passing test cases isn\'t the same as explaining your approach out loud.' },
];

const WORKFLOW = [
  { when: 'Day −14', title: 'Score your resume', desc: 'Upload it, get an honest ATS score and the exact keywords you\'re missing against the JD.' },
  { when: 'Day −7', title: 'Run a live interview', desc: 'Face the AI interviewer for the actual role — it follows up on your answers instead of reading a script.' },
  { when: 'Interview day', title: 'Walk in prepared', desc: 'You\'ve already heard the hard follow-up question once, and you already know your weak spots.' },
];

const CAPABILITIES = [
  { icon: '🎯', label: 'Score', desc: 'Honest ATS scoring', to: '/ats' },
  { icon: '✍️', label: 'Rewrite', desc: 'AI-assisted resume studio', to: '/ats' },
  { icon: '🎤', label: 'Practice', desc: 'Live AI interview', to: '/setup' },
  { icon: '📊', label: 'Review', desc: 'Real scorecards', to: '/setup' },
  { icon: '📅', label: 'Track', desc: 'Full session history', to: '/history' },
];

const MORE_CAPABILITIES = [
  { icon: '💻', title: 'DSA Coding Round', desc: 'Monaco editor, real sandboxed execution, graded on approach and complexity — not just pass/fail.', to: '/tech-interview/setup' },
  { icon: '📈', title: 'ATS Comparison', desc: 'Benchmark one resume against multiple job descriptions to see which version actually lands more interviews.', to: '/ats/compare' },
  { icon: '🎙️', title: 'Speech & Filler Detection', desc: 'Words per minute, pause frequency, and exactly when filler words happened, on a timeline.', to: '/setup' },
];

const FAQS = [
  { q: 'How is my resume actually scored?', a: 'A 100-point, 7-component model, clamped against CGPA benchmarks and real market standards — it\'s built to not inflate your score.' },
  { q: 'What happens to my resume and interview data?', a: 'Used only to generate your own reports and history, tied to your account. Nothing is shared or shown to anyone else.' },
  { q: 'What languages does the coding round support?', a: 'Java, Python, C++, JavaScript, and Go, with real sandboxed execution against hidden test cases.' },
];

// ─── Small visual pieces ────────────────────────────────────────────────────

function ScoreCompareVisual() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Generic resume checker</p>
        <div className="flex items-end gap-1 mb-2">
          <span className="text-4xl font-black text-slate-400 line-through decoration-2">98</span>
          <span className="text-xs text-slate-400 mb-1">/ 100</span>
        </div>
        <p className="text-xs text-slate-400 font-medium">"Looks great! Ready to send."</p>
      </div>
      <div className="rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-light)] p-5">
        <p className="text-[10px] font-bold text-[var(--brand-primary)] uppercase tracking-widest mb-3">MockMate</p>
        <div className="flex items-end gap-1 mb-2">
          <span className="text-4xl font-black text-black">71</span>
          <span className="text-xs text-slate-500 mb-1">/ 100</span>
        </div>
        <p className="text-xs text-slate-700 font-semibold">"Missing 4 of 9 JD keywords. Bullet 3 has no measurable impact."</p>
      </div>
    </div>
  );
}

function WorkflowLine() {
  return (
    <div className="hidden md:block absolute top-[18px] left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function WhyMockMatePage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen pt-32 pb-20 px-6 overflow-x-hidden bg-[#fafafa]">
      <Navbar />

      {/* No card/border wrapper — sections sit directly on the page
          background, separated by hairlines instead of a boxed frame. */}
      <div className="max-w-6xl mx-auto divide-y divide-slate-100">

        {/* ── 1. WHAT IS THIS (hero) ── */}
        <section className="px-8 md:px-16 pt-16 pb-14 text-center">
          <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-7">
            Why MockMate
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-black mb-5 leading-[1.15] max-w-2xl mx-auto">
            The prep platform that doesn't tell you what you want to hear.
          </h1>
          <p className="text-slate-500 text-base md:text-lg max-w-xl mx-auto mb-9 leading-relaxed">
            MockMate scores your resume, interviews you live, and grades your code — honestly, the way a recruiter actually would.
          </p>
          <motion.button
            onClick={() => navigate('/setup')}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="btn-primary-solid btn-lift"
          >
            Start Free Practice
          </motion.button>
        </section>

        {/* ── 2. PROBLEM ── */}
        <section className="px-8 md:px-16 py-16">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center mb-3">The problem</p>
          <h2 className="text-2xl md:text-3xl font-bold text-black text-center mb-12 max-w-lg mx-auto">
            Most prep isn't actually preparing you.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PROBLEMS.map((p, i) => (
              <motion.div key={p.title}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4 }}
              >
                <div className="text-2xl mb-3">{p.icon}</div>
                <h3 className="font-bold text-black mb-1.5">{p.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── 3. NEW WAY OF DOING IT ── */}
        <section className="px-8 md:px-16 py-16">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center mb-3">A different approach</p>
          <h2 className="text-2xl md:text-3xl font-bold text-black text-center mb-4 max-w-lg mx-auto">
            <em className="not-italic text-[var(--brand-primary)]">Brutally honest</em> feedback, on purpose.
          </h2>
          <p className="text-slate-500 text-center max-w-xl mx-auto mb-12 leading-relaxed">
            Most tools inflate your score to keep you happy, or grade your code on whether it compiles. MockMate's scoring is clamped against real recruiter benchmarks — so what you see is closer to what you'd actually be told in the room.
          </p>
          <div className="max-w-2xl mx-auto">
            <ScoreCompareVisual />
          </div>
        </section>

        {/* ── 4. WORKFLOW ── */}
        <section className="px-8 md:px-16 py-16">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center mb-3">How it fits your prep</p>
          <h2 className="text-2xl md:text-3xl font-bold text-black text-center mb-14 max-w-lg mx-auto">
            Two weeks out from an interview? Here's the shape of it.
          </h2>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10">
            <WorkflowLine />
            {WORKFLOW.map((w, i) => (
              <motion.div key={w.when}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.4 }}
                className="text-center relative"
              >
                <div className="mx-auto mb-4 h-9 w-9 rounded-full bg-black text-white flex items-center justify-center text-xs font-black relative z-10">{i + 1}</div>
                <p className="text-[10px] font-black text-[var(--brand-primary)] uppercase tracking-widest mb-2">{w.when}</p>
                <h3 className="font-bold text-black mb-2">{w.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{w.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── 5. PRODUCT CAPABILITIES ── */}
        <section id="capabilities" className="px-8 md:px-16 py-16 scroll-mt-28">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center mb-3">What you can do</p>
          <h2 className="text-2xl md:text-3xl font-bold text-black text-center mb-14 max-w-lg mx-auto">
            Score → Rewrite → Practice → Review → Track
          </h2>

          <div className="relative grid grid-cols-2 sm:grid-cols-5 gap-6 mb-16">
            <div className="hidden sm:block absolute top-[26px] left-[10%] right-[10%] h-px bg-slate-200" />
            {CAPABILITIES.map((c, i) => (
              <motion.button key={c.label}
                onClick={() => navigate(c.to)}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4 }}
                className="relative flex flex-col items-center text-center group"
              >
                <div className="h-[52px] w-[52px] rounded-2xl bg-white border-2 border-slate-200 group-hover:border-[var(--brand-primary)] flex items-center justify-center text-xl relative z-10 transition-colors shadow-sm">
                  {c.icon}
                </div>
                <p className="text-xs font-bold text-black mt-3">{c.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{c.desc}</p>
              </motion.button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {MORE_CAPABILITIES.map((c, i) => (
              <motion.button key={c.title}
                onClick={() => navigate(c.to)}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4 }}
                className="text-left bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl p-5 transition-all"
              >
                <div className="text-lg mb-2">{c.icon}</div>
                <h3 className="font-bold text-black text-sm mb-1.5">{c.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{c.desc}</p>
              </motion.button>
            ))}
          </div>
        </section>

        {/* ── 6. PROOF ── */}
        <section id="proof" className="px-8 md:px-16 py-16 scroll-mt-28">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center mb-3">Why trust it</p>
          <h2 className="text-2xl md:text-3xl font-bold text-black text-center mb-14 max-w-lg mx-auto">
            We don't have customer logos yet. Here's what we show you instead.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
            <div className="bg-slate-50 rounded-2xl p-7">
              <div className="text-xl mb-3">🔍</div>
              <h3 className="font-bold text-black mb-2">The scoring math is specific, not vague</h3>
              <p className="text-slate-500 text-sm leading-relaxed">100 points, 7 components, clamped against CGPA benchmarks and real market standards — not a black-box number.</p>
            </div>
            <button onClick={() => navigate('/changelog')} className="text-left bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl p-7 transition-all">
              <div className="text-xl mb-3">🛠️</div>
              <h3 className="font-bold text-black mb-2">We publish everything we ship</h3>
              <p className="text-slate-500 text-sm leading-relaxed">A public changelog of real fixes and features, not a highlight reel. <span className="text-[var(--brand-primary)] font-semibold">See the changelog →</span></p>
            </button>
          </div>

          <div className="max-w-2xl mx-auto flex flex-col divide-y divide-slate-100 border-t border-b border-slate-100">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="group py-5">
                <summary className="flex items-center justify-between cursor-pointer list-none text-black font-semibold text-[15px]">
                  {q}
                  <svg className="w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-45 flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </summary>
                <p className="text-slate-500 text-sm leading-relaxed mt-3 pr-8">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── 7. OUTCOME ── */}
        <section className="px-8 md:px-16 py-16">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center mb-3">After MockMate</p>
          <h2 className="text-2xl md:text-3xl font-bold text-black text-center mb-12 max-w-lg mx-auto">
            What changes before the real interview
          </h2>
          <div className="max-w-xl mx-auto space-y-4">
            {[
              ['Guessing if your resume clears the filter', 'Knowing your ATS score before you hit submit'],
              ['Hearing tough follow-ups for the first time in the real interview', 'Already having heard them once, from the AI'],
              ['A vague sense you "did okay"', 'A scorecard that tells you exactly what to fix next'],
            ].map(([before, after]) => (
              <div key={before} className="flex items-center gap-4 text-sm">
                <span className="flex-1 text-right text-slate-400 line-through decoration-slate-300">{before}</span>
                <span className="text-[var(--brand-primary)] flex-shrink-0">→</span>
                <span className="flex-1 text-black font-semibold">{after}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── 8. CTA (breaks the frame) ── */}
      <section className="max-w-6xl mx-auto mt-10">
        <div className="rounded-[32px] bg-[var(--brand-primary)] text-center px-8 py-16 md:py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to find out where you actually stand?</h2>
          <p className="text-purple-100 mb-8 max-w-md mx-auto">Free to start. No credit card required.</p>
          <motion.button
            onClick={() => navigate('/setup')}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            className="bg-white text-[var(--brand-primary)] font-bold px-8 py-3.5 rounded-full hover:bg-purple-50 transition-colors"
          >
            Start Free Practice
          </motion.button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
