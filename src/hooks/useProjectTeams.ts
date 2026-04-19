import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ProjectMemberRole } from '@/types/database'

export interface ProjectMember {
  id: string
  name: string
  avatar_url: string | null
  taskCount: number
  doneCount: number
  /** Miembro explícito (en project_members) o derivado de tareas */
  explicit: boolean
  /** Solo presente si es miembro explícito */
  role: ProjectMemberRole | null
  /** ID de la fila en project_members, solo si es explícito (para poder eliminar) */
  memberRowId: string | null
}

export interface ProjectWithTeam {
  id: string
  name: string
  client: string
  color: string
  status: string
  totalTasks: number
  doneTasks: number
  progress: number
  members: ProjectMember[]
}

/**
 * Obtiene todos los proyectos con su equipo combinando:
 * 1. Miembros explícitos de `project_members` (con rol owner/contributor)
 * 2. Miembros derivados: usuarios con tareas asignadas en el proyecto
 * Los explícitos siempre van primero, ordenados por rol (owner → contributor).
 * Los derivados que no están en explícitos aparecen después, ordenados por # tareas.
 */
export function useProjectTeams() {
  return useQuery({
    queryKey: ['project-teams'],
    queryFn: async (): Promise<ProjectWithTeam[]> => {
      const [projectsRes, tasksRes, membersRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, client, color, status')
          .order('name'),
        supabase
          .from('tasks')
          .select(`
            id,
            status,
            assignee_id,
            objective_id,
            objectives!inner(project_id),
            assignee:profiles(id, name, avatar_url)
          `),
        supabase
          .from('project_members')
          .select('id, project_id, profile_id, role, profile:profiles(id, name, avatar_url)'),
      ])

      if (projectsRes.error) throw projectsRes.error
      if (tasksRes.error) throw tasksRes.error
      // members puede fallar si la tabla aún no existe (migration no aplicada) — degradamos suavemente
      const membersData = membersRes.error ? [] : (membersRes.data ?? [])

      const projects = projectsRes.data ?? []
      const tasks = (tasksRes.data ?? []) as any[]
      const members = membersData as any[]

      return projects.map(p => {
        const projectTasks = tasks.filter(t => t.objectives?.project_id === p.id)
        const totalTasks = projectTasks.length
        const doneTasks = projectTasks.filter(t => t.status === 'done').length

        const memberMap = new Map<string, ProjectMember>()

        // 1. Miembros explícitos
        for (const m of members.filter(x => x.project_id === p.id)) {
          if (!m.profile) continue
          memberMap.set(m.profile.id, {
            id: m.profile.id,
            name: m.profile.name,
            avatar_url: m.profile.avatar_url,
            taskCount: 0,
            doneCount: 0,
            explicit: true,
            role: m.role as ProjectMemberRole,
            memberRowId: m.id,
          })
        }

        // 2. Sumar conteos de tareas (puede ser un miembro explícito o nuevo derivado)
        for (const t of projectTasks) {
          if (!t.assignee) continue
          const a = t.assignee as { id: string; name: string; avatar_url: string | null }
          const existing = memberMap.get(a.id)
          if (existing) {
            existing.taskCount += 1
            if (t.status === 'done') existing.doneCount += 1
          } else {
            memberMap.set(a.id, {
              id: a.id,
              name: a.name,
              avatar_url: a.avatar_url,
              taskCount: 1,
              doneCount: t.status === 'done' ? 1 : 0,
              explicit: false,
              role: null,
              memberRowId: null,
            })
          }
        }

        // Orden: explícitos (owner → contributor) → derivados (por # tareas desc)
        const sorted = Array.from(memberMap.values()).sort((a, b) => {
          if (a.explicit && !b.explicit) return -1
          if (!a.explicit && b.explicit) return 1
          if (a.explicit && b.explicit) {
            if (a.role === 'owner' && b.role !== 'owner') return -1
            if (a.role !== 'owner' && b.role === 'owner') return 1
          }
          return b.taskCount - a.taskCount
        })

        return {
          ...p,
          totalTasks,
          doneTasks,
          progress: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
          members: sorted,
        }
      })
    },
  })
}
