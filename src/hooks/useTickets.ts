import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TicketStatus, TicketPriority } from '@/types/database'

export function useTickets(filters?: { status?: string; priority?: string; search?: string }) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select(`*, assigned:profiles!tickets_assigned_to_fkey(id, name, avatar_url)`)
        .order('created_at', { ascending: false })

      if (filters?.status && filters.status !== 'all')
        query = query.eq('status', filters.status)
      if (filters?.priority && filters.priority !== 'all')
        query = query.eq('priority', filters.priority)
      if (filters?.search)
        query = query.or(`client.ilike.%${filters.search}%,subject.ilike.%${filters.search}%,id.ilike.%${filters.search}%`)

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useTicket(id: string | null) {
  return useQuery({
    queryKey: ['ticket', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          assigned:profiles!tickets_assigned_to_fkey(id, name, avatar_url),
          ticket_comments(*, author:profiles(id, name, avatar_url)),
          ticket_activity(*, author:profiles(id, name))
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ticket: {
      client: string
      system: string
      subject: string
      description?: string
      priority: TicketPriority
      assigned_to?: string | null
    }) => {
      const { data, error } = await supabase.from('tickets').insert(ticket).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useUpdateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string
      status?: TicketStatus
      priority?: TicketPriority
      assigned_to?: string | null
      resolved_at?: string | null
    }) => {
      const { data, error } = await supabase.from('tickets').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      qc.invalidateQueries({ queryKey: ['ticket', vars.id] })
    },
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticket_id, author_id, body }: { ticket_id: string; author_id: string; body: string }) => {
      const { data, error } = await supabase.from('ticket_comments').insert({ ticket_id, author_id, body, is_internal: true }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['ticket', vars.ticket_id] }),
  })
}

export function useAddActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticket_id, author_id, action, metadata }: {
      ticket_id: string
      author_id: string
      action: string
      metadata?: Record<string, unknown>
    }) => {
      const { data, error } = await supabase.from('ticket_activity').insert({ ticket_id, author_id, action, metadata }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['ticket', vars.ticket_id] }),
  })
}

export function useSupportAgents() {
  return useQuery({
    queryKey: ['support-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('role', ['support', 'admin'])
        .order('name')
      if (error) throw error
      return data
    },
  })
}
