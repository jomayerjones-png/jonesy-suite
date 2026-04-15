import { useState, FormEvent } from 'react';
import { signIn } from '../lib/supabase';

export default function Auth() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

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

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="select-none px-4 pt-2 pb-1.5"
            style={{ background: '#E8002D', fontFamily: "'Bebas Neue', Impact, 'Arial Narrow', sans-serif" }}
          >
            <span className="text-white leading-none" style={{ fontSize: '2.2rem', letterSpacing: '0.06em' }}>
              LIFE
            </span>
          </div>
          <p className="text-white/40 text-xs uppercase tracking-widest font-medium">
            Partner Suite
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-white/50 text-xs uppercase tracking-widest font-medium">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-white/8 border border-white/12 text-white placeholder-white/30
                           px-4 py-3 text-sm outline-none focus:border-[#E8002D] transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-white/50 text-xs uppercase tracking-widest font-medium">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-white/8 border border-white/12 text-white placeholder-white/30
                           px-4 py-3 text-sm outline-none focus:border-[#E8002D] transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E8002D] text-white text-sm font-semibold tracking-wide
                       py-3 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-white/20 text-xs text-center">
          CONFIDENTIAL — Authorised access only
        </p>
      </div>
    </div>
  );
}
