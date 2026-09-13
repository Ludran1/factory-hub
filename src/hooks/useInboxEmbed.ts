import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * URL de la bandeja de WhatsApp de Kapso para el iframe de la pestaña Chat.
 *
 * La entrega la Edge Function kapso-inbox-embed después de validar el acceso: el
 * URL lleva un token con acceso a las conversaciones, así que nunca vive en el
 * código del navegador. No cambia entre sesiones, por eso no se vuelve a pedir.
 */
export function useInboxEmbed(enabled: boolean) {
  return useQuery({
    queryKey: ['kapso-inbox-embed'],
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ embed_url?: string; error?: string }>(
        'kapso-inbox-embed',
        { body: {} },
      )
      if (error) {
        // La función manda el motivo real en el body aunque responda con error.
        const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(detalle?.error ?? error.message)
      }
      if (!data?.embed_url) throw new Error(data?.error ?? 'Kapso no devolvió la bandeja')
      return data.embed_url
    },
  })
}
