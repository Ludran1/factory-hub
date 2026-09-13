import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Lista de pizarras SIN el dibujo. excalidraw_data trae las imágenes en base64
 * (una pizarra pesa 716 kB) y la barra lateral solo necesita nombre y fecha. El
 * dibujo se pide aparte y solo el de la pizarra abierta (useBoardData).
 */
export function useBoards(projectId: string | null) {
  return useQuery({
    queryKey: ['boards', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collab_boards')
        .select('id, project_id, name, updated_at, updated_by, updater:profiles(id, name)')
        .eq('project_id', projectId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/**
 * El dibujo de UNA pizarra. Sin refetch al volver a la pestaña: Excalidraw solo
 * lee el dibujo al montar, así que descargarlo otra vez con la pizarra abierta
 * gasta egress sin cambiar nada en pantalla.
 */
export function useBoardData(boardId: string | null) {
  return useQuery({
    queryKey: ['board', boardId],
    enabled: !!boardId,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collab_boards')
        .select('id, excalidraw_data')
        .eq('id', boardId!)
        .single()
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
    mutationFn: async ({ id, excalidraw_data, updated_by }: {
      id: string; excalidraw_data: object; updated_by: string; project_id: string
    }) => {
      // .select('id') y no .select(): sin columnas, PostgREST devolvía la pizarra
      // entera en cada autoguardado (2.337 guardados en dos horas sobre una sola
      // pizarra el 12-sep). El id alcanza para detectar que RLS bloqueó el update.
      const { data, error } = await supabase
        .from('collab_boards')
        .update({ excalidraw_data, updated_by, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('No se pudo guardar: RLS bloqueó el update o la pizarra no existe')
      }
      return data[0]
    },
    // No se invalida: forzaría un refetch mientras el usuario sigue dibujando. Se
    // actualiza la caché con lo que ya está en memoria, así volver a esta pizarra
    // muestra lo último guardado sin descargarlo.
    onSuccess: (_, vars) => {
      qc.setQueryData(['board', vars.id], {
        id: vars.id,
        excalidraw_data: vars.excalidraw_data as Record<string, unknown>,
      })
    },
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
