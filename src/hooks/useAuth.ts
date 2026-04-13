import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useAuthInit() {
  const { setUser, setProfile, setLoading, reset } = useAuthStore()

  useEffect(() => {
    let mounted = true

    async function fetchProfile(userId: string) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!mounted) return
        if (error) throw error
        if (data) setProfile(data)
      } catch {
        // Profile not found or RLS error — still unblock the UI
      } finally {
        if (mounted) setLoading(false)
      }
    }

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else {
          reset()
        }
      } catch {
        if (mounted) reset()
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        reset()
      } else if (event === 'INITIAL_SESSION') {
        // Already handled by getSession above — ignore
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
