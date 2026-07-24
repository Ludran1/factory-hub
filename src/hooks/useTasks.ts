import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TaskStatus } from '@/types/database'

export function useTasks(projectId: string | null) {
  return useQuery({
    queryKey: ['tasks', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          objectives!inner(id, name, color, project_id),
          assignee:profiles(id, name, avatar_url)
        `)
        .eq('objectives.project_id', projectId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (task: {
      objective_id: string
      title: string
      priority: string
      assignee_id?: string | null
      due_date?: string | null
    }) => {
      const { data, error } = await supabase.from('tasks').insert(task).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['objectives'] })
    },
  })
}

function elapsedSeconds(timerStartedAt: string) {
  return Math.max(0, Math.round((Date.now() - new Date(timerStartedAt).getTime()) / 1000))
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      // Al completar una tarea con temporizador corriendo, se detiene y acumula
      if (status === 'done') {
        const { data: row } = await supabase
          .from('tasks')
          .select('time_spent_seconds, timer_started_at')
          .eq('id', id)
          .single()
        if (row?.timer_started_at) {
          const { data, error } = await supabase
            .from('tasks')
            .update({
              status,
              time_spent_seconds: row.time_spent_seconds + elapsedSeconds(row.timer_started_at),
              timer_started_at: null,
            })
            .eq('id', id)
            .select()
            .single()
          if (error) throw error
          return data
        }
      }
      const { data, error } = await supabase.from('tasks').update({ status }).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['objectives'] })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; priority?: string; status?: string; assignee_id?: string | null; due_date?: string | null }) => {
      const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['objectives'] })
    },
  })
}

export function useToggleTimer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'stop' }) => {
      if (action === 'start') {
        const { data, error } = await supabase
          .from('tasks')
          .update({ timer_started_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data
      }
      const { data: row, error: readError } = await supabase
        .from('tasks')
        .select('time_spent_seconds, timer_started_at')
        .eq('id', id)
        .single()
      if (readError) throw readError
      const elapsed = row.timer_started_at ? elapsedSeconds(row.timer_started_at) : 0
      const { data, error } = await supabase
        .from('tasks')
        .update({ time_spent_seconds: row.time_spent_seconds + elapsed, timer_started_at: null })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['objectives'] })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['objectives'] })
    },
  })
}

export function useDevelopers() {
  return useQuery({
    queryKey: ['developers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, role')
        .in('role', ['developer', 'admin'])
        .order('name')
      if (error) throw error
      return data
    },
  })
}
