import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function useNotifications() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const profileId = profile?.id

  // Realtime: al insertarse una notificación propia, refrescar la lista.
  // El polling de refetchInterval queda como respaldo si el canal se cae.
  useEffect(() => {
    if (!profileId) return
    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profileId}` },
        () => qc.invalidateQueries({ queryKey: ['notifications'] })
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [profileId, qc])

  return useQuery({
    queryKey: ['notifications', profileId],
    enabled: !!profileId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      if (ids.length === 0) return
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
