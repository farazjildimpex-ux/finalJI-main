import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../../lib/supabaseClient';
import { AlertTriangle, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';

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
      setError(
        err instanceof Error && err.message === 'Invalid login credentials'
          ? 'Incorrect email or password.'
          : err instanceof Error ? err.message : 'An error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4" style={{ backgroundColor: '#020617' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/3 -left-1/4 w-[700px] h-[700px] rounded-full opacity-20 blur-[140px]" style={{ backgroundColor: '#1d4ed8' }} />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full opacity-15 blur-[120px]" style={{ backgroundColor: '#4f46e5' }} />
      </div>

      <div className="relative w-full max-w-[390px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-9">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-[20px] blur-lg opacity-40" style={{ backgroundColor: '#3b82f6', transform: 'scale(1.15)' }} />
            <div
              className="relative w-[68px] h-[68px] rounded-[20px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
              }}
            >
              <div
                className="absolute inset-0 rounded-[20px]"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)' }}
              />
              <span
                className="relative font-black leading-none"
                style={{ fontSize: 26, letterSpacing: '-1px' }}
              >
                <span style={{ color: '#ffffff' }}>J</span><span style={{ color: '#60a5fa' }}>I</span>
              </span>
              <div
                className="absolute rounded-full"
                style={{
                  bottom: 9, left: 10, right: 10, height: 2,
                  background: 'linear-gradient(90deg, #60a5fa, #818cf8)',
                  opacity: 0.75,
                }}
              />
            </div>
          </div>
          <h1 className="font-black tracking-tight" style={{ color: '#f8fafc', fontSize: 20 }}>
            JILD <span style={{ color: '#60a5fa' }}>IMPEX</span>
          </h1>
          <p className="mt-1 font-medium uppercase" style={{ color: '#475569', fontSize: 10, letterSpacing: '0.15em' }}>
            Management Portal
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7"
          style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <h2 className="font-bold mb-1" style={{ color: '#f1f5f9', fontSize: 18 }}>Welcome back</h2>
          <p className="mb-6 text-sm" style={{ color: '#64748b' }}>Sign in to continue</p>

          {!isSupabaseConfigured && (
            <div className="mb-5 flex gap-3 p-3.5 rounded-xl text-sm" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#fbbf24' }} />
              <div>
                <p className="font-semibold" style={{ color: '#fde68a' }}>Setup required</p>
                <p className="mt-0.5 text-xs" style={{ color: '#fcd34d', opacity: 0.8 }}>
                  Add <code className="px-1 rounded" style={{ background: 'rgba(245,158,11,0.2)' }}>VITE_SUPABASE_URL</code> and{' '}
                  <code className="px-1 rounded" style={{ background: 'rgba(245,158,11,0.2)' }}>VITE_SUPABASE_ANON_KEY</code> to Replit Secrets.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 flex gap-2.5 p-3.5 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#f87171' }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#64748b' }}>
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
                className="w-full px-4 py-3 text-sm rounded-xl outline-none transition-all disabled:opacity-50"
                style={{
                  background: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#f1f5f9',
                }}
                onFocus={(e) => { e.target.style.border = '1px solid #3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
                onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#64748b' }}>
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
                  className="w-full px-4 py-3 pr-12 text-sm rounded-xl outline-none transition-all disabled:opacity-50"
                  style={{
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f1f5f9',
                  }}
                  onFocus={(e) => { e.target.style.border = '1px solid #3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
                  onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#475569' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#94a3b8')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="w-full mt-2 py-3 px-4 flex items-center justify-center gap-2 text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading ? '#1d4ed8' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
              }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'; }}
              onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'; }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
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

        <p className="text-center mt-6" style={{ color: '#1e293b', fontSize: 11 }}>
          JILD IMPEX © {new Date().getFullYear()} · Leather Trade Management
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
