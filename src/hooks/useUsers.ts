import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import type { Database, UserRole } from '@/types/database'

// Separate client for signUp so it doesn't overwrite the admin's session.
// Needs a unique storageKey to avoid the "Multiple GoTrueClient instances" warning,
// which can race with the main client and stall queries.
const supabaseSignUp = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false, storageKey: 'sb-signup-only' } }
)

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })
}

/** Devuelve todos los perfiles (id, name, avatar_url, role) — útil para selectors de asignación */
export function useAllProfiles() {
  return useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, role')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; password: string; name: string; role: UserRole; allowed_modules: string[] }) => {
      // Pasamos todo el contexto en raw_user_meta_data para que el trigger
      // handle_new_user cree el profile ya con role/modules/email correctos.
      // Sin delay ni update posterior — menos race conditions.
      const { data: authData, error: authError } = await supabaseSignUp.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            name: input.name,
            role: input.role,
            allowed_modules: input.allowed_modules,
          },
        },
      })
      if (authError) throw new Error(`Auth: ${authError.message}`)
      if (!authData.user) throw new Error('No se pudo crear el usuario')

      // Upsert (INSERT si no existe, UPDATE si el trigger ya lo creó).
      // Así funciona aunque el trigger haya fallado silenciosamente.
      await new Promise(r => setTimeout(r, 500))
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: authData.user.id,
          role: input.role,
          name: input.name,
          email: input.email,
          allowed_modules: input.allowed_modules,
        }, { onConflict: 'user_id' })

      if (profileError) {
        throw new Error(`Perfil: ${profileError.message}`)
      }

      return authData.user
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, role }: { profileId: string; role: UserRole }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', profileId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUserModules() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, allowed_modules }: { profileId: string; allowed_modules: string[] }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ allowed_modules })
        .eq('id', profileId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
    },
  })
}

export function useUpdateUserName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, name }: { profileId: string; name: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ name })
        .eq('id', profileId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}
