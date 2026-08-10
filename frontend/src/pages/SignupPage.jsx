import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signupWithEmail, loginWithGoogle, signup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Last name is required');
      return;
    }
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;

      try {
        const result = await signupWithEmail(formData.email, formData.password, fullName);
        // If we got a session back (auto-confirm enabled), go straight to dashboard
        if (result && result.id && !result.email_confirmed_at === undefined) {
          navigate('/');
        } else {
          // Email confirmation required
          setSentTo(formData.email);
          setEmailSent(true);
        }
      } catch (err) {
        // If Supabase error is about existing user, try legacy backend
        const msg = err.message || '';
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          setError('An account with this email already exists. Please log in instead.');
          setLoading(false);
          return;
        }
        console.warn('Supabase signup failed, trying legacy backend signup:', err);
        const username = formData.username?.trim() || formData.email.split('@')[0];
        await signup(formData.email, formData.firstName, formData.lastName, username, formData.password);
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || 'Google login failed.');
      setLoading(false);
    }
  };

  // --- Email Sent Confirmation Screen ---
  if (emailSent) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col lg:flex-row overflow-hidden font-sans text-slate-900">
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-purple-200/30 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-[120px]" />
        </div>

        {/* Left Side */}
        <div className="lg:w-1/2 p-8 sm:p-12 lg:p-20 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200/60 bg-white/60 backdrop-blur-sm">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-[#111]">
              <span className="text-2xl">🎙️</span> MockMate
            </Link>
          </div>
          <div className="my-12 lg:my-auto max-w-xl">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#111] leading-[1.12] mb-6">
              Check your inbox. <br />
              <span className="gradient-text">Verification email sent!</span>
            </h1>
            <p className="text-slate-500 text-lg leading-relaxed mb-6">
              We sent an activation link to <strong className="text-[#6B46C1]">{sentTo}</strong>. Click the link in the email to activate your account.
            </p>
          </div>
          <div className="text-xs font-medium text-slate-400">
            © 2026 MockMate. All rights reserved.
          </div>
        </div>

        {/* Right Side Card */}
        <div className="lg:w-1/2 p-6 sm:p-12 lg:p-20 flex items-center justify-center bg-[#f8f9fa]/80">
          <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-[28px] p-8 sm:p-10 shadow-xl shadow-purple-900/[0.04] text-center">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-purple-100 text-[#6B46C1] border border-purple-200/60">
              <span className="text-3xl">📧</span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#111] mb-2">Check your email</h2>
            <p className="text-slate-500 text-sm mb-4">
              We sent a confirmation link to
            </p>
            <p className="text-[#6B46C1] font-bold text-base mb-6 break-all bg-purple-50 py-2 px-4 rounded-xl border border-purple-100">
              {sentTo}
            </p>
            <p className="text-slate-400 text-xs mb-8 leading-relaxed">
              Click the link in the email to activate your account, then come back to log in and start practicing!
            </p>
            <Link
              to="/login"
              className="inline-block w-full bg-[#6B46C1] hover:bg-[#5839a3] text-white font-bold py-3.5 rounded-full transition duration-300 shadow-lg shadow-purple-900/20 text-sm"
            >
              Go to Login
            </Link>
            <p className="text-slate-400 text-xs mt-6">
              Didn't receive it? Check your spam folder or verify your address.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col lg:flex-row overflow-hidden font-sans text-slate-900">
      {/* Ambient background glows matching landing page */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-purple-200/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-[120px]" />
      </div>

      {/* ── LEFT HALF: Brand & Value Pitch (Inslit Style) ── */}
      <div className="lg:w-1/2 p-8 sm:p-12 lg:p-20 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200/60 bg-white/60 backdrop-blur-sm relative z-10">
        {/* Brand Logo */}
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-[#111] hover:opacity-80 transition">
            <span className="text-2xl">🎙️</span> MockMate
          </Link>
        </div>

        {/* Hero Pitch */}
        <div className="my-12 lg:my-auto max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-[#6B46C1] text-xs font-bold mb-6">
            🚀 Create Free Account
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#111] leading-[1.12] mb-6">
            Master your interviews. <br />
            <span className="gradient-text">Build what matters.</span>
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed mb-8">
            MockMate helps candidates scan ATS resumes, practice live conversational AI interviews, and get actionable scoring reports to land their dream job.
          </p>

          {/* Feature Highlights / Checkmarks */}
          <div className="flex flex-wrap gap-3">
            {[
              '✓ Real-time ATS Resume Scanner',
              '✓ Conversational AI Interviewer',
              '✓ Startup-friendly Free Access'
            ].map((pill, i) => (
              <span key={i} className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200/80 text-slate-700 px-4 py-2 rounded-full text-xs font-semibold">
                {pill}
              </span>
            ))}
          </div>
        </div>

        {/* Left Footer */}
        <div className="text-xs font-medium text-slate-400">
          © 2026 MockMate. AI Interview Preparation Platform.
        </div>
      </div>

      {/* ── RIGHT HALF: Form Container ── */}
      <div className="lg:w-1/2 p-6 sm:p-12 lg:p-20 flex items-center justify-center bg-[#f8f9fa]/80 relative z-10">
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-[28px] p-8 sm:p-10 shadow-xl shadow-purple-900/[0.04]">
          
          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-[#111] tracking-tight mb-2">
              Create account
            </h2>
            <p className="text-slate-500 text-sm">
              Start practicing interviews for free with MockMate AI.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm mb-6 flex items-start space-x-2 animate-fade-in">
              <span className="font-semibold">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3.5 px-4 rounded-full border border-slate-200 transition-all duration-300 shadow-sm hover:shadow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            Sign Up with Google
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-slate-200 w-full" />
            <span className="absolute bg-white px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              or use credentials
            </span>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent transition duration-200 text-sm font-medium"
                  disabled={loading}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent transition duration-200 text-sm font-medium"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                placeholder="john.doe@company.com"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent transition duration-200 text-sm font-medium"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent transition duration-200 text-sm font-medium"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent transition duration-200 text-sm font-medium"
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#6B46C1] hover:bg-[#5839a3] disabled:opacity-50 text-white font-bold py-3.5 rounded-full transition-all duration-300 shadow-lg shadow-purple-900/20 active:scale-[0.98] text-sm"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating your account...</span>
                </div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-slate-500 text-sm mt-8">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-[#6B46C1] hover:text-[#5839a3] font-bold hover:underline transition"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
