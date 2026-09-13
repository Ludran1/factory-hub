import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TaskStatus } from '@/types/database'

export function useTasks(projectId: string | null) {
  return useQuery({
    queryKey: ['tasks', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      // Columnas explícitas, SIN `description`: el documento de tiptap trae las
      // imágenes pegadas en base64 (una tarea llega a 1,45 MB) y el tablero solo
      // necesita saber si hay descripción. El contenido se pide al abrir la tarea.
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id, objective_id, title, priority, status, assignee_id, due_date,
          time_spent_seconds, timer_started_at, has_description, created_at, updated_at,
          objectives!inner(id, name, color, project_id),
          task_assignees(profile:profiles(id, name, avatar_url))
        `)
        .eq('objectives.project_id', projectId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      // Aplanar task_assignees → assignees: [{id, name, avatar_url}]
      return ((data ?? []) as any[]).map(t => ({
        ...t,
        assignees: (t.task_assignees ?? []).map((a: any) => a.profile).filter(Boolean),
      }))
    },
  })
}

/** La descripción de UNA tarea, al abrirla: es lo único que la necesita entera. */
export function useTaskDescription(taskId: string | null) {
  return useQuery({
    queryKey: ['task-description', taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('description')
        .eq('id', taskId!)
        .single()
      if (error) throw error
      return (data?.description ?? null) as unknown
    },
  })
}

async function setTaskAssignees(taskId: string, assigneeIds: string[]) {
  const { data: current, error: readError } = await supabase
    .from('task_assignees')
    .select('profile_id')
    .eq('task_id', taskId)
  if (readError) throw readError
  const currentIds = (current ?? []).map(a => a.profile_id)
  const toAdd = assigneeIds.filter(id => !currentIds.includes(id))
  const toRemove = currentIds.filter(id => !assigneeIds.includes(id))
  // Solo insertar los nuevos (insertar dispara la notificación de asignación)
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('task_assignees')
      .insert(toAdd.map(profile_id => ({ task_id: taskId, profile_id })))
    if (error) throw error
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('task_assignees')
      .delete()
      .eq('task_id', taskId)
      .in('profile_id', toRemove)
    if (error) throw error
  }
}

// En todas las mutaciones: .select('id') y no .select(). Sin columnas, PostgREST
// devuelve la fila completa —descripción con imágenes incluida— en cada cambio de
// estado o de timer, y nadie usa esa respuesta. `.single()` sigue fallando si RLS
// bloqueó el update, que es lo que importa detectar.

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ assignee_ids, ...task }: {
      objective_id: string
      title: string
      priority: string
      assignee_ids?: string[]
      due_date?: string | null
      description?: unknown
    }) => {
      const { data, error } = await supabase.from('tasks').insert(task).select('id').single()
      if (error) throw error
      if (assignee_ids && assignee_ids.length > 0) {
        await setTaskAssignees(data.id, assignee_ids)
      }
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
            .select('id')
            .single()
          if (error) throw error
          return data
        }
      }
      const { data, error } = await supabase.from('tasks').update({ status }).eq('id', id).select('id').single()
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
    mutationFn: async ({ id, assignee_ids, ...updates }: { id: string; title?: string; priority?: string; status?: string; assignee_ids?: string[]; due_date?: string | null; description?: unknown }) => {
      const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select('id').single()
      if (error) throw error
      if (assignee_ids) {
        await setTaskAssignees(id, assignee_ids)
      }
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['objectives'] })
      // Lo que se acaba de guardar ya está en memoria: reabrir la tarea no lo descarga.
      if ('description' in vars) {
        qc.setQueryData(['task-description', vars.id], vars.description ?? null)
      }
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
          .select('id')
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
        .select('id')
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
      return id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['objectives'] })
      qc.removeQueries({ queryKey: ['task-description', id] })
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
