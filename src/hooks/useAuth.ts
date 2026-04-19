import { useEffect } from 'react'
import { supabase, clearCorruptSession } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useAuthInit() {
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    let mounted = true

    async function fetchProfile(userId: string) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single()
        if (mounted && data) setProfile(data)
      } catch {
        // ignore
      }
    }

    async function init() {
      // Race getSession() against a timeout. If supabase-js quedó colgado
      // (refresh token roto, etc.) limpiamos storage solo y seguimos como logged-out.
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise<'timeout'>(resolve =>
        setTimeout(() => resolve('timeout'), 4000)
      )

      const result = await Promise.race([sessionPromise, timeoutPromise])
      if (!mounted) return

      if (result === 'timeout') {
        clearCorruptSession()
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      const session = result.data.session
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    }

    init()

    // Escucha cambios posteriores (signIn/signOut en otras tabs, refresh token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        return
      }

      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])
}

export function useAuth() {
  const { user, profile, loading } = useAuthStore()
  return { user, profile, loading, role: profile?.role ?? null }
}
