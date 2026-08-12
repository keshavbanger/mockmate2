import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const PLANS = [
  {
    name: 'Free', price: '₹0', period: 'forever', desc: 'Perfect to explore MockMate.',
    highlight: false, cta: 'Get Started Free', ctaPath: '/signup',
    features: ['3 interview sessions / month', 'Resume parsing', 'Basic performance report', 'English only'],
  },
  {
    name: 'Pro', price: '₹499', period: 'per month', desc: 'For candidates actively preparing.',
    highlight: true, cta: 'Start Pro', ctaPath: '/signup?plan=pro',
    features: [
      'Unlimited sessions', 'All interview types & difficulties', 'Full emotion + speech analysis',
      'Multi-language support', 'Per-question AI feedback', 'Filler word timeline',
    ],
  },
  {
    name: 'Team', price: '₹1,999', period: 'per month', desc: 'For colleges and coaching institutes.',
    highlight: false, cta: 'Contact Us', ctaPath: '/contact',
    features: ['Up to 20 users', 'Everything in Pro', 'Admin dashboard', 'Bulk report exports', 'Priority support'],
  },
];

const FAQS = [
  { q: 'Do I need a card to start on the Free plan?', a: 'No. Free gives you 3 full interview sessions a month with no card required — enough to try the AI interviewer, the ATS scanner, and a real report before deciding if Pro is worth it.' },
  { q: 'Can I cancel Pro anytime?', a: 'Yes, there’s no lock-in contract. Cancel whenever and you’ll keep Pro access until the end of the period you already paid for.' },
  { q: 'What counts as one "session"?', a: 'One complete behavioral or technical interview run, start to finish — from setup through the final report. Practicing a single question doesn’t count as a session.' },
  { q: 'Is the Team plan billed per seat?', a: 'It’s a flat rate for up to 20 users. If you need more seats, reach out on the Contact page and we’ll work out a number that fits.' },
];

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen pt-32 pb-20 px-6 overflow-x-hidden bg-[#fafafa]">
      <Navbar />

      <header className="max-w-3xl mx-auto text-center mb-20">
        <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-6">
          💳 Pricing
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-black mb-6 leading-[1.1]">
          Simple, transparent pricing
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
          Start free. Upgrade when you're ready. No hidden fees, no surprise renewals.
        </p>
      </header>

      <section className="max-w-5xl mx-auto mb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan, i) => (
            <motion.div key={plan.name}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}
              className={`relative h-full rounded-3xl p-8 flex flex-col border transition-shadow duration-300 ${
                plan.highlight
                  ? 'bg-[var(--brand-primary)] text-white border-purple-500 shadow-xl shadow-purple-900/20'
                  : 'bg-white border-black/[0.04] shadow-sm hover:shadow-md'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full">
                  Most Popular
                </div>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className={plan.highlight ? 'text-purple-100' : 'text-slate-600'}>{f}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate(plan.ctaPath)}
                className={`w-full py-3 rounded-full font-semibold text-sm transition-all active:scale-[0.98] ${
                  plan.highlight ? 'bg-white text-[var(--brand-primary)] hover:bg-purple-50' : 'bg-black text-white hover:bg-zinc-800'
                }`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto mb-32">
        <h2 className="text-2xl font-bold text-black mb-10 text-center">Questions about pricing</h2>
        <div className="flex flex-col divide-y divide-slate-100 border-t border-b border-slate-100">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group py-5">
              <summary className="flex items-center justify-between cursor-pointer list-none text-black font-semibold text-[15px]">
                {q}
                <svg className="w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </summary>
              <p className="text-slate-500 text-sm leading-relaxed mt-3 pr-8">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
