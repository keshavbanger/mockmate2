import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

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
    <motion.div ref={ref} style={{ y, x, opacity }} className={`scroll-card ${className}`}>
      {children}
    </motion.div>
  );
}

// ─── Sticky Showcase ──────────────────────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    title: 'Scan & Optimize Resume',
    desc: 'Drop your PDF to get an instant ATS score. Generate a fully optimized, keyword-rich resume using our AI before your interview.',
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
          <span className="text-xs text-purple-600 font-semibold">ATS Score: 95/100 — Optimized</span>
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
    <section id="how-it-works" className="max-w-6xl mx-auto mb-32 px-6 scroll-mt-28">
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


import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// ─── Feature Card ─────────────────────────────────────────────────────────────
// Plain CSS hover, not a JS mouse-tilt — the hero mockup below is the one
// deliberate 3D-tilt moment on the page; scattering the same effect across
// every card does nothing on touch devices and reads as busier, not premium.
function FeatureCard({ title, desc, icon, colorClass = 'bg-purple-100 text-purple-600', delay = 0 }) {
  const revealRef = useScrollReveal();

  return (
    <div ref={revealRef} className="scroll-reveal" style={{ transitionDelay: `${delay}ms` }}>
      <div className="bg-white border border-black/[0.03] rounded-3xl p-8 shadow-sm flex flex-col items-start h-full transition-shadow duration-300 hover:shadow-[0_20px_50px_rgba(107,70,193,0.10)]">
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
      className="max-w-6xl mx-auto relative z-10"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={ref}
        style={{ transition: 'transform 0.15s ease, box-shadow 0.15s ease', willChange: 'transform' }}
        className="w-full bg-white rounded-3xl border border-slate-200 shadow-xl shadow-purple-900/[0.06] overflow-hidden flex flex-col"
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
    </motion.div>
  );
}

// ─── Floating Icon Orb (hero decoration) ──────────────────────────────────────
// Icon-only bubbles scattered around the concentric rings, representing
// MockMate's own capabilities — not third-party brand logos. Showing real
// tool logos here would wrongly imply integrations/partnerships that don't
// exist, the same problem as a fake "trusted by" strip.
function FloatingIconOrb({ className = '', icon, delay = 0, size = 'md' }) {
  const dim = size === 'lg' ? 'h-14 w-14 text-2xl' : size === 'sm' ? 'h-10 w-10 text-base' : 'h-12 w-12 text-lg';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.5 + delay, ease: [0.22, 1, 0.36, 1] }}
      className={`hidden lg:flex absolute items-center justify-center rounded-2xl bg-white border border-slate-200/80 shadow-[0_8px_24px_rgba(15,15,25,0.08)] ${dim} ${className}`}
      style={{ animation: 'float 6s ease-in-out infinite', animationDelay: `${delay}s` }}
    >
      {icon}
    </motion.div>
  );
}

