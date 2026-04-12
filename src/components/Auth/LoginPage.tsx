import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../../lib/supabaseClient';
import { AlertTriangle, ArrowRight, Eye, EyeOff } from 'lucide-react';

const JildLogo = () => (
  <div className="flex flex-col items-center gap-4">
    {/* Logo mark */}
    <div className="relative">
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 blur-xl opacity-30 scale-110" />
      {/* Main mark */}
      <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-2xl">
        {/* Inner accent */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent" />
        {/* Monogram */}
        <div className="flex items-end gap-0.5">
          <span className="text-2xl font-black tracking-tighter text-white leading-none">J</span>
          <span className="text-lg font-black tracking-tighter text-blue-400 leading-none mb-0.5">I</span>
        </div>
        {/* Bottom accent bar */}
        <div className="absolute bottom-1.5 left-3 right-3 h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full opacity-70" />
      </div>
    </div>

    {/* Wordmark */}
    <div className="text-center">
      <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
        JILD <span className="text-blue-600">IMPEX</span>
      </h1>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mt-1.5">
        Management Portal
      </p>
    </div>
  </div>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      setError(supabaseConfigError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/app');
    } catch (err) {
      if (err instanceof Error && err.message === 'Invalid login credentials') {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left decorative panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        {/* Accent blobs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />

        <div className="relative z-10 text-center px-12">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <div className="flex items-end gap-0.5">
              <span className="text-3xl font-black text-white leading-none">J</span>
              <span className="text-xl font-black text-blue-400 leading-none mb-0.5">I</span>
            </div>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-3">
            JILD IMPEX
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
            Leather trade management — contracts, samples, payments and more, all in one place.
          </p>
          <div className="mt-10 flex justify-center gap-6">
            {['Contracts', 'Samples', 'Payments'].map((label) => (
              <div key={label} className="text-center">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-1.5">
                  <div className="w-4 h-4 rounded-sm bg-blue-400/60" />
                </div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo — visible on all sizes */}
          <div className="flex justify-center mb-10">
            <JildLogo />
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-7">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Welcome back</h2>
            <p className="text-sm text-slate-500 mb-6">Sign in to your account to continue</p>

            {/* Supabase not configured warning */}
            {!isSupabaseConfigured && (
              <div className="mb-5 flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">Setup required</p>
                  <p className="mt-0.5 text-amber-700 text-xs">
                    Add <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
                    <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to Replit Secrets.
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-5 flex gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isSupabaseConfigured}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder-slate-400"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!isSupabaseConfigured}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-11 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !isSupabaseConfigured}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 mt-2 text-sm font-bold text-white bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl hover:from-slate-700 hover:to-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-slate-400 mt-6">
            JILD IMPEX © {new Date().getFullYear()} · Leather Trade Management
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
