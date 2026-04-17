import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      // Safeguard: si supabase-js queda colgado (token corrupto, refresh stuck, etc.)
      // forzamos error a los 10s para que la UI muestre "Reintentar" y no spinner eterno.
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
