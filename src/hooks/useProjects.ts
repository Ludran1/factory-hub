import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      console.log('[useProjects] queryFn START')
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false })
        console.log('[useProjects] queryFn END', { data, error })
        if (error) throw error
        return data
      } catch (e) {
        console.error('[useProjects] queryFn THREW', e)
        throw e
      }
    },
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (project: { name: string; client: string; color: string }) => {
      const { data, error } = await supabase.from('projects').insert(project).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}
