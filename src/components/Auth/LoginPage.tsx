import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../../lib/supabaseClient';
import { AlertTriangle, ArrowRight, Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) { setError(supabaseConfigError); return; }
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 shadow-2xl"
            style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)' }}
          >
            <span className="text-5xl font-black text-white leading-none select-none">J</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
            JILD <span className="text-blue-600">IMPEX</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mt-2">
            Management Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in to your account to continue</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-6 flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="font-bold">Setup required</p>
                <p className="mt-1 text-amber-700">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to continue.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 flex gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                Email Address
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
                className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-all placeholder-slate-400 text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
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
                  className="w-full px-4 py-3 pr-12 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-all placeholder-slate-400 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 mt-2 text-sm font-bold text-white rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
              style={{ background: loading ? '#334155' : 'linear-gradient(135deg,#1e293b,#0f172a)' }}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          JILD IMPEX © {new Date().getFullYear()} · Leather Trade Management
        </p>
      </div>
    </div>
  );
};

export default LoginPage;