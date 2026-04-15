import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useBoards(projectId: string | null) {
  return useQuery({
    queryKey: ['boards', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collab_boards')
        .select('*')
        .eq('project_id', projectId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, name }: { project_id: string; name: string }) => {
      const { data, error } = await supabase
        .from('collab_boards')
        .insert({ project_id, name, excalidraw_data: null })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['boards', data.project_id] }),
  })
}

export function useSaveBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, excalidraw_data, updated_by, project_id }: {
      id: string; excalidraw_data: object; updated_by: string; project_id: string
    }) => {
      const { error } = await supabase
        .from('collab_boards')
        .update({ excalidraw_data, updated_by, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['boards', vars.project_id] }),
  })
}

export function useNotes(projectId: string | null) {
  return useQuery({
    queryKey: ['notes', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*, author:profiles(id, name)')
        .eq('project_id', projectId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, author_id, title }: {
      project_id: string; author_id: string; title: string
    }) => {
      const { data, error } = await supabase
        .from('notes')
        .insert({ project_id, author_id, title, content: null })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['notes', data.project_id] }),
  })
}

export function useSaveNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, title, content, project_id }: {
      id: string; title: string; content: object; project_id: string
    }) => {
      const { error } = await supabase
        .from('notes')
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['notes', vars.project_id] }),
  })
}

export function useDeleteBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from('collab_boards').delete().eq('id', id)
      if (error) throw error
      return project_id
    },
    onSuccess: (project_id) => qc.invalidateQueries({ queryKey: ['boards', project_id] }),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
      return project_id
    },
    onSuccess: (project_id) => qc.invalidateQueries({ queryKey: ['notes', project_id] }),
  })
}
