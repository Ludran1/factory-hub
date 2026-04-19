import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ProjectMemberRole } from '@/types/database'

export interface ProjectMemberWithProfile {
  id: string
  project_id: string
  profile_id: string
  role: ProjectMemberRole
  added_at: string
  profile: {
    id: string
    name: string
    avatar_url: string | null
    role: string
  }
}

export function useProjectMembers(projectId: string | null) {
  return useQuery({
    queryKey: ['project-members', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_members')
        .select('*, profile:profiles(id, name, avatar_url, role)')
        .eq('project_id', projectId!)
        .order('added_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as ProjectMemberWithProfile[]
    },
  })
}

export function useAllProjectMembers() {
  return useQuery({
    queryKey: ['project-members', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_members')
        .select('id, project_id, profile_id, role, profile:profiles(id, name, avatar_url)')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useAddProjectMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, profile_id, role = 'contributor' }: {
      project_id: string
      profile_id: string
      role?: ProjectMemberRole
    }) => {
      const { data, error } = await supabase
        .from('project_members')
        .insert({ project_id, profile_id, role })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['project-members', vars.project_id] })
      qc.invalidateQueries({ queryKey: ['project-members', 'all'] })
      qc.invalidateQueries({ queryKey: ['project-teams'] })
    },
  })
}

export function useRemoveProjectMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from('project_members').delete().eq('id', id)
      if (error) throw error
      return project_id
    },
    onSuccess: (project_id) => {
      qc.invalidateQueries({ queryKey: ['project-members', project_id] })
      qc.invalidateQueries({ queryKey: ['project-members', 'all'] })
      qc.invalidateQueries({ queryKey: ['project-teams'] })
    },
  })
}

export function useUpdateProjectMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role, project_id }: {
      id: string
      role: ProjectMemberRole
      project_id: string
    }) => {
      const { error } = await supabase
        .from('project_members')
        .update({ role })
        .eq('id', id)
      if (error) throw error
      return project_id
    },
    onSuccess: (project_id) => {
      qc.invalidateQueries({ queryKey: ['project-members', project_id] })
      qc.invalidateQueries({ queryKey: ['project-members', 'all'] })
      qc.invalidateQueries({ queryKey: ['project-teams'] })
    },
  })
}
