import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useProjects() {
  const user = useAuthStore(s => s.user)
  return useQuery({
    queryKey: ['projects'],
    enabled: !!user,
    queryFn: async () => {
      const query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tiempo de espera agotado al cargar proyectos. Intenta cerrar sesión y volver a entrar.')), 10000)
      )

      const { data, error } = await Promise.race([query, timeout])
      if (error) throw error
      return data
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['objectives'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ member_ids, ...project }: { name: string; client: string; color: string; member_ids?: string[] }) => {
      const { data, error } = await supabase.from('projects').insert(project).select().single()
      if (error) throw error
      // El trigger ya agregó al creador como owner; acá van los miembros elegidos
      // (ignoreDuplicates para no pisar la fila de owner del creador).
      if (member_ids && member_ids.length > 0) {
        const { error: membersError } = await supabase
          .from('project_members')
          .upsert(
            member_ids.map(profile_id => ({ project_id: data.id, profile_id })),
            { onConflict: 'project_id,profile_id', ignoreDuplicates: true }
          )
        if (membersError) throw membersError
      }
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}
