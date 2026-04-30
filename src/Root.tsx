import { useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import App from './App.tsx'
import AuthScreen from './AuthScreen.tsx'
import SetupScreen from './SetupScreen.tsx'

type AppState = 'loading' | 'auth' | 'setup' | 'app' | 'demo'

export default function Root() {
  const [state, setState] = useState<AppState>('loading')
  const [session, setSession] = useState<Session | null>(null)

  const checkSetup = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('classes')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
    setState(!data || data.length === 0 ? 'setup' : 'app')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        checkSetup(session.user.id)
      } else {
        setState('auth')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        checkSetup(session.user.id)
      } else {
        setState('auth')
      }
    })

    return () => subscription.unsubscribe()
  }, [checkSetup])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setState('auth')
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f0e8' }}>
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (state === 'auth') {
    return <AuthScreen onDemo={() => setState('demo')} />
  }

  if (state === 'demo') {
    return <App userId="demo-user" isDemo onSignOut={() => setState('auth')} />
  }

  if (state === 'setup' && session) {
    return <SetupScreen userId={session.user.id} onDone={() => setState('app')} />
  }

  if (state === 'app' && session) {
    return <App userId={session.user.id} onSignOut={handleSignOut} />
  }

  return null
}
