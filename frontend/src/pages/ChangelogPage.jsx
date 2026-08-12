import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// Real entries, pulled from our own commit history and rewritten in plain
// language — not marketing copy. This page only ever says things that
// actually shipped.
const TAG_STYLES = {
  Added:    'bg-emerald-50 text-emerald-600 border-emerald-100',
  Improved: 'bg-blue-50 text-blue-600 border-blue-100',
  Fixed:    'bg-amber-50 text-amber-700 border-amber-100',
};

const ENTRIES = [
  {
    date: '2026-08-12',
    items: [
      { tag: 'Improved', text: 'Redesigned the post-login dashboard into a clearer command-center layout — stats, recent activity, and next actions all in one view.' },
      { tag: 'Added', text: 'Email verification (OTP) on sign-up, sent from our own mockmate.live domain.' },
      { tag: 'Fixed', text: 'Every technical-interview and report screen now has a reliable way back to the dashboard — a few of them previously left you stuck.' },
    ],
  },
  {
    date: '2026-08-11',
    items: [
      { tag: 'Fixed', text: 'A Java compilation bug in the technical-interview code harness that broke submissions using explicit import statements.' },
      { tag: 'Improved', text: 'Moved sandboxed code execution onto a hardened execution pipeline instead of running candidate code directly in-process.' },
      { tag: 'Improved', text: 'Landing page overhaul — new branding, a dedicated DSA/technical-interview section, and pricing fixes.' },
      { tag: 'Fixed', text: 'Backend cold-start timeouts on login now match real-world wake-up time, and the Google OAuth redirect bug is resolved.' },
      { tag: 'Fixed', text: 'Sitemap and canonical URL inconsistencies affecting search indexing.' },
    ],
  },
  {
    date: '2026-08-10',
    items: [
      { tag: 'Improved', text: 'Unified login and sign-up into a single split-screen design matching the landing page.' },
      { tag: 'Fixed', text: 'Sign-up now correctly detects existing accounts and offers to resend the verification email instead of failing silently.' },
      { tag: 'Added', text: 'SEO meta tags, sitemap, and robots.txt for mockmate.live.' },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="relative min-h-screen pt-32 pb-20 px-6 overflow-x-hidden bg-[#fafafa]">
      <Navbar />

      <header className="max-w-2xl mx-auto text-center mb-20">
        <span className="inline-flex items-center gap-2 text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-full text-xs font-bold mb-6">
          🛠️ Changelog
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-black mb-6 leading-[1.1]">
          What's new
        </h1>
        <p className="text-slate-500 text-lg leading-relaxed">
          A running log of what we've shipped — bugs fixed, features added, nothing embellished.
        </p>
      </header>

      <section className="max-w-2xl mx-auto mb-32">
        <div className="relative pl-8">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
          {ENTRIES.map((group, gi) => (
            <motion.div key={group.date}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: gi * 0.08, duration: 0.4 }}
              className="relative mb-14 last:mb-0"
            >
              <div className="absolute -left-8 top-1.5 h-3.5 w-3.5 rounded-full bg-[var(--brand-primary)] ring-4 ring-[var(--brand-light)]" />
              <time className="text-xs font-black text-slate-400 uppercase tracking-widest">
                {new Date(group.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </time>
              <ul className="mt-4 space-y-4">
                {group.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`flex-shrink-0 mt-0.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${TAG_STYLES[item.tag]}`}>
                      {item.tag}
                    </span>
                    <p className="text-slate-600 text-sm leading-relaxed">{item.text}</p>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
