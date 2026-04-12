import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../../lib/supabaseClient';
import { AlertTriangle, LogIn, Building2 } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      setError(supabaseConfigError);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center mb-6">
          <Building2 className="h-12 w-12 text-blue-600 mr-3" />
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">JILD IMPEX</h1>
            <p className="text-sm text-blue-600 font-medium">Management Portal</p>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Access your leather trade management system
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-blue-100">
          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Supabase is not configured.</p>
                  <p className="mt-1 text-sm">
                    If you've already added the variables to Netlify, you must <strong>trigger a new deploy</strong> (Clear cache and deploy) for the changes to take effect.
                  </p>
                  <p className="mt-2 text-xs opacity-75">
                    Required: <code className="rounded bg-amber-100 px-1 py-0.5">VITE_SUPABASE_URL</code> and <code className="rounded bg-amber-100 px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded relative">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isSupabaseConfigured}
                  className="appearance-none block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!isSupabaseConfigured}
                  className="appearance-none block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || !isSupabaseConfigured}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogIn className="h-5 w-5 mr-2" />
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;