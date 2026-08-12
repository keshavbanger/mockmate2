import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, supabase } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signupWithEmail, loginWithGoogle, signup, sendOtp, verifyOtp, error: authError } = useAuth();

  const [step, setStep] = useState('FORM'); // 'FORM' | 'OTP'
  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    country: '',
    password: '',
  });

  // 6-digit OTP input boxes
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef([]);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  // Resend countdown timer effect
  useEffect(() => {
    let interval = null;
    if (step === 'OTP' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, resendTimer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Step 1: Submit Form -> Send OTP via Resend (mockmate.live)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.fullName.trim()) {
      setError('Full name is required');
      return;
    }
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      setLoading(true);
      const emailLower = formData.email.trim().toLowerCase();

      // Trigger OTP email via backend (Resend API -> mockmate.live)
      await sendOtp(emailLower, 'SIGNUP');
      setStep('OTP');
      setResendTimer(30);
      setCanResend(false);
      setResendMessage('');
    } catch (err) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit box input & auto-focus next
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto focus next box
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto submit if all 6 digits entered
    if (value && index === 5) {
      const fullCode = [...newOtp.slice(0, 5), value.slice(-1)].join('');
      if (fullCode.length === 6) {
        handleOtpVerify(fullCode);
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pasted[i] || '';
      }
      setOtp(newOtp);
      const focusIndex = Math.min(pasted.length, 5);
      otpInputRefs.current[focusIndex]?.focus();
      if (pasted.length === 6) {
        handleOtpVerify(pasted);
      }
    }
  };

  // Step 2: Verify OTP & Complete Registration
  const handleOtpVerify = async (codeToVerify) => {
    const code = codeToVerify || otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits of the verification code');
      return;
    }

    setError('');
    setVerifyingOtp(true);
    const emailTrimmed = formData.email.trim().toLowerCase();

    try {
      // 1. Verify OTP code via backend
      await verifyOtp(emailTrimmed, code, 'SIGNUP');

      // 2. Perform Account Registration
      const fullNameTrimmed = formData.fullName.trim();
      const nameParts = fullNameTrimmed.split(' ');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || '';

      try {
        await signupWithEmail(emailTrimmed, formData.password, fullNameTrimmed);
      } catch (err) {
        // Fallback to legacy backend signup if Supabase auto-confirm is bypassed
        const username = emailTrimmed.split('@')[0];
        await signup(emailTrimmed, firstName, lastName, username, formData.password);
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Resend OTP code action
  const handleResendOtp = async () => {
    if (!canResend || resendLoading) return;

    try {
      setResendLoading(true);
      setError('');
      setResendMessage('');
      const emailLower = formData.email.trim().toLowerCase();
      await sendOtp(emailLower, 'SIGNUP');
      setResendMessage('A new verification code has been sent!');
      setResendTimer(30);
      setCanResend(false);
    } catch (err) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResendLoading(false);
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

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col lg:flex-row overflow-hidden font-sans text-slate-900">
      {/* Background glow effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-purple-200/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-[120px]" />
      </div>

      {/* ── LEFT HALF: Brand & Pitch ── */}
      <div className="lg:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-start border-b lg:border-b-0 lg:border-r border-slate-200/60 bg-white/60 backdrop-blur-sm relative z-10">
        <div className="mb-8 lg:mb-10">
          <Link to="/" className="inline-flex items-center hover:opacity-80 transition">
            <Logo size="lg" />
          </Link>
        </div>

        <div className="max-w-xl mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-100/80 border border-purple-200 text-[#6B46C1] text-xs font-bold mb-6">
            ✨ Verified Email Sign-up (mockmate.live)
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#111] leading-[1.12] mb-6">
            Master your interviews. <br />
            <span className="gradient-text">Build what matters.</span>
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed mb-8">
            MockMate helps tech candidates practice live AI interviews, solve DSA problems, and analyze ATS resumes with real-time feedback.
          </p>

          <div className="flex flex-wrap gap-3">
            {[
              '✓ Real-time OTP Email Verification',
              '✓ Conversational AI Interviewer',
              '✓ Startup-friendly Free Access'
            ].map((pill, i) => (
              <span key={i} className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200/80 text-slate-700 px-4 py-2 rounded-full text-xs font-semibold">
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-6 text-xs font-medium text-slate-400">
          © 2026 MockMate AI. All rights reserved.
        </div>
      </div>

      {/* ── RIGHT HALF: Form Container / OTP Step ── */}
      <div className="lg:w-1/2 p-6 sm:p-12 lg:p-20 flex items-center justify-center bg-[#f8f9fa]/80 relative z-10">
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-[28px] p-8 sm:p-10 shadow-xl shadow-purple-900/[0.04]">
          
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to home
            </Link>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm mb-6 flex items-start space-x-2 animate-fade-in">
              <span className="font-semibold">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {resendMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-sm mb-6 flex items-start space-x-2 animate-fade-in">
              <span className="font-semibold">✅</span>
              <span>{resendMessage}</span>
            </div>
          )}

          {/* STEP 1: Registration Credentials Form */}
          {step === 'FORM' && (
            <div>
              <div className="mb-8">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111] tracking-tight mb-2">
                  Create account
                </h2>
                <p className="text-slate-400 text-sm font-medium">
                  Start practicing with MockMate AI
                </p>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-[#111] mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    placeholder="Your full name"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition duration-200 text-sm font-medium shadow-sm"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#111] mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="name@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition duration-200 text-sm font-medium shadow-sm"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#111] mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    placeholder="Your country"
                    value={formData.country}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition duration-200 text-sm font-medium shadow-sm"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#111] mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 pr-12 bg-white border border-slate-200/90 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition duration-200 text-sm font-medium shadow-sm"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.962 8.962 0 013.682-.763c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-4.692-4.692a3 3 0 00-4.243-4.243" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 bg-[#18181b] hover:bg-[#27272a] disabled:opacity-50 text-white font-semibold py-4 rounded-full transition-all duration-300 shadow-md active:scale-[0.98] text-base cursor-pointer"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending Verification Code...</span>
                    </div>
                  ) : (
                    'Create Account & Get Verification Code →'
                  )}
                </button>
              </form>

              <div className="relative flex items-center justify-center my-6">
                <div className="border-t border-slate-200 w-full" />
                <span className="absolute bg-white px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  OR
                </span>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3.5 px-4 rounded-full border border-slate-200/90 transition-all duration-300 shadow-sm hover:shadow active:scale-[0.98] disabled:opacity-50 text-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              <p className="text-center text-slate-500 text-sm mt-8">
                Already have an account?{' '}
                <Link to="/login" className="text-[#6B46C1] hover:text-[#5839a3] font-bold hover:underline transition">
                  Sign In
                </Link>
              </p>
            </div>
          )}

          {/* STEP 2: Interactive 6-Digit OTP Verification Screen */}
          {step === 'OTP' && (
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-purple-100 text-[#6B46C1] flex items-center justify-center border border-purple-200/60 shadow-inner">
                <span className="text-3xl">🔑</span>
              </div>

              <h2 className="text-2xl font-extrabold text-[#111] mb-2">
                Enter Verification Code
              </h2>
              <p className="text-slate-500 text-sm mb-2">
                We sent a 6-digit verification code to
              </p>
              <div className="inline-block bg-purple-50 text-[#6B46C1] font-bold text-sm px-4 py-1.5 rounded-full border border-purple-100 mb-6">
                {formData.email}
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="flex justify-center gap-2 sm:gap-3 mb-8" onPaste={handleOtpPaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-13 sm:w-12 sm:h-14 text-center text-2xl font-bold bg-white border-2 border-slate-200 rounded-xl focus:border-[#6B46C1] focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all shadow-sm"
                  />
                ))}
              </div>

              {/* Verify Submit Button */}
              <button
                type="button"
                onClick={() => handleOtpVerify()}
                disabled={verifyingOtp || otp.join('').length !== 6}
                className="w-full bg-[#6B46C1] hover:bg-[#5839a3] disabled:opacity-50 text-white font-bold py-4 rounded-full transition-all duration-300 shadow-lg shadow-purple-900/20 text-base mb-6 cursor-pointer"
              >
                {verifyingOtp ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Code...</span>
                  </div>
                ) : (
                  'Verify Code & Complete Sign Up →'
                )}
              </button>

              {/* Resend & Edit Email links */}
              <div className="space-y-3 text-xs">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendLoading}
                    className="text-[#6B46C1] font-bold hover:underline transition disabled:opacity-50"
                  >
                    {resendLoading ? 'Resending Code...' : 'Didn\'t receive the code? Click to Resend'}
                  </button>
                ) : (
                  <p className="text-slate-400 font-medium">
                    Resend code in <strong className="text-slate-700">{resendTimer}s</strong>
                  </p>
                )}

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('FORM');
                      setError('');
                      setResendMessage('');
                    }}
                    className="text-slate-500 hover:text-slate-800 font-semibold transition"
                  >
                    ← Edit email address ({formData.email})
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
