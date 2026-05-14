import { useState, FormEvent } from 'react';
import { signIn, resetPassword } from '../lib/supabase';

export default function Auth() {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Enter your email address above first.'); return; }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#F5F0EB' }}>
      <div className="w-full max-w-sm space-y-10">

        <div className="text-center">
          <div className="inline-block bg-[#7C3AED] px-4 py-2 mb-4">
            <span className="font-sans font-bold text-white text-xl tracking-[0.15em] uppercase">KALEIDOSCOPE</span>
          </div>
          <p className="text-xs text-brand-dark/40 uppercase tracking-[0.2em] font-medium">
            Commercial Suite
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs text-brand-dark/50 uppercase tracking-widest font-medium">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-white border border-brand-dark/15 text-brand-dark
                           px-4 py-3 text-sm outline-none focus:border-[#7C3AED] transition-colors rounded-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-brand-dark/50 uppercase tracking-widest font-medium">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-white border border-brand-dark/15 text-brand-dark
                           px-4 py-3 text-sm outline-none focus:border-[#7C3AED] transition-colors rounded-none"
              />
            </div>
          </div>

          {error && <p className="text-red-600 text-xs text-center">{error}</p>}
          {resetSent && <p className="text-emerald-700 text-xs text-center">Reset email sent — check your inbox.</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#7C3AED] text-white text-sm font-medium tracking-widest uppercase
                       py-3.5 transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={loading}
            className="w-full text-brand-dark/30 text-xs hover:text-brand-dark/60 transition-colors text-center py-1"
          >
            Forgot password?
          </button>
        </form>

        <p className="text-brand-dark/20 text-xs text-center tracking-wide">
          Confidential — authorised access only
        </p>
      </div>
    </div>
  );
}
