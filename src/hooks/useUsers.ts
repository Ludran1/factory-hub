import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { UserRole } from '@/types/database'

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
      // Los signups públicos están deshabilitados en Supabase: el alta pasa por
      // la Edge Function create-user (valida que el llamador sea admin y crea
      // el usuario con la Admin API — sin race con el trigger ni signUp cliente).
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: input,
      })
      if (error) {
        let message = error.message
        if (error instanceof FunctionsHttpError) {
          try {
            const body = await error.context.json()
            if (body?.error) message = body.error
          } catch { /* respuesta sin JSON */ }
        }
        throw new Error(message)
      }
      return data as { user_id: string }
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
