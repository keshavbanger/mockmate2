import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';

// ─── Scroll Reveal Hook (Intersection Observer) ──────────────────────────────
function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('is-visible'); obs.unobserve(el); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── Parallax Hook (scroll-linked transform) ──────────────────────────────────
function useParallax(distance = 60) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const raw = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const y   = useSpring(raw, { stiffness: 80, damping: 20, mass: 0.6 });
  return { ref, y };
}

// ─── Scroll-linked Reveal (motion while scrolling) ───────────────────────────
function ScrollCard({ children, className = '', fromX = 0, fromY = 40, delay = 0 }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.95', 'start 0.35'] });
  const rawY  = useTransform(scrollYProgress, [0, 1], [fromY, 0]);
  const rawX  = useTransform(scrollYProgress, [0, 1], [fromX, 0]);
  const rawOp = useTransform(scrollYProgress, [0, 0.6], [0, 1]);
  const y  = useSpring(rawY,  { stiffness: 90, damping: 22 });
  const x  = useSpring(rawX,  { stiffness: 90, damping: 22 });
  const opacity = useSpring(rawOp, { stiffness: 90, damping: 22 });
  return (
    <motion.div ref={ref} style={{ y, x, opacity }} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Sticky Showcase ──────────────────────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    title: 'Upload your resume',
    desc: 'Drop your PDF and MockMate instantly parses your skills, experience, and education to build a custom interview — no manual input needed.',
    icon: '📄',
    color: 'bg-purple-100 text-purple-600',
    visual: (
      <div className="w-full h-full flex flex-col gap-4 p-6">
        <div className="h-8 w-1/3 bg-purple-100 rounded-lg" />
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div className="h-3 bg-slate-100 rounded w-2/3" />
          <div className="h-3 bg-purple-100 rounded w-1/2" />
          <div className="h-3 bg-slate-100 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-1/3" />
          <div className="mt-4 flex gap-2 flex-wrap">
            {['React', 'Python', 'FastAPI', 'AI/ML', 'SQL'].map(s => (
              <span key={s} className="px-3 py-1 bg-purple-50 border border-purple-100 rounded-full text-xs font-semibold text-purple-600">{s}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-xs text-purple-600 font-semibold">Resume parsed successfully</span>
        </div>
      </div>
    ),
  },
  {
    num: '02',
    title: 'Practice with live AI',
    desc: 'Face a real conversational AI interviewer that listens, responds, and adapts — asking follow-ups just like a human would.',
    icon: '🎤',
    color: 'bg-indigo-100 text-indigo-600',
    visual: (
      <div className="w-full h-full flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Live Session</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Q 3 / 8</span>
        </div>
        <div className="flex-1 bg-[var(--brand-primary)] rounded-2xl p-4 flex flex-col justify-end gap-2">
          <div className="bg-white/15 rounded-xl p-3 space-y-1.5">
            <div className="h-2 bg-white/50 rounded w-full" />
            <div className="h-2 bg-white/50 rounded w-5/6" />
            <div className="h-2 bg-white/50 rounded w-3/4" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 space-y-1.5">
          <div className="h-2 bg-slate-100 rounded w-full" />
          <div className="h-2 bg-slate-100 rounded w-2/3" />
        </div>
      </div>
    ),
  },
  {
    num: '03',
    title: 'Get your report',
    desc: 'Receive a detailed AI-generated scorecard: per-question feedback, confidence metrics, filler word timeline, and coaching tips.',
    icon: '📊',
    color: 'bg-violet-100 text-violet-600',
    visual: (
      <div className="w-full h-full flex flex-col gap-3 p-6">
        <div className="h-6 bg-slate-100 rounded w-1/3 mb-1" />
        {[['Overall Score', '8.4', 'bg-purple-400', 'w-5/6'],
          ['Communication', '7.9', 'bg-indigo-400', 'w-3/4'],
          ['Confidence',    '8.8', 'bg-violet-400', 'w-5/6'],
          ['Technical',     '7.2', 'bg-purple-300', 'w-2/3'],
        ].map(([label, val, col, w]) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 w-24 flex-shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${col} rounded-full ${w}`} />
            </div>
            <span className="text-xs font-black text-black w-8 text-right">{val}</span>
          </div>
        ))}
      </div>
    ),
  },
];

function StickyShowcase() {
  const [activeStep, setActiveStep] = useState(0);

  // Auto-advance every 3s when user isn't hovering
  const [hovering, setHovering] = useState(false);
  useEffect(() => {
    if (hovering) return;
    const t = setInterval(() => setActiveStep(s => (s + 1) % STEPS.length), 3000);
    return () => clearInterval(t);
  }, [hovering]);

  return (
    <section className="max-w-6xl mx-auto mb-32 px-6">
      <RevealSection className="text-center mb-12">
        <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-4">🔄 How It Works</span>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-4">From resume to report <br/> in three steps</h2>
        <p className="text-slate-500 max-w-xl mx-auto">No complicated setup. Just upload, practice, and improve.</p>
      </RevealSection>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Left: step list */}
        <div className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              onMouseEnter={() => setActiveStep(i)}
              onClick={() => setActiveStep(i)}
              animate={{ opacity: activeStep === i ? 1 : 0.4, x: activeStep === i ? 0 : -6 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={`flex gap-4 p-5 rounded-2xl border cursor-pointer select-none transition-colors duration-200 ${
                activeStep === i ? 'bg-white border-purple-100 shadow-md' : 'bg-transparent border-transparent hover:bg-white/60'
              }`}
            >
              <div className={`h-11 w-11 rounded-xl flex-shrink-0 flex items-center justify-center text-lg ${step.color}`}>{step.icon}</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{step.num}</span>
                  <h3 className="text-base font-bold text-black">{step.title}</h3>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Right: visual panel */}
        <div className="relative h-[340px] bg-white rounded-3xl border border-slate-100 shadow-lg overflow-hidden">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              className="absolute inset-0"
              animate={{ opacity: activeStep === i ? 1 : 0, y: activeStep === i ? 0 : 14 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {step.visual}
            </motion.div>
          ))}
          {/* Dot indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setActiveStep(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${activeStep === i ? 'w-6 bg-purple-500' : 'w-1.5 bg-slate-200 hover:bg-slate-300'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


// ─── Navbar ───────────────────────────────────────────────────────────────────
// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4 pointer-events-none"
    >
      <nav className={`w-full max-w-5xl pointer-events-auto floating-nav justify-between transition-all duration-300 ${
        scrolled ? 'shadow-[0_8px_30px_rgba(0,0,0,0.08)] bg-white/95 backdrop-blur-xl' : 'shadow-[0_4px_20px_rgba(0,0,0,0.04)] bg-white/80'
      }`}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white text-sm font-bold">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
          </div>
          <span className="font-bold tracking-tight text-xl text-black">MockMate</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-[13.5px] font-semibold text-slate-500">
          {[
            { label: 'Home', href: '#' },
            { label: 'Features', href: '#features' },
            { label: 'How It Works', href: '#how-it-works' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'About', href: '#' },
          ].map(({ label, href }) => (
          <a key={label} href={href}
            className={`relative transition-colors hover:text-[#111] ${label === 'Home' ? 'text-[var(--brand-primary)]' : ''}`}>
            {label}
            {label === 'Home' && (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4/5 h-[2px] bg-[var(--brand-primary)] rounded-full" />
            )}
          </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Analyze Resume — outlined pill */}
          <motion.button
            onClick={() => navigate('/ats')}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full text-[13px] font-bold 
                       border-[1.5px] border-[var(--brand-primary)] text-[var(--brand-primary)]
                       hover:bg-[var(--brand-light)] transition-colors"
          >
            ✦ Analyze Resume
          </motion.button>

          {/* Practice Now — gradient CTA */}
          <motion.button
            onClick={() => navigate('/setup')}
            whileHover={{ scale: 1.04, boxShadow: '0 8px 24px rgba(107,70,193,0.3)' }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 px-6 py-2 rounded-full text-[13px] font-bold text-white
                       bg-gradient-to-r from-[#6B46C1] to-[#5b3da6] shadow-md shadow-purple-900/20 transition-all duration-200"
          >
            Practice Now
            <motion.span
              animate={{ x: [0, 3, 0] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
              className="inline-block font-medium"
            >
              →
            </motion.span>
          </motion.button>
        </div>
      </nav>
    </motion.div>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({ title, desc, icon, colorClass = 'bg-purple-100 text-purple-600', delay = 0 }) {
  const ref = useRef(null);
  const revealRef = useScrollReveal();

  const handleMouseMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
    el.style.transform = `perspective(800px) rotateY(${x}deg) rotateX(${y}deg) scale(1.02)`;
    el.style.boxShadow = `${-x}px ${y}px 40px rgba(107,70,193,0.12)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
    el.style.boxShadow = '';
  }, []);

  return (
    <div ref={revealRef} className="scroll-reveal" style={{ transitionDelay: `${delay}ms` }}>
      <div ref={ref} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
        className="card-tilt bg-white border border-black/[0.03] rounded-3xl p-8 shadow-sm flex flex-col items-start h-full">
        <div className={`h-12 w-12 rounded-xl mb-6 flex items-center justify-center text-xl ${colorClass}`}>{icon}</div>
        <h3 className="text-xl font-bold mb-3 leading-snug text-black">{title}</h3>
        <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ─── Dashboard Mockup ─────────────────────────────────────────────────────────
function InterviewMockup() {
  const ref = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -6;
    el.style.transform = `perspective(1200px) rotateY(${x}deg) rotateX(${y}deg)`;
    el.style.boxShadow = `0 ${20 + Math.abs(y)}px ${60 + Math.abs(x)}px rgba(107,70,193,0.1)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
    el.style.boxShadow = '0 20px 50px rgba(0,0,0,0.05)';
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-5xl mx-auto mb-20 relative z-10"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={ref}
        style={{ transition: 'transform 0.15s ease, box-shadow 0.15s ease', willChange: 'transform' }}
        className="w-full bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Top Bar */}
        <div className="h-14 border-b border-slate-100 flex items-center px-6 justify-between bg-slate-50/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>
          <span className="font-semibold text-black text-sm">MockMate — Live Interview Session</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">Live</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row" style={{ minHeight: '320px' }}>
          {/* AI Interviewer Panel */}
          <div className="md:w-1/2 bg-[var(--brand-primary)] p-8 flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">AI</div>
              <div>
                <div className="h-2.5 bg-white/40 rounded w-20 mb-1.5" />
                <div className="h-2 bg-white/20 rounded w-14" />
              </div>
            </div>
            {/* Question bubble */}
            <div className="bg-white/15 rounded-2xl rounded-tl-sm p-4 backdrop-blur-sm">
              <div className="space-y-2">
                <div className="h-2.5 bg-white/50 rounded w-full" />
                <div className="h-2.5 bg-white/50 rounded w-5/6" />
                <div className="h-2.5 bg-white/50 rounded w-4/6" />
              </div>
            </div>
            {/* Progress dots */}
            <div className="flex gap-1.5 mt-auto">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= 2 ? 'bg-white/80' : 'bg-white/20'}`} />
              ))}
            </div>
          </div>

          {/* Candidate Panel */}
          <div className="md:w-1/2 p-8 bg-slate-50/40 flex flex-col gap-4">
            {/* Webcam placeholder */}
            <div className="flex-1 bg-slate-200 rounded-2xl flex items-center justify-center relative overflow-hidden" style={{ minHeight: '120px' }}>
              <div className="text-slate-400 text-sm font-medium">📹 Camera Feed</div>
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-full">
                <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-white text-[10px] font-bold">Recording</span>
              </div>
            </div>
            {/* Transcript */}
            <div className="space-y-2">
              <div className="h-2 bg-purple-100 rounded w-full" />
              <div className="h-2 bg-purple-100 rounded w-4/5" />
              <div className="h-2 bg-slate-100 rounded w-3/5" />
            </div>
            {/* Score bars */}
            <div className="grid grid-cols-3 gap-2 mt-auto">
              {['Clarity', 'Confidence', 'Depth'].map((label, i) => (
                <div key={label} className="bg-white rounded-xl p-2 border border-slate-100 shadow-sm">
                  <div className="text-[8px] font-bold text-slate-400 uppercase mb-1">{label}</div>
                  <motion.div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-purple-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${[78, 85, 70][i]}%` }}
                      transition={{ delay: 1 + i * 0.15, duration: 0.8, ease: 'easeOut' }}
                    />
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#fafafa] to-transparent pointer-events-none" />
    </motion.div>
  );
}

// ─── Logo Marquee ─────────────────────────────────────────────────────────────
const LOGOS = ['Google', 'Amazon', 'Microsoft', 'Meta', 'Stripe', 'Notion', 'Vercel', 'Figma', 'OpenAI', 'Atlassian'];

function LogoMarquee() {
  const items = [...LOGOS, ...LOGOS];
  return (
    <div className="overflow-hidden">
      <div className="marquee-track gap-16 items-center">
        {items.map((name, i) => (
          <span key={i}
            className="font-bold text-base tracking-tight text-slate-400 hover:text-slate-600 transition-colors duration-300 flex-shrink-0 select-none cursor-default">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Reveal Section (scroll-linked motion) ───────────────────────────────────
function RevealSection({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.92', 'start 0.4'] });
  const rawY  = useTransform(scrollYProgress, [0, 1], [32, 0]);
  const rawOp = useTransform(scrollYProgress, [0, 0.7], [0, 1]);
  const y  = useSpring(rawY,  { stiffness: 85, damping: 20 });
  const opacity = useSpring(rawOp, { stiffness: 85, damping: 20 });
  return (
    <motion.div ref={ref} style={{ y, opacity }} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const { scrollYProgress: pageScroll } = useScroll();

  // Parallax blobs — move at different rates for depth
  const blob1Y = useTransform(pageScroll, [0, 1], [0, -180]);
  const blob2Y = useTransform(pageScroll, [0, 1], [0, -80]);
  const heroY  = useTransform(pageScroll, [0, 0.3], [0, -40]);
  const heroOp = useTransform(pageScroll, [0, 0.25], [1, 0]);

  return (
    <div ref={pageRef} className="relative min-h-screen pt-32 pb-20 px-6 overflow-x-hidden bg-[#fafafa]">
      <Navbar />

      {/* Parallax background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <motion.div style={{ y: blob1Y }}
          className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-200/20 rounded-full blur-[120px]" />
        <motion.div style={{ y: blob2Y }}
          className="absolute top-1/2 -left-60 w-[500px] h-[500px] bg-indigo-200/15 rounded-full blur-[100px]" />
      </div>

      {/* ── Hero (scroll-parallax) ── */}
      <motion.header
        style={{ y: heroY, opacity: heroOp }}
        className="max-w-4xl mx-auto text-center mb-16 relative z-10"
      >
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-3 bg-white border border-slate-200 text-slate-500 text-xs font-semibold px-2 py-1 rounded-full mb-8 shadow-sm"
        >
          <span className="bg-[var(--brand-primary)] text-white px-3 py-0.5 rounded-full text-[10px] uppercase tracking-wider">New</span>
          <span className="pr-2">AI Emotion Tracking 2.0 is live</span>
        </motion.div>

        <div className="hero-title mb-6 overflow-hidden">
          <motion.span className="block"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}>
            Ace Every Interview With
          </motion.span>
          <motion.span className="block"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            Your AI Coach,{' '}
            <span className="gradient-text">MockMate.</span>
          </motion.span>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-slate-500 text-lg max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Practice real interviews with a live AI interviewer, get instant feedback on your answers,
          tone, and confidence — then walk into every interview ready.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          <motion.button
            onClick={() => navigate('/setup')}
            whileHover={{ scale: 1.04, boxShadow: '0 16px 40px rgba(107,70,193,0.30)' }}
            whileTap={{ scale: 0.96 }}
            className="btn-primary-solid btn-lift"
          >
            Start Free Practice
          </motion.button>
          <motion.button
            whileHover={{ x: 4 }}
            transition={{ type: 'spring', stiffness: 400 }}
            className="flex items-center gap-2 text-black font-semibold hover:text-[var(--brand-primary)] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs">▶</div>
            <span>Watch how it works</span>
          </motion.button>
        </motion.div>
      </motion.header>

      {/* ── Interview Mockup ── */}
      <InterviewMockup />

      {/* ── Thread Story ── */}
      {/* removed — now PageThread background */}

      {/* ── Companies Marquee ── */}
      <RevealSection className="max-w-5xl mx-auto mb-32 border-b border-slate-100 pb-12">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <span className="text-sm font-bold text-slate-500 flex-shrink-0 max-w-[160px] text-center md:text-left">
            Used by candidates targeting
          </span>
          <div className="flex-1 overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#fafafa] to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#fafafa] to-transparent z-10" />
            <LogoMarquee />
          </div>
        </div>
      </RevealSection>

      {/* ── Sticky Showcase ── */}
      <StickyShowcase />

      {/* ── Pain Points ── */}
      <section className="max-w-6xl mx-auto mb-32">
        <RevealSection className="text-center mb-16">
          <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-4">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg>
            Why MockMate
          </span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-6">
            Interview prep shouldn't <br/> feel like guesswork
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg">
            Most candidates rehearse alone with no real feedback. MockMate gives you a live AI interviewer,
            real-time analysis, and a detailed performance report — every session.
          </p>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ScrollCard fromX={-30} fromY={20}>
            <FeatureCard
              title="No honest feedback from friends or family"
              desc="They're too kind. Our AI gives you direct, unbiased feedback on every answer — just like a real interviewer."
              icon="🎯"
              colorClass="bg-purple-100 text-purple-600"
            />
          </ScrollCard>
          <ScrollCard fromY={40}>
            <FeatureCard
              title="Can't replicate real interview pressure"
              desc="MockMate's live AI persona creates genuine conversational pressure so you're prepared for anything."
              icon="⚡"
              colorClass="bg-orange-100 text-orange-600"
            />
          </ScrollCard>
          <ScrollCard fromX={30} fromY={20}>
            <FeatureCard
              title="No insight into body language or tone"
              desc="We analyze your emotion, confidence, and speech patterns in real time — not just what you say, but how."
              icon="📊"
              colorClass="bg-indigo-100 text-indigo-600"
            />
          </ScrollCard>
        </div>
      </section>

      {/* ── Feature Detail Section ── */}
      <section className="max-w-5xl mx-auto mb-20">
        <RevealSection className="text-center mb-16">
          <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-4">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg>
            Full Interview Suite
          </span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-6">
            Everything you need to <br/> land the offer
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg">
            From resume parsing to post-interview reports — MockMate covers the entire
            interview prep lifecycle in one seamless platform.
          </p>
        </RevealSection>

        <RevealSection>
          <div className="bg-white border border-slate-100 rounded-[32px] p-10 md:p-14 flex flex-col md:flex-row items-center gap-12 shadow-sm hover:shadow-[0_20px_60px_rgba(107,70,193,0.08)] transition-shadow duration-500">
            <div className="flex-1 text-left">
              <h3 className="text-2xl font-bold mb-4">AI-Powered Performance Reports</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">
                After every session, receive a detailed breakdown of your scores across communication,
                confidence, technical depth, and more — with personalized coaching tips.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  'Per-question scoring with AI feedback',
                  'Emotion & confidence analysis via webcam',
                  'Filler word detection and speech pace tracking',
                ].map((item, i) => (
                  <motion.li key={i}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className="flex items-center gap-3 text-sm text-slate-600 font-medium"
                  >
                    <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                    {item}
                  </motion.li>
                ))}
              </ul>
              <motion.button
                onClick={() => navigate('/setup')}
                whileHover={{ scale: 1.04, boxShadow: '0 12px 32px rgba(107,70,193,0.28)' }}
                whileTap={{ scale: 0.97 }}
                className="btn-primary-solid px-6 py-2.5 text-sm"
              >
                Try a Free Session
              </motion.button>
            </div>

            {/* Report Preview Card */}
            <div className="flex-1 w-full bg-[var(--brand-light)] rounded-2xl relative overflow-hidden flex items-center justify-center border border-slate-100 p-8 min-h-[260px]">
              <div className="w-full bg-white rounded-xl shadow-md border border-slate-200 p-5">
                <div className="h-3 bg-slate-100 w-1/3 rounded mb-5" />
                <div className="space-y-3">
                  {[
                    { label: 'Overall Score', color: 'bg-purple-200', w: 'w-4/5' },
                    { label: 'Communication', color: 'bg-indigo-200', w: 'w-3/4' },
                    { label: 'Confidence', color: 'bg-purple-100', w: 'w-5/6' },
                    { label: 'Technical Depth', color: 'bg-slate-100', w: 'w-2/3' },
                  ].map(({ label, color, w }, i) => (
                    <motion.div key={label}
                      initial={{ opacity: 0, x: 12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
                      className="flex justify-between items-center gap-3"
                    >
                      <div className="h-2 bg-slate-100 w-1/3 rounded" />
                      <div className={`h-2.5 ${color} ${w} rounded-full`} />
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className="absolute top-0 right-0 w-40 h-40 bg-[var(--brand-primary)]/15 rounded-full blur-[50px]" />
            </div>
          </div>
        </RevealSection>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════════════════════ */}
      <section id="features" className="max-w-6xl mx-auto mb-32">
        <RevealSection className="text-center mb-16">
          <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-4">✨ Features</span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-6">Built for serious <br/> interview preparation</h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg">Every feature is designed to simulate a real interview — and help you improve faster.</p>
        </RevealSection>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { icon: '🤖', title: 'Live AI Interviewer', desc: 'Powered by Tavus CVI, our AI interviewer asks dynamic follow-up questions based on your responses, just like a real hiring manager.', color: 'bg-purple-100 text-purple-600' },
            { icon: '📄', title: 'Smart Resume Parsing', desc: 'Upload your PDF resume and MockMate auto-generates role-specific questions tailored to your skills, experience, and target role.', color: 'bg-indigo-100 text-indigo-600' },
            { icon: '😊', title: 'Real-Time Emotion Analysis', desc: 'MediaPipe-powered facial tracking detects your confidence, nervousness, and engagement throughout the interview.', color: 'bg-orange-100 text-orange-600' },
            { icon: '🎙️', title: 'Speech & Filler Word Detection', desc: 'We track words per minute, pause frequency, and filler words like "um" — and show you exactly when they happened.', color: 'bg-pink-100 text-pink-600' },
            { icon: '📊', title: 'Detailed Performance Reports', desc: 'Get a full scorecard after every session: overall score, per-question feedback, behavioral analysis charts, and actionable coaching tips.', color: 'bg-blue-100 text-blue-600' },
            { icon: '🌐', title: 'Multi-Language Support', desc: 'Practice in English, Hindi, or Hinglish. Choose your language and difficulty level before every session.', color: 'bg-teal-100 text-teal-600' },
          ].map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}
              className="bg-white border border-black/[0.03] rounded-3xl p-8 shadow-sm hover:shadow-md transition-all duration-300 flex gap-5 items-start">
              <div className={`h-12 w-12 rounded-xl flex-shrink-0 flex items-center justify-center text-xl ${f.color}`}>{f.icon}</div>
              <div>
                <h3 className="text-lg font-bold mb-2 text-black">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="max-w-5xl mx-auto mb-32">
        <RevealSection className="text-center mb-16">
          <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-4">🔄 How It Works</span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-6">From resume to report <br/> in three steps</h2>
          <p className="text-slate-500 max-w-xl mx-auto text-lg">No complicated setup. Just upload, practice, and improve.</p>
        </RevealSection>
        <div className="relative">
          <div className="hidden md:block absolute top-16 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { step: '01', icon: '📄', title: 'Upload Your Resume', desc: 'Drop your PDF resume. Our AI instantly parses your skills and experience to create a personalized interview session.', color: 'bg-purple-100 text-purple-600' },
              { step: '02', icon: '🎤', title: 'Practice Live', desc: 'Face your AI interviewer. Answer naturally while we analyze your confidence, clarity, and technical depth in real time.', color: 'bg-indigo-100 text-indigo-600' },
              { step: '03', icon: '📈', title: 'Review & Improve', desc: 'Get a detailed report with scores, AI feedback per question, emotion charts, and filler word timelines.', color: 'bg-violet-100 text-violet-600' },
            ].map((s, i) => (
              <motion.div key={s.step}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.15, duration: 0.5 }}
                className="flex flex-col items-center text-center">
                <div className="relative mb-8">
                  <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-2xl ${s.color} shadow-sm`}>{s.icon}</div>
                  <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-black text-white text-[10px] font-black flex items-center justify-center">{s.step}</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-black">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ═════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="max-w-5xl mx-auto mb-32">
        <RevealSection className="text-center mb-16">
          <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-4">💳 Pricing</span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-6">Simple, transparent pricing</h2>
          <p className="text-slate-500 max-w-xl mx-auto text-lg">Start free. Upgrade when you're ready. No hidden fees.</p>
        </RevealSection>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { name: 'Free', price: '₹0', period: 'forever', desc: 'Perfect to explore MockMate.', highlight: false, cta: 'Get Started Free',
              features: ['3 interview sessions / month', 'Resume parsing', 'Basic performance report', 'English only'] },
            { name: 'Pro', price: '₹499', period: 'per month', desc: 'For candidates actively preparing.', highlight: true, cta: 'Start Pro',
              features: ['Unlimited sessions', 'All interview types & difficulties', 'Full emotion + speech analysis', 'Multi-language support', 'Per-question AI feedback', 'Filler word timeline'] },
            { name: 'Team', price: '₹1,999', period: 'per month', desc: 'For colleges and coaching institutes.', highlight: false, cta: 'Contact Us',
              features: ['Up to 20 users', 'Everything in Pro', 'Admin dashboard', 'Bulk report exports', 'Priority support'] },
          ].map((plan, i) => (
            <motion.div key={plan.name}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -4, boxShadow: plan.highlight ? '0 24px 60px rgba(107,70,193,0.20)' : '0 12px 40px rgba(0,0,0,0.06)' }}
              className={`relative h-full rounded-3xl p-8 flex flex-col border transition-all duration-300 ${plan.highlight ? 'bg-[var(--brand-primary)] text-white border-purple-500 shadow-xl shadow-purple-900/20' : 'bg-white border-black/[0.04] shadow-sm'}`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full">Most Popular</div>
              )}
              <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${plan.highlight ? 'text-purple-200' : 'text-slate-400'}`}>{plan.name}</p>
              <div className="flex items-end gap-1 mb-2">
                <span className={`text-5xl font-black tracking-tighter ${plan.highlight ? 'text-white' : 'text-black'}`}>{plan.price}</span>
                <span className={`text-sm mb-2 ${plan.highlight ? 'text-purple-200' : 'text-slate-400'}`}>/ {plan.period}</span>
              </div>
              <p className={`text-sm mb-6 ${plan.highlight ? 'text-purple-100' : 'text-slate-500'}`}>{plan.desc}</p>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-purple-200' : 'text-purple-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                    <span className={plan.highlight ? 'text-purple-100' : 'text-slate-600'}>{f}</span>
                  </li>
                ))}
              </ul>
              <motion.button onClick={() => navigate('/setup')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className={`w-full py-3 rounded-full font-semibold text-sm transition-all ${plan.highlight ? 'bg-white text-[var(--brand-primary)] hover:bg-purple-50' : 'bg-black text-white hover:bg-zinc-800'}`}>
                {plan.cta}
              </motion.button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════════ */}
      <footer className="relative mt-32 overflow-hidden border-t border-slate-100 bg-[#fafafa]">

        {/* Giant watermark brand name */}
        <div className="pointer-events-none select-none absolute inset-0 flex items-end justify-center overflow-hidden">
          <span
            className="font-black text-[clamp(80px,18vw,220px)] leading-none tracking-tighter text-black/[0.04] pb-0 translate-y-[20%]"
            aria-hidden="true"
          >
            MockMate
          </span>
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-12">
          {/* Top grid */}
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-16 mb-20">

            {/* Left: brand info */}
            <div className="flex flex-col gap-6">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                  </svg>
                </div>
                <span className="font-bold tracking-tight text-xl text-black">MockMate</span>
              </div>

              {/* Address */}
              <p className="text-slate-500 text-sm leading-relaxed">
                AI-Powered Interview Coach<br />
                Bangalore, India 560001
              </p>

              {/* Social icons */}
              <div className="flex items-center gap-3">
                {[
                  { label: 'X / Twitter', icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  )},
                  { label: 'GitHub', icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                  )},
                  { label: 'LinkedIn', icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  )},
                  { label: 'YouTube', icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  )},
                ].map(({ label, icon }) => (
                  <a key={label} href="#" aria-label={label}
                    className="h-8 w-8 rounded-lg border border-black/[0.06] bg-white flex items-center justify-center text-slate-400 hover:text-[var(--brand-primary)] hover:border-purple-200 hover:bg-purple-50 transition-all duration-200 shadow-sm">
                    {icon}
                  </a>
                ))}
              </div>

              {/* Status pill */}
              <div className="inline-flex items-center gap-2 bg-white border border-black/[0.05] rounded-full px-4 py-2 shadow-sm w-fit">
                <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-xs font-semibold text-slate-600">All systems operational</span>
              </div>
            </div>

            {/* Right: link columns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-10">
              {[
                {
                  heading: 'Product',
                  links: ['AI Interviewer', 'Resume Parsing', 'Emotion Analysis', 'Speech Tracking', 'Reports', 'Languages'],
                },
                {
                  heading: 'Resources',
                  links: ['Documentation', 'Changelog', 'Blog', 'Interview Tips', 'FAQs', 'Status'],
                },
                {
                  heading: 'Company',
                  links: ['About', 'Careers', 'Press', 'Customers', 'Privacy', 'Terms'],
                },
                {
                  heading: 'Support',
                  links: ['Contact Us', 'Help Center', 'Community', 'Feedback', 'Report Bug'],
                },
              ].map(({ heading, links }) => (
                <div key={heading}>
                  <p className="text-xs font-black text-black uppercase tracking-widest mb-5">{heading}</p>
                  <ul className="space-y-3">
                    {links.map((link) => (
                      <li key={link}>
                        <a href="#"
                          className="text-sm text-slate-500 hover:text-[var(--brand-primary)] transition-colors duration-200">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
