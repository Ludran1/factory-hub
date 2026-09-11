import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { OrgSettings } from '@/types/database'

/**
 * Datos del emisor: fila única. Se leen en vivo, no se congelan por
 * cotización — tu RUC cambia casi nunca y cuando cambia quieres que los
 * documentos viejos muestren el actual (ver docs/prd-cotizaciones.md §5.1).
 */
export function useOrgSettings() {
  return useQuery({
    queryKey: ['org-settings'],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_settings')
        .select('*')
        .eq('id', true)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateOrgSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (updates: Partial<Omit<OrgSettings, 'id' | 'updated_at'>>) => {
      const { data, error } = await supabase
        .from('org_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', true)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-settings'] }),
  })
}
