import { useNavigate } from 'react-router-dom';
import Logo from './Logo';

// Every link here resolves to something real. Columns like "Company"
// (Careers/Press/About) were dropped rather than left as href="#" —
// a footer full of dead links reads worse than a short honest one.
const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'AI Interviewer', href: '/setup' },
      { label: 'DSA Coding Interview', href: '/tech-interview/setup' },
      { label: 'ATS Resume Scanner', href: '/ats' },
      { label: 'ATS Comparison', href: '/ats/compare' },
      { label: 'Interview History', href: '/history' },
    ],
  },
  {
    heading: 'Why MockMate',
    links: [
      { label: 'Why MockMate', href: '/why-mockmate' },
      { label: 'What You Can Do', href: '/why-mockmate#capabilities' },
      { label: 'FAQs', href: '/why-mockmate#proof' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Email Support', href: 'mailto:support@mockmate.live' },
    ],
  },
];

export default function Footer() {
  const navigate = useNavigate();

  const handleClick = (e, href) => {
    if (href.startsWith('mailto:')) return; // let the browser handle it
    e.preventDefault();
    if (href.includes('#')) {
      const [path, hash] = href.split('#');
      navigate(path || '/');
      requestAnimationFrame(() => {
        setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 60);
      });
    } else {
      navigate(href);
    }
  };

  return (
    <footer className="relative mt-32 border-t border-slate-100 bg-[#fafafa]">
      {/* Giant watermark — cropped at the TOP of its own band, sitting
          above a divider, the way the reference does it. items-end keeps
          the bottom of the letters flush with the divider; the band is
          shorter than the font size, so the tops get clipped instead of
          the whole word floating with dead space around it. */}
      <div className="relative h-[140px] md:h-[200px] overflow-hidden flex items-end justify-center border-b border-slate-100">
        <span
          className="pointer-events-none select-none font-black text-[clamp(140px,26vw,340px)] leading-none tracking-tighter text-black/[0.04] translate-y-[22%]"
          aria-hidden="true"
        >
          MockMate
        </span>
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-12">
        {/* One flat row — brand info is just another item, not grouped
            separately from the link columns — with justify-between so
            everything spreads evenly across the full width instead of
            clustering on one side. */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-between gap-x-10 gap-y-12 mb-20">
          <div className="flex flex-col items-start text-left gap-4 max-w-[220px]">
            <Logo size="md" className="h-6 sm:h-7 -ml-0.5" />
            <p className="text-slate-500 text-sm leading-relaxed">
              AI-Powered Interview Coach<br />
              Indore, India 452001
            </p>
            <p className="text-slate-400 text-xs">
              © {new Date().getFullYear()} Keshav Banger. All rights reserved.
            </p>
          </div>

          {COLUMNS.map(({ heading, links }) => (
            <div key={heading} className="min-w-[140px]">
              <p className="text-xs font-black text-black uppercase tracking-widest mb-5">{heading}</p>
              <ul className="space-y-3">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} onClick={(e) => handleClick(e, href)}
                      className="text-sm text-slate-500 hover:text-[var(--brand-primary)] transition-colors duration-200 cursor-pointer">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
