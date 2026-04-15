import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useAuthInit() {
  const { setUser, setProfile, setLoading, reset } = useAuthStore()

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
        // Profile not found or RLS error
      }
    }

    // Use onAuthStateChange as the single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }

      // Always unblock UI after processing any auth event
      if (mounted) setLoading(false)
    })

    // Fallback: if no auth event fires within 3s, unblock UI
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 3000)

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])
}

export function useAuth() {
  const { user, profile, loading } = useAuthStore()
  return { user, profile, loading, role: profile?.role ?? null }
}