// Concentric rings, centered on the headline cluster — pure CSS, no image.
// No overflow-hidden here: clipping the largest rings against a hard box
// edge left a visible flat "cut" line near the top of the hero. Rings are
// faint 1px borders on a background that matches the page, so letting them
// bleed past this box costs nothing visually.
function ConcentricRings() {
  const sizes = [260, 420, 580, 740];
  return (
    <div className="absolute inset-0 flex items-start justify-center pointer-events-none">
      <div className="relative w-0 h-0" style={{ marginTop: '90px' }}>
        {sizes.map((s) => (
          <div key={s}
            className="absolute rounded-full border border-slate-200/70"
            style={{ width: s, height: s, left: -s / 2, top: -s / 2 }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Hero Showcase ─────────────────────────────────────────────────────────
// No card/border wrapper — the hero sits directly on the page background,
// full width, so it isn't boxed in like a contained panel.
function HeroShowcase({ navigate }) {
  return (
    <div className="relative w-full mx-auto mb-32">
      <ConcentricRings />
      {/* Soft glow behind headline - extends seamlessly above hero and fades out smoothly to prevent sharp top edges */}
      <div className="absolute -top-32 inset-x-0 bottom-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_35%,rgba(107,70,193,0.08)_0%,rgba(107,70,193,0.03)_50%,transparent_100%)] pointer-events-none" />

      <div className="relative pb-6">
        {/* Floating capability icons, scattered around the rings */}
        <FloatingIconOrb className="left-[6%] top-[10%]" icon="📄" delay={0} />
        <FloatingIconOrb className="right-[8%] top-[6%]" icon="🎤" delay={0.3} size="lg" />
        <FloatingIconOrb className="left-[2%] top-[42%]" icon="💻" delay={0.6} size="sm" />
        <FloatingIconOrb className="right-[2%] top-[40%]" icon="📊" delay={0.9} />
        <FloatingIconOrb className="left-[14%] top-[58%]" icon="🎯" delay={1.2} size="sm" />

        {/* Announcement pill — real, not a fabricated user count */}
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          onClick={() => navigate('/ats')}
          className="mx-auto w-fit flex items-center gap-3 bg-white border border-slate-200 text-slate-500 text-xs font-semibold px-2 py-1 rounded-full mb-7 shadow-sm cursor-pointer hover:border-purple-200 hover:shadow-md transition-all relative z-10"
        >
          <span className="bg-[var(--brand-primary)] text-white px-3 py-0.5 rounded-full text-[10px] uppercase tracking-wider">New</span>
          <span className="pr-2">ATS Resume Builder & Analyzer is live →</span>
        </motion.div>

        {/* Headline */}
        <div className="text-center max-w-3xl mx-auto relative z-10">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 text-black">
            <motion.span className="block"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}>
              Perfect Your Resume &
            </motion.span>
            <motion.span className="block"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}>
              Ace Every Interview.
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.44 }}
            className="text-slate-500 text-base md:text-lg max-w-xl mx-auto mb-9 leading-relaxed"
          >
            AI resume scoring that doesn't inflate your score, a live AI interviewer that actually pushes back, and a real Monaco editor for DSA rounds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.56 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
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
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="btn-outline"
            >
              Watch How It Works
            </motion.button>
          </motion.div>
        </div>

        {/* Product visual */}
        <div className="mt-16">
          <InterviewMockup />
        </div>
      </div>
    </div>
  );
}

// ─── Prep Tracks ────────────────────────────────────────────────────────────
// A "trusted by" style strip, but honest: role/track labels instead of
// company logos — we don't have public customers to name yet, and a fake
// "trusted by Google/Amazon" strip is worse than no trust strip at all.
const PREP_TRACKS = [
  { label: 'Backend', icon: '⚙️' },
  { label: 'Frontend', icon: '🎨' },
  { label: 'Full Stack', icon: '🔗' },
  { label: 'Data Science', icon: '📊' },
  { label: 'DevOps', icon: '🚀' },
  { label: 'Product-style rounds', icon: '🧩' },
  { label: 'Startup interviews', icon: '⚡' },
  { label: 'DSA-heavy rounds', icon: '💻' },
];

function PrepTracks() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
      {PREP_TRACKS.map(({ label, icon }) => (
        <span key={label}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm font-bold transition-colors duration-200 cursor-default select-none">
          <span className="text-base">{icon}</span>{label}
        </span>
      ))}
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
export default function LandingPage() {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const { scrollYProgress: pageScroll } = useScroll();

  // Parallax blobs — move at different rates for depth
  const blob1Y = useTransform(pageScroll, [0, 1], [0, -180]);
  const blob2Y = useTransform(pageScroll, [0, 1], [0, -80]);
  const heroY  = useTransform(pageScroll, [0, 0.3], [0, -40]);
  const heroOp = useTransform(pageScroll, [0, 0.25], [1, 0]);

  return (
    <div ref={pageRef} className="relative min-h-screen pt-28 pb-20 px-6 overflow-x-hidden bg-[#fafafa]">
      <Navbar />

      {/* Parallax background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <motion.div style={{ y: blob1Y }}
          className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-200/20 rounded-full blur-[120px]" />
        <motion.div style={{ y: blob2Y }}
          className="absolute top-1/2 -left-60 w-[500px] h-[500px] bg-indigo-200/15 rounded-full blur-[100px]" />
      </div>

      {/* ── Hero Showcase (boxed, dot-grid) ── */}
      <motion.div style={{ y: heroY, opacity: heroOp }}>
        <HeroShowcase navigate={navigate} />
      </motion.div>

      {/* ── Thread Story ── */}
      {/* removed — now PageThread background */}

      {/* ── Prep Tracks ── */}
      <RevealSection className="max-w-4xl mx-auto mb-32 border-b border-slate-100 pb-16 text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Built for candidates prepping across</p>
        <PrepTracks />
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
            Job hunting shouldn't <br/> feel like guesswork
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg">
            Most candidates get rejected by automated filters or rehearse alone with no real feedback. MockMate gives you an ATS-optimized resume, a live AI interviewer, and a detailed performance report — all in one platform.
          </p>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ScrollCard fromX={-30} fromY={20}>
            <FeatureCard
              title="Resume gets rejected by ATS"
              desc="Don't guess what the recruiter wants. We scan your resume against the JD, find missing keywords, and auto-generate an ATS-optimized PDF/DOCX."
              icon="📄"
              colorClass="bg-indigo-100 text-indigo-600"
            />
          </ScrollCard>
          <ScrollCard fromY={40}>
            <FeatureCard
              title="No honest feedback from friends"
              desc="They're too kind. Our AI gives you direct, unbiased feedback on every answer — just like a real hiring manager."
              icon="🎯"
              colorClass="bg-purple-100 text-purple-600"
            />
          </ScrollCard>
          <ScrollCard fromX={30} fromY={20}>
            <FeatureCard
              title="Can't replicate real interview pressure"
              desc="MockMate's live AI persona creates genuine conversational pressure so you're prepared for anything."
              icon="⚡"
              colorClass="bg-orange-100 text-orange-600"
            />
          </ScrollCard>
        </div>
      </section>
      {/* ── Hard Truth ATS Scoring Callout ── */}
      <section className="max-w-6xl mx-auto mb-16 px-6">
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="h-14 w-14 rounded-2xl bg-purple-600 flex items-center justify-center text-2xl flex-shrink-0 shadow-lg shadow-purple-200">
            🎯
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-black text-purple-600 uppercase tracking-widest">Senior Recruiter Grade</span>
            </div>
            <h3 className="text-xl font-bold text-black mb-2">"Hard Truth" ATS Scoring Engine</h3>
            <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
              Our 100-point, 7-component scoring model doesn't inflate your score. We apply <strong>score-clamping</strong> based on CGPA benchmarks, content quality, and real market standards — giving you the same brutally honest assessment a senior recruiter would. No sugar-coating.
            </p>
          </div>
          <motion.button
            onClick={() => navigate('/ats')}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="btn-primary-solid text-sm px-5 py-2.5 flex-shrink-0"
          >
            Scan My Resume
          </motion.button>
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
      <section id="features" className="max-w-6xl mx-auto mb-32 scroll-mt-28">
        <RevealSection className="text-center mb-16">
          <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-4">✨ Features</span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-6">Built for serious <br/> interview preparation</h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg">Every feature is designed to simulate a real interview — and help you improve faster.</p>
        </RevealSection>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { icon: '📄', title: 'ATS Resume Scanner', desc: 'Upload your resume and get an instant ATS compatibility score, keyword gap analysis against your target Job Description, and quantification metrics.', color: 'bg-indigo-100 text-indigo-600' },
            { icon: '✍️', title: 'LaTeX Resume Studio', desc: 'Edit resume sections live in our interactive studio, apply AI bullet enhancements, and export pixel-perfect LaTeX rendered PDFs — not generic HTML templates.', color: 'bg-pink-100 text-pink-600' },
            { icon: '🤖', title: 'Live AI Interviewer', desc: 'Face a conversational AI that asks dynamic follow-up questions tailored to your resume, just like a real hiring manager.', color: 'bg-purple-100 text-purple-600' },
            { icon: '📊', title: 'Detailed Performance Reports', desc: 'Get a full scorecard after every session: overall score, per-question feedback, behavioral analysis charts, and actionable coaching tips.', color: 'bg-blue-100 text-blue-600' },
            { icon: '💻', title: 'Technical & DSA Coding Interview', desc: 'Solve DSA problems live in a Monaco code editor with Java, Python, C++, and Go support. Real sandboxed execution validates your output against hidden test cases.', color: 'bg-emerald-100 text-emerald-600' },
            { icon: '📈', title: 'ATS Resume Comparison', desc: 'Compare two resume versions side-by-side or benchmark a single resume against multiple Job Descriptions to find which version lands more interviews.', color: 'bg-violet-100 text-violet-600' },
            { icon: '🎙️', title: 'Speech & Filler Word Detection', desc: 'We track words per minute, pause frequency, and filler words like "um" — and show you exactly when they happened on a timeline.', color: 'bg-orange-100 text-orange-600' },
            { icon: '📅', title: 'Interview History & Progression', desc: 'Track all your past behavioral and technical sessions in one place. View score trends, session dates, and performance improvements over time.', color: 'bg-teal-100 text-teal-600' },
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

      {/* ══ TECHNICAL & DSA INTERVIEW ═══════════════════════════════════════════ */}
      <section id="technical-interview" className="max-w-6xl mx-auto mb-32 px-6">
        <RevealSection className="text-center mb-14">
          <span className="inline-flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold mb-4">
            💻 Technical Coding Interview
          </span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-6">
            Code. Execute. Get Scored.<br />In Real Time.
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg">
            MockMate's DSA coding environment runs your code against hidden test cases in a sandboxed execution engine — giving you real feedback like a technical round.
          </p>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Left: Feature list */}
          <div className="flex flex-col gap-5">
            {[
              { icon: '⌨️', title: 'Monaco Code Editor', desc: 'The same editor that powers VS Code. Write Java, Python, C++, JavaScript, or Go with full syntax highlighting.' },
              { icon: '⚡', title: 'Sandboxed Code Execution', desc: 'Your code runs against hidden test cases in a secure execution harness. Get pass/fail results with I/O diffs instantly.' },
              { icon: '📊', title: 'DSA Scorecard', desc: 'Graded on problem-solving approach, code readability, time & space complexity, and edge case handling.' },
              { icon: '⏩', title: '"Skip to DSA" Fast-Track', desc: 'Already aced behavioral questions? Jump straight to the coding round without sitting through the full interview flow.' },
            ].map(({ icon, title, desc }, i) => (
              <motion.div key={title}
                initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex gap-4"
              >
                <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xl flex-shrink-0">{icon}</div>
                <div>
                  <h3 className="font-bold text-black mb-1">{title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
            <motion.button
              onClick={() => navigate('/tech-interview/setup')}
              whileHover={{ scale: 1.04, boxShadow: '0 12px 32px rgba(16,185,129,0.25)' }}
              whileTap={{ scale: 0.97 }}
              className="mt-4 bg-emerald-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/15 w-fit"
            >
              Try a Coding Interview →
            </motion.button>
          </div>

          {/* Right: Code editor mockup */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="bg-[#0f1117] rounded-3xl overflow-hidden border border-white/5 shadow-2xl"
          >
            {/* Editor top bar */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-[#1a1d2e]">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-amber-400/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
              <span className="ml-3 text-white/30 text-xs font-mono">solution.py</span>
              <span className="ml-auto text-[10px] text-emerald-400/70 font-bold uppercase tracking-wider">Python</span>
            </div>
            {/* Code lines */}
            <div className="p-5 font-mono text-xs leading-6 space-y-0.5">
              <div><span className="text-purple-400">def</span><span className="text-white"> two_sum</span><span className="text-slate-400">(nums, target):</span></div>
              <div className="pl-4"><span className="text-slate-500">seen </span><span className="text-slate-400">= {}</span></div>
              <div className="pl-4"><span className="text-purple-400">for </span><span className="text-white">i, n </span><span className="text-purple-400">in </span><span className="text-emerald-400">enumerate</span><span className="text-slate-400">(nums):</span></div>
              <div className="pl-8"><span className="text-slate-500">diff = target - n</span></div>
              <div className="pl-8"><span className="text-purple-400">if </span><span className="text-white">diff </span><span className="text-purple-400">in </span><span className="text-white">seen:</span></div>
              <div className="pl-12"><span className="text-purple-400">return </span><span className="text-slate-400">[seen[diff], i]</span></div>
              <div className="pl-8"><span className="text-white">seen[n] = i</span></div>
            </div>
            {/* Execution result panel */}
            <div className="border-t border-white/5 bg-[#161922] px-5 py-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Execution Result</div>
              <div className="space-y-2">
                {[
                  { label: 'Test 1', detail: 'nums=[2,7,11,15], target=9 → [0,1]' },
                  { label: 'Test 2', detail: 'nums=[3,2,4], target=6 → [1,2]' },
                  { label: 'Test 3', detail: 'nums=[3,3], target=6 → [0,1]' },
                ].map(({ label, detail }) => (
                  <div key={label} className="flex items-center gap-3 text-xs">
                    <span className="text-emerald-400 font-bold w-10">✓ {label}</span>
                    <span className="text-slate-400 font-mono truncate">{detail}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-3">
                <span className="text-emerald-400 font-black text-sm">✔ All 3 test cases passed</span>
                <span className="ml-auto text-slate-500 text-[10px]">Runtime: 48ms · O(n) space</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ PRICING TEASER ══════════════════════════════════════════════════════ */}
      <section className="max-w-4xl mx-auto mb-32">
        <RevealSection>
          <div className="bg-white border border-slate-100 rounded-[32px] p-10 md:p-14 text-center shadow-sm">
            <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-6">💳 Pricing</span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-black mb-4">Free to start. ₹499/mo for unlimited practice.</h2>
            <p className="text-slate-500 max-w-lg mx-auto mb-8">No hidden fees, no credit card needed to try it. See the full breakdown and what's in each plan.</p>
            <motion.button
              onClick={() => navigate('/pricing')}
              whileHover={{ scale: 1.04, boxShadow: '0 16px 40px rgba(107,70,193,0.30)' }}
              whileTap={{ scale: 0.96 }}
              className="btn-primary-solid btn-lift"
            >
              View Full Pricing →
            </motion.button>
          </div>
        </RevealSection>
      </section>

      <Footer />
    </div>
  );
}
