import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
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

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!user) return '?';
    const name = user.fullName || user.full_name || user.name || user.email || '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const avatarUrl = user?.avatarUrl || user?.avatar_url || null;

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
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="h-8 w-8 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white text-sm font-bold">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
          </div>
          <span className="font-bold tracking-tight text-xl text-black">MockMate</span>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8 text-[13.5px] font-semibold text-slate-500">
          {[
            { label: 'Home',         href: '#'           },
            { label: 'Features',     href: '#features'   },
            { label: 'How It Works', href: '#how-it-works' },
            { label: 'Pricing',      href: '#pricing'    },
            { label: 'About',        href: '#about'      },
          ].map(({ label, href }) => (
            <a key={label} href={href}
              className={`relative transition-colors hover:text-[#111] cursor-pointer ${label === 'Home' ? 'text-[var(--brand-primary)]' : ''}`}>
              {label}
              {label === 'Home' && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4/5 h-[2px] bg-[var(--brand-primary)] rounded-full" />
              )}
            </a>
          ))}
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <motion.button
              onClick={() => navigate('/ats')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="hidden sm:flex items-center gap-1.5 px-5 py-2 rounded-full text-[13px] font-bold
                         border-[1.5px] border-[var(--brand-primary)] text-[var(--brand-primary)]
                         hover:bg-[var(--brand-light)] transition-colors"
            >
              ✦ Analyze Resume
            </motion.button>
          )}

          {isAuthenticated ? (
            /* ── User Avatar + Dropdown ── */
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#6B46C1] to-[#5b3da6] flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{getInitials()}</span>
                  )}
                </div>
                {/* Name (desktop only) */}
                <span className="hidden md:block text-[13px] font-semibold text-slate-700 max-w-[100px] truncate">
                  {user?.fullName || user?.full_name || user?.name || 'Account'}
                </span>
                {/* Chevron */}
                <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-slate-100 shadow-xl shadow-black/10 overflow-hidden"
                >
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b border-slate-50">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {user?.fullName || user?.full_name || user?.name || 'User'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1.5">
                    {[
                      { icon: '🏠', label: 'Dashboard', action: () => { navigate('/dashboard'); setDropdownOpen(false); } },
                      { icon: '🧑‍💻', label: 'Tech Interview', action: () => { navigate('/tech-interview/setup'); setDropdownOpen(false); } },
                      { icon: '🎤', label: 'Practice Interview', action: () => { navigate('/setup'); setDropdownOpen(false); } },
                      { icon: '📊', label: 'My History', action: () => { navigate('/history'); setDropdownOpen(false); } },
                      { icon: '📄', label: 'ATS Resume Check', action: () => { navigate('/ats'); setDropdownOpen(false); } },
                    ].map(({ icon, label, action }) => (
                      <button key={label} onClick={action}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
                        <span className="text-base">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Logout */}
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
            /* ── Guest: Login / Sign Up ── */
            <>
              <motion.button
                onClick={() => navigate('/login')}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="px-5 py-2 rounded-full text-[13px] font-bold text-slate-600 hover:text-black hover:bg-slate-100 transition-colors"
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
    </motion.div>
  );
}
