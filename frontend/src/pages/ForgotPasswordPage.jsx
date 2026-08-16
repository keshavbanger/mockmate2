import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, supabase } from '../context/AuthContext';
import Logo from '../components/Logo';

// Covers both auth tiers this app has (see AuthContext.jsx): Supabase-created
// accounts reset via Supabase's own resetPasswordForEmail/updateUser flow
// (the recovery link lands on ResetPasswordPage.jsx); legacy backend-password
// accounts reset via this app's own OTP infrastructure (same send-otp/verify
// pattern SignupPage already uses, just with purpose=RESET_PASSWORD). Both
// are triggered from the same email step here since a user doesn't know
// which tier their account is on — sendOtp reliably reports "no account"
// either way, since every account (Supabase or legacy) has a row in our own
// users table by the time they've ever logged in.
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { sendOtp, resetPassword } = useAuth();

  const [step, setStep] = useState('EMAIL'); // 'EMAIL' | 'RESET'
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSendReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      // Best-effort — Supabase deliberately doesn't reveal whether the
      // email exists, so its result isn't used to drive the UI here.
      supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      }).catch(() => {});

      await sendOtp(email.trim().toLowerCase(), 'RESET_PASSWORD');
      setStep('RESET');
    } catch (err) {
      setError(err.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError('');
    try {
      await sendOtp(email.trim().toLowerCase(), 'RESET_PASSWORD');
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch (err) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Enter the 6-digit code sent to your email');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase(), code, newPassword);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-4 py-12 font-sans text-slate-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-purple-200/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-[28px] p-8 sm:p-10 shadow-xl shadow-purple-900/[0.04]">
        <div className="mb-8 flex flex-col items-start">
          <Link to="/" className="inline-flex items-center hover:opacity-80 transition mb-6">
            <Logo size="md" />
          </Link>
          {step === 'EMAIL' ? (
            <>
              <h2 className="text-3xl font-extrabold text-[#111] tracking-tight mb-2">Forgot password?</h2>
              <p className="text-slate-500 text-sm">Enter your email and we'll send you a reset code — and a reset link if your account uses Google sign-in.</p>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-extrabold text-[#111] tracking-tight mb-2">Check your email</h2>
              <p className="text-slate-500 text-sm">Enter the 6-digit code sent to <strong>{email}</strong> and choose a new password. If you signed up with Google, use the link in that email instead.</p>
            </>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm mb-6 flex items-start space-x-2">
            <span className="font-semibold">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {step === 'EMAIL' ? (
          <form onSubmit={handleSendReset} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent transition duration-200 text-sm font-medium"
                disabled={loading}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#6B46C1] hover:bg-[#5839a3] disabled:opacity-50 text-white font-bold py-3.5 rounded-full transition-all duration-300 shadow-lg shadow-purple-900/20 active:scale-[0.98] text-sm"
            >
              {loading ? 'Sending...' : 'Send reset code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-5">
            <div className="flex justify-center gap-2 sm:gap-3">
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
                  className="w-11 h-12 sm:w-12 sm:h-14 text-center text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent transition"
                  disabled={loading}
                />
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent transition duration-200 text-sm font-medium"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent transition duration-200 text-sm font-medium"
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#6B46C1] hover:bg-[#5839a3] disabled:opacity-50 text-white font-bold py-3.5 rounded-full transition-all duration-300 shadow-lg shadow-purple-900/20 active:scale-[0.98] text-sm"
            >
              {loading ? 'Resetting...' : 'Reset password'}
            </button>

            <p className="text-center text-xs text-slate-400">
              Didn't get a code?{' '}
              {resent ? (
                <span className="text-green-600 font-bold">Sent!</span>
              ) : (
                <button type="button" onClick={handleResendOtp} disabled={resending} className="text-[#6B46C1] font-bold hover:underline">
                  {resending ? 'Sending...' : 'Resend code'}
                </button>
              )}
            </p>
          </form>
        )}

        <p className="text-center text-slate-500 text-sm mt-8">
          Remembered your password?{' '}
          <Link to="/login" className="text-[#6B46C1] hover:text-[#5839a3] font-bold hover:underline transition">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
