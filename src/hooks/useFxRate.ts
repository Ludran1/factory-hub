import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface FxRate {
  date: string
  usd_pen: number
  source: string
  /** true si el BCRP aún no publicó el valor de hoy (es lo normal intradía). */
  stale: boolean
  warning?: string
}

/**
 * Precarga el TC para cotizaciones en USD. Nunca bloquea: si falla, el campo
 * del editor sigue siendo editable a mano.
 */
export function useFxRate(enabled = true) {
  return useQuery({
    queryKey: ['fx-rate'],
    enabled,
    staleTime: 1000 * 60 * 60,   // el BCRP publica una vez al día
    retry: 1,
    queryFn: async (): Promise<FxRate | null> => {
      const { data, error } = await supabase.functions.invoke<FxRate>('fx-rate')
      if (error || !data || 'error' in data) return null
      return data
    },
  })
}
