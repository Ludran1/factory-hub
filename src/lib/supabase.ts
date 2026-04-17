import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Singleton atado a window para sobrevivir HMR.
// Sin esto, cada hot reload crea un GoTrueClient nuevo que se pisa con el viejo
// en el mismo storage key y deja el refresh token en un estado inconsistente.
declare global {
  interface Window {
    __supabase_client__?: SupabaseClient<Database>
  }
}

function getClient(): SupabaseClient<Database> {
  if (typeof window !== 'undefined' && window.__supabase_client__) {
    return window.__supabase_client__
  }
  const client = createClient<Database>(supabaseUrl, supabaseAnonKey)
  if (typeof window !== 'undefined') {
    window.__supabase_client__ = client
  }
  return client
}

export const supabase = getClient()
