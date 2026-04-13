import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { LeadStage, LeadSource } from '@/types/database'

export function useLeads(filters?: { stage?: string; search?: string; ownerId?: string }) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('*, owner:profiles!leads_owner_id_fkey(id, name, avatar_url)')
        .order('created_at', { ascending: false })

      if (filters?.stage && filters.stage !== 'all')
        query = query.eq('stage', filters.stage)
      if (filters?.ownerId)
        query = query.eq('owner_id', filters.ownerId)
      if (filters?.search)
        query = query.or(`company.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,product.ilike.%${filters.search}%`)

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useLead(id: string | null) {
  return useQuery({
    queryKey: ['lead', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          owner:profiles!leads_owner_id_fkey(id, name, avatar_url),
          lead_activities(*, author:profiles(id, name, avatar_url)),
          lead_tasks(*, assigned:profiles!lead_tasks_assigned_to_fkey(id, name))
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lead: {
      company: string
      contact_name: string
      contact_email?: string | null
      contact_phone?: string | null
      product: string
      value: number
      stage: LeadStage
      source: LeadSource
      owner_id?: string | null
      expected_close_date?: string | null
      notes?: string | null
    }) => {
      const { data, error } = await supabase.from('leads').insert(lead).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<{
      company: string; contact_name: string; contact_email: string | null
      contact_phone: string | null; product: string; value: number
      stage: LeadStage; source: LeadSource; owner_id: string | null
      expected_close_date: string | null; notes: string | null
    }>) => {
      const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['lead', vars.id] })
    },
  })
}

export function useAddLeadActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ lead_id, author_id, type, body }: {
      lead_id: string; author_id: string
      type: 'llamada' | 'reunion' | 'email' | 'nota'; body: string
    }) => {
      const { data, error } = await supabase.from('lead_activities').insert({ lead_id, author_id, type, body }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['lead', vars.lead_id] }),
  })
}

export function useAddLeadTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ lead_id, title, due_date }: { lead_id: string; title: string; due_date?: string | null }) => {
      const { data, error } = await supabase.from('lead_tasks').insert({ lead_id, title, due_date: due_date || null }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['lead', vars.lead_id] }),
  })
}

export function useToggleLeadTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, completed, lead_id }: { id: string; completed: boolean; lead_id: string }) => {
      const { error } = await supabase.from('lead_tasks').update({ completed }).eq('id', id)
      if (error) throw error
      return lead_id
    },
    onSuccess: (lead_id) => qc.invalidateQueries({ queryKey: ['lead', lead_id] }),
  })
}

export function useClosers() {
  return useQuery({
    queryKey: ['closers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('role', ['closer', 'admin'])
        .order('name')
      if (error) throw error
      return data
    },
  })
}
