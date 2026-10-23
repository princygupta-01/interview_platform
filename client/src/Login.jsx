import { useState } from 'react';
import { API_BASE } from './config';

function Login({ onLoginSuccess }) {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
    const body = isSignup ? { name, email, password } : { email, password };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Something went wrong');
        setLoading(false);
        return;
      }

      localStorage.setItem('token', data.token);
      onLoginSuccess();
    } catch (err) {
      setError('Could not reach server');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden flex items-center justify-center px-4 py-10">
      {/* Faint grid background */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[140px]" />
      <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[300px] bg-purple-600/10 rounded-full blur-[120px]" />

      <div className="relative w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 mb-4">
            <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-3 3 3 3m8-6l3 3-3 3M13 5l-2 14" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-mono">
            CODE_INTERVIEW
          </h1>
          <p className="text-neutral-500 text-xs mt-1 font-mono uppercase tracking-widest">
            Live Technical Assessment Platform
          </p>
        </div>

        <div className="bg-neutral-950/80 backdrop-blur-xl rounded-2xl p-8 border border-neutral-800/80 shadow-2xl">
          <h2 className="text-white font-semibold text-lg">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-neutral-500 text-sm mt-1 mb-6">
            {isSignup ? 'Set up access to start running interviews.' : 'Authenticate to resume your session.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="text-neutral-500 text-xs font-mono uppercase tracking-wider mb-1.5 block">
                  Full_Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-900/60 text-white placeholder-neutral-600 rounded-lg px-4 py-2.5 outline-none border border-neutral-800 focus:border-blue-500/50 focus:bg-neutral-900 transition-all text-sm"
                  placeholder="Jane Doe"
                />
              </div>
            )}

            <div>
              <label className="text-neutral-500 text-xs font-mono uppercase tracking-wider mb-1.5 block">
                Email_Address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9" />
                  </svg>
                </span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-900/60 text-white placeholder-neutral-600 rounded-lg pl-10 pr-4 py-2.5 outline-none border border-neutral-800 focus:border-blue-500/50 focus:bg-neutral-900 transition-all text-sm font-mono"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="text-neutral-500 text-xs font-mono uppercase tracking-wider mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-900/60 text-white placeholder-neutral-600 rounded-lg pl-10 pr-11 py-2.5 outline-none border border-neutral-800 focus:border-blue-500/50 focus:bg-neutral-900 transition-all text-sm font-mono"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300 transition-colors"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <p className="text-red-400 text-sm">{error}</p>
                {!isSignup && (
                  <p className="text-neutral-500 text-xs mt-1.5">
                    Double check your email and password, or{' '}
                    <button
                      type="button"
                      onClick={() => { setIsSignup(true); setError(''); }}
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      create a new account
                    </button>.
                  </p>
                )}
                {isSignup && error.toLowerCase().includes('already exists') && (
                  <p className="text-neutral-500 text-xs mt-1.5">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setIsSignup(false); setError(''); }}
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      Log in instead
                    </button>.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 disabled:opacity-60 transition-all text-white font-medium rounded-lg py-2.5 shadow-lg shadow-purple-600/20"
            >
              {loading ? 'Please wait...' : (
                <>
                  {isSignup ? 'Sign Up' : 'Log In'}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <button
            onClick={() => { setIsSignup(!isSignup); setError(''); }}
            className="w-full text-neutral-500 hover:text-neutral-300 text-sm mt-5 transition-colors"
          >
            {isSignup ? 'Already have an account? ' : "Don't have an account? "}
            <span className="text-blue-400">{isSignup ? 'Log In' : 'Sign Up'}</span>
          </button>
        </div>

        <p className="text-center text-neutral-700 text-xs font-mono mt-6">v1.0.0-stable</p>
      </div>
    </div>
  );
}

export default Login;