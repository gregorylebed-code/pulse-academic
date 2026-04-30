import { useState } from 'react'
import { supabase } from './lib/supabase'

type Props = {
  onDemo: () => void
}

type Mode = 'login' | 'signup'

export default function AuthScreen({ onDemo }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmSent, setConfirmSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        setConfirmSent(true)
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        // Auth state change handled by Root.tsx listener
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ background: '#f5f0e8' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Pulse</h1>
          <p className="text-sm text-slate-400 mt-1">Academic Tracker</p>
        </div>

        {confirmSent ? (
          <div className="bg-white rounded-2xl shadow-sm px-6 py-8 text-center">
            <p className="text-2xl mb-3">📬</p>
            <h2 className="text-base font-bold text-slate-800 mb-2">Check your email</h2>
            <p className="text-sm text-slate-500">We sent a confirmation link to <span className="font-semibold text-slate-700">{email}</span>. Click it to activate your account, then come back and log in.</p>
            <button
              type="button"
              onClick={() => { setConfirmSent(false); setMode('login') }}
              className="mt-5 text-sm font-semibold text-teal-600 hover:text-teal-700"
            >
              Back to log in
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm px-6 py-6">
            <h2 className="text-base font-bold text-slate-800 mb-5">
              {mode === 'login' ? 'Log in to your account' : 'Create your account'}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@school.edu"
                  className="w-full text-sm bg-slate-50 rounded-xl px-4 py-2.5 outline-none border border-slate-100 focus:border-teal-300 text-slate-700 placeholder-slate-300"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
                  className="w-full text-sm bg-slate-50 rounded-xl px-4 py-2.5 outline-none border border-slate-100 focus:border-teal-300 text-slate-700 placeholder-slate-300"
                />
              </div>
              {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-teal-500 text-white text-sm font-semibold rounded-2xl disabled:opacity-50 mt-1"
              >
                {loading ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
                className="text-xs text-slate-400 hover:text-teal-600 font-semibold"
              >
                {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
              </button>
            </div>
          </div>
        )}

        {/* Demo */}
        <div className="mt-5 text-center">
          <p className="text-xs text-slate-400 mb-2">Just browsing?</p>
          <button
            type="button"
            onClick={onDemo}
            className="text-sm font-semibold text-teal-600 hover:text-teal-700 bg-white rounded-2xl px-6 py-2.5 shadow-sm"
          >
            Try the demo →
          </button>
        </div>
      </div>
    </div>
  )
}
