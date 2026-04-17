import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface PresenceUser {
  profile_id: string
  name: string
  avatar_url: string | null
  online_at: string
}

/**
 * Supabase Realtime presence: cuántos usuarios (y quiénes) están viendo
 * este "room" ahora mismo. No persiste — si el usuario cierra la pestaña,
 * desaparece automáticamente.
 */
export function usePresence(roomKey: string | null) {
  const { profile } = useAuth()
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!roomKey || !profile) return

    const channel = supabase.channel(`presence:${roomKey}`, {
      config: { presence: { key: profile.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        // presenceState devuelve { [key]: PresenceUser[] } — flatteneamos
        // y deduplicamos por profile_id (una persona puede tener varias tabs).
        const flat = Object.values(state).flat()
        const unique = new Map<string, PresenceUser>()
        for (const u of flat) unique.set(u.profile_id, u)
        setUsers(Array.from(unique.values()))
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        await channel.track({
          profile_id: profile.id,
          name: profile.name,
          avatar_url: profile.avatar_url,
          online_at: new Date().toISOString(),
        } satisfies PresenceUser)
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [roomKey, profile?.id])

  return users
}
