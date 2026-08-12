import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const CHANNELS = [
  {
    icon: '✉️',
    title: 'Email support',
    desc: 'For account issues, billing questions, or anything that isn\'t working right — this is read by the team, not a bot.',
    cta: 'support@mockmate.live',
    href: 'mailto:support@mockmate.live',
  },
  {
    icon: '🐞',
    title: 'Found a bug?',
    desc: 'Tell us what you were doing, what you expected, and what happened instead — screenshots help a lot.',
    cta: 'support@mockmate.live',
    href: 'mailto:support@mockmate.live?subject=Bug%20report',
  },
];

export default function ContactPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen pt-32 pb-20 px-6 overflow-x-hidden bg-[#fafafa]">
      <Navbar />

      <header className="max-w-2xl mx-auto text-center mb-16">
        <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-6">
          👋 Contact
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-black mb-6 leading-[1.1]">
          Talk to us
        </h1>
        <p className="text-slate-500 text-lg leading-relaxed">
          One inbox, checked by the people actually building MockMate — not a support queue.
        </p>
      </header>

      <section className="max-w-2xl mx-auto mb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {CHANNELS.map((c, i) => (
            <motion.a
              key={c.title}
              href={c.href}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4 }}
              className="bg-white border border-black/[0.03] rounded-3xl p-7 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="h-11 w-11 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-lg mb-4">{c.icon}</div>
              <h3 className="font-bold text-black mb-2">{c.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4 flex-1">{c.desc}</p>
              <span className="text-sm font-bold text-[var(--brand-primary)]">{c.cta} →</span>
            </motion.a>
          ))}
        </div>
      </section>

      <section className="max-w-2xl mx-auto mb-20 text-center">
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-3xl p-8">
          <h3 className="text-lg font-bold text-black mb-2">Have a question about pricing or a plan for your college/company?</h3>
          <p className="text-slate-500 text-sm mb-5">Check the Team plan details, or just email us — same inbox either way.</p>
          <button onClick={() => navigate('/pricing')} className="btn-primary-solid text-sm px-6 py-2.5">
            View Pricing
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
