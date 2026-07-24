import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useObjectives(projectId: string | null) {
  return useQuery({
    queryKey: ['objectives', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objectives')
        .select(`*, tasks(id, title, status, priority, due_date, assignee:profiles(id, name, avatar_url))`)
        .eq('project_id', projectId!)
        .order('start_date', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useCreateObjective() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (obj: {
      project_id: string
      name: string
      color: string
      start_date: string
      end_date: string
    }) => {
      const { data, error } = await supabase.from('objectives').insert(obj).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['objectives', data.project_id] }),
  })
}

export function useUpdateObjective() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string
      status?: string
      name?: string
      color?: string
      start_date?: string
      end_date?: string
    }) => {
      const { data, error } = await supabase.from('objectives').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['objectives', data.project_id] }),
  })
}

export function useDeleteObjective() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from('objectives').delete().eq('id', id)
      if (error) throw error
      return project_id
    },
    onSuccess: (project_id) => qc.invalidateQueries({ queryKey: ['objectives', project_id] }),
  })
}
