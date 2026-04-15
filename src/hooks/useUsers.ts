import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import type { Database, UserRole } from '@/types/database'

// Separate client for signUp so it doesn't overwrite the admin's session
const supabaseSignUp = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false } }
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

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; password: string; name: string; role: UserRole; allowed_modules: string[] }) => {
      // 1. Create auth user with the isolated client
      const { data: authData, error: authError } = await supabaseSignUp.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { name: input.name },
        },
      })
      if (authError) throw new Error(`Auth: ${authError.message}`)
      if (!authData.user) throw new Error('No se pudo crear el usuario')

      // 2. Small delay for trigger to create profile, then update it
      await new Promise(r => setTimeout(r, 1000))

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: input.role, name: input.name, email: input.email, allowed_modules: input.allowed_modules })
        .eq('user_id', authData.user.id)

      if (profileError) console.warn('Profile update:', profileError.message)

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
