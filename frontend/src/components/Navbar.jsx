import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

const FEATURE_LINKS = [
  {
    title: 'Interview Studio',
    desc: 'AI-powered mock interviews & feedback',
    icon: '🎙️',
    path: '/setup',
    badge: 'Voice AI'
  },
  {
    title: 'Technical Interview Lab',
    desc: 'Live coding, execution & AI-powered interviews',
    icon: '💻',
    path: '/tech-interview/setup',
    badge: 'Coding'
  },
  {
    title: 'Resume Analyzer',
    desc: 'Get your ATS score & hiring insights',
    icon: '🔍',
    path: '/ats',
    badge: '100 Pt'
  },
  {
    title: 'Resume Builder',
    desc: 'Build, design & customize ATS-friendly resumes',
    icon: '📄',
    path: '/resume-builder',
    badge: 'Studio'
  },
  {
    title: 'AI Interviewer',
    desc: 'Adaptive AI interviewer that reacts to your answers live',
    icon: '🤖',
    path: '/ai-engine-beta',
    badge: 'Beta'
  },
];

const NAV_LINKS = [
  { label: 'Home',      type: 'route',  target: '/'          },
  { label: 'Pricing',   type: 'route',  target: '/pricing'   },
  { label: 'Blog',      type: 'route',  target: '/blog'      },
  { label: 'Changelog', type: 'route',  target: '/changelog' },
  { label: 'Contact',   type: 'route',  target: '/contact'   },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  
  const dropdownRef = useRef(null);
  const featuresRef = useRef(null);
  const navWrapperRef = useRef(null);

  const isLinkActive = (target) => location.pathname === target;

  const handleNavClick = (link) => {
    setMobileMenuOpen(false);
    setFeaturesOpen(false);
    navigate(link.target);
  };

  const handleFeatureClick = (path) => {
    setFeaturesOpen(false);
    setMobileMenuOpen(false);
    navigate(path);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (featuresRef.current && !featuresRef.current.contains(e.target)) {
        setFeaturesOpen(false);
      }
      if (navWrapperRef.current && !navWrapperRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/');
  };

  const getInitials = () => {
    if (!user) return '?';
    const name = user.fullName || user.full_name || user.name || user.email || '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const avatarUrl = user?.avatarUrl || user?.avatar_url || null;

  return (
    <motion.div
      ref={navWrapperRef}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4 pointer-events-none"
    >
      <nav className={`relative w-full max-w-5xl pointer-events-auto floating-nav justify-between transition-all duration-300 ${
        scrolled ? 'shadow-[0_8px_30px_rgba(0,0,0,0.08)] bg-white/95 backdrop-blur-xl' : 'shadow-[0_4px_20px_rgba(0,0,0,0.04)] bg-white/80'
      }`}>
        {/* Logo */}
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
          <Logo size="sm" className="h-5 sm:h-6" />
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1.5 text-[13px] font-semibold">
          {/* HOME LINK FIRST */}
          {NAV_LINKS.filter(l => l.label === 'Home').map((link) => {
            const active = isLinkActive(link.target);
            return (
              <button
                key={link.label}
                onClick={() => handleNavClick(link)}
                className={`relative px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
                  active ? 'text-[#6B46C1] font-bold' : 'text-slate-600 hover:text-black'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="navActivePill"
                    className="absolute inset-0 bg-purple-50 rounded-full -z-10"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                {link.label}
              </button>
            );
          })}

          {/* FEATURES DROPDOWN LINK */}
          <div className="relative" ref={featuresRef}>
            <button
              onClick={() => setFeaturesOpen(prev => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                featuresOpen
                  ? 'bg-purple-100/80 text-[#6B46C1] font-bold shadow-sm'
                  : 'text-slate-700 hover:text-black hover:bg-slate-100/70'
              }`}
            >
              <span>Features</span>
              <svg
                className={`w-3.5 h-3.5 text-purple-600 transition-transform duration-200 ${featuresOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Features Dropdown Menu */}
            <AnimatePresence>
              {featuresOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute left-0 top-full mt-3 w-80 bg-white rounded-2xl border border-slate-200/80 shadow-2xl shadow-purple-900/10 p-2 overflow-hidden z-50"
                >
                  <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50/70 rounded-xl mb-1 flex items-center justify-between">
                    <span>Explore Core Tools</span>
                    <span className="text-[9px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full font-bold">{FEATURE_LINKS.length} Tools</span>
                  </div>

                  <div className="space-y-1">
                    {FEATURE_LINKS.map((f) => (
                      <button
                        key={f.title}
                        onClick={() => handleFeatureClick(f.path)}
                        className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-purple-50/60 transition-colors text-left group cursor-pointer"
                      >
                        <span className="text-xl p-1.5 bg-slate-100 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all flex-shrink-0">
                          {f.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-bold text-slate-800 group-hover:text-[#6B46C1] transition-colors">
                              {f.title}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 group-hover:bg-purple-100 group-hover:text-purple-700 px-1.5 py-0.5 rounded-full transition-colors">
                              {f.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium leading-snug line-clamp-1 mt-0.5">
                            {f.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Standard Navigation Links (Pricing, Changelog, Contact) */}
          {NAV_LINKS.filter(l => l.label !== 'Home').map((link) => {
            const active = isLinkActive(link.target);
            return (
              <button
                key={link.label}
                onClick={() => handleNavClick(link)}
                className={`relative px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
                  active ? 'text-[#6B46C1] font-bold' : 'text-slate-600 hover:text-black'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="navActivePill"
                    className="absolute inset-0 bg-purple-50 rounded-full -z-10"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                {link.label}
              </button>
            );
          })}
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            className="md:hidden flex items-center justify-center h-9 w-9 rounded-full hover:bg-slate-100 transition-colors -ml-1"
          >
            <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {isAuthenticated ? (
            /* User Avatar + Dropdown */
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#6B46C1] to-[#5b3da6] flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{getInitials()}</span>
                  )}
                </div>
                <span className="hidden md:block text-[13px] font-semibold text-slate-700 max-w-[100px] truncate">
                  {user?.fullName || user?.full_name || user?.name || 'Account'}
                </span>
                <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-slate-100 shadow-xl shadow-black/10 overflow-hidden"
                >
                  <button
                    onClick={() => { navigate('/dashboard'); setDropdownOpen(false); }}
                    className="w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {user?.fullName || user?.full_name || user?.name || 'User'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</p>
                  </button>

                  <div className="py-1.5">
                    <button onClick={() => { navigate('/dashboard'); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
                      <span className="text-base">🏠</span>
                      Dashboard
                    </button>
                    {/* Profile — where saved resumes are managed (see
                        ProfilePage's "My Saved Resumes" section). Previously
                        the only way here was Dashboard's own separate
                        dropdown, so anyone not already on /dashboard had no
                        visible path to it at all. */}
                    <button onClick={() => { navigate('/profile'); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
                      <span className="text-base">👤</span>
                      Profile & Resumes
                    </button>
                    <button onClick={() => { navigate('/resume-builder'); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
                      <span className="text-base">📄</span>
                      Resume Builder
                    </button>
                    {user?.role === 'ADMIN' && (
                      <button onClick={() => { navigate('/admin'); setDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
                        <span className="text-base">🛠️</span>
                        Admin Panel
                      </button>
                    )}
                  </div>

                  <div className="border-t border-slate-50 py-1.5">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 transition-colors text-left">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            <>
              <motion.button
                onClick={() => navigate('/login')}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="hidden sm:block px-5 py-2 rounded-full text-[13px] font-bold text-slate-600 hover:text-black hover:bg-slate-100 transition-colors"
              >
                Log In
              </motion.button>
              <motion.button
                onClick={() => navigate('/signup')}
                whileHover={{ scale: 1.04, boxShadow: '0 8px 24px rgba(107,70,193,0.3)' }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 px-6 py-2 rounded-full text-[13px] font-bold text-white
                           bg-gradient-to-r from-[#6B46C1] to-[#5b3da6] shadow-md shadow-purple-900/20 transition-all duration-200"
              >
                Get Started →
              </motion.button>
            </>
          )}
        </div>
      </nav>

      {/* Mobile menu panel */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="md:hidden pointer-events-auto absolute left-4 right-4 top-[calc(100%+4px)] bg-white rounded-2xl border border-slate-100 shadow-xl shadow-black/10 overflow-hidden"
          >
            <div className="p-3 bg-purple-50/50 border-b border-purple-100">
              <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wider mb-2">Features & Tools</p>
              <div className="space-y-1">
                {FEATURE_LINKS.map(f => (
                  <button
                    key={f.title}
                    onClick={() => handleFeatureClick(f.path)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-white transition-colors"
                  >
                    <span className="text-base">{f.icon}</span>
                    <span className="text-xs font-bold text-slate-800">{f.title}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="py-2">
              {NAV_LINKS.map((link) => (
                <button key={link.label} onClick={() => handleNavClick(link)}
                  className={`block w-full text-left px-5 py-2.5 text-[14px] font-semibold transition-colors hover:bg-slate-50 ${
                    isLinkActive(link.target) ? 'text-[#6B46C1]' : 'text-slate-600'
                  }`}>
                  {link.label}
                </button>
              ))}
            </div>

            {!isAuthenticated && (
              <div className="sm:hidden border-t border-slate-50 py-2">
                <button
                  onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-5 py-3 text-[14px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors text-left"
                >
                  Log In
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
