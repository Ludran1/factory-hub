import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useDeveloperDashboard(profileId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'developer', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [tasksRes, escalatedRes, objectivesRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*, objectives(name, color, project_id, projects(name))')
          .eq('assignee_id', profileId!)
          .neq('status', 'done')
          .order('created_at', { ascending: false }),
        supabase
          .from('tickets')
          .select('id, subject, client, priority, status, created_at')
          .not('escalated_task_id', 'is', null)
          .neq('status', 'Resuelto')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('objectives')
          .select('id, name, status, tasks(id, status)')
          .eq('status', 'en_progreso'),
      ])
      return {
        activeTasks: tasksRes.data ?? [],
        escalatedTickets: escalatedRes.data ?? [],
        activeObjectives: objectivesRes.data ?? [],
        tasksDone: 0,
      }
    },
  })
}

export function useSupportDashboard(profileId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'support', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [allTicketsRes, myTicketsRes, recentRes] = await Promise.all([
        supabase.from('tickets').select('id, status, priority'),
        supabase
          .from('tickets')
          .select('id, subject, client, priority, status, created_at')
          .eq('assigned_to', profileId!)
          .neq('status', 'Resuelto')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('tickets')
          .select('id, subject, client, priority, status, created_at')
          .eq('status', 'Abierto')
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      const all = allTicketsRes.data ?? []
      return {
        totalOpen: all.filter(t => t.status === 'Abierto').length,
        totalInReview: all.filter(t => t.status === 'En Revisión').length,
        totalResolved: all.filter(t => t.status === 'Resuelto').length,
        urgent: all.filter(t => t.priority === 'urgente' && t.status !== 'Resuelto').length,
        myTickets: myTicketsRes.data ?? [],
        recentOpen: recentRes.data ?? [],
      }
    },
  })
}

export function useCloserDashboard(profileId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'closer', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [leadsRes, tasksRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, company, contact_name, product, value, stage, expected_close_date')
          .eq('owner_id', profileId!)
          .order('updated_at', { ascending: false }),
        supabase
          .from('lead_tasks')
          .select('id, title, due_date, completed, lead_id, leads(company)')
          .eq('completed', false)
          .not('due_date', 'is', null)
          .order('due_date', { ascending: true })
          .limit(5),
      ])

      const leads = leadsRes.data ?? []
      return {
        totalPipeline: leads.reduce((s, l) => s + l.value, 0),
        closedValue: leads.filter(l => l.stage === 'cerrado').reduce((s, l) => s + l.value, 0),
        inNegotiation: leads.filter(l => l.stage === 'negociacion').length,
        prospects: leads.filter(l => l.stage === 'prospecto').length,
        myLeads: leads,
        pendingTasks: tasksRes.data ?? [],
      }
    },
  })
}

export function useMarketingDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'marketing'],
    queryFn: async () => {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, company, value, stage, source, created_at, owner:profiles!leads_owner_id_fkey(name)')
        .order('created_at', { ascending: false })

      const all = leads ?? []
      const bySource = all.reduce<Record<string, number>>((acc, l) => {
        acc[l.source] = (acc[l.source] ?? 0) + 1
        return acc
      }, {})
      const byStage = {
        prospecto: all.filter(l => l.stage === 'prospecto').length,
        demo: all.filter(l => l.stage === 'demo').length,
        negociacion: all.filter(l => l.stage === 'negociacion').length,
        cerrado: all.filter(l => l.stage === 'cerrado').length,
      }

      return {
        totalLeads: all.length,
        totalPipeline: all.reduce((s, l) => s + l.value, 0),
        closedValue: all.filter(l => l.stage === 'cerrado').reduce((s, l) => s + l.value, 0),
        conversionRate: all.length > 0 ? Math.round((byStage.cerrado / all.length) * 100) : 0,
        bySource,
        byStage,
        recentLeads: all.slice(0, 6),
      }
    },
  })
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: async () => {
      const [tasksRes, ticketsRes, leadsRes, profilesRes] = await Promise.all([
        supabase.from('tasks').select('id, status'),
        supabase.from('tickets').select('id, status, priority'),
        supabase.from('leads').select('id, value, stage'),
        supabase.from('profiles').select('id, name, role, avatar_url'),
      ])

      const tasks = tasksRes.data ?? []
      const tickets = ticketsRes.data ?? []
      const leads = leadsRes.data ?? []
      const profiles = profilesRes.data ?? []

      return {
        totalTasks: tasks.length,
        activeTasks: tasks.filter(t => t.status === 'in_progress').length,
        openTickets: tickets.filter(t => t.status === 'Abierto').length,
        urgentTickets: tickets.filter(t => t.priority === 'urgente' && t.status !== 'Resuelto').length,
        totalPipeline: leads.reduce((s, l) => s + l.value, 0),
        closedDeals: leads.filter(l => l.stage === 'cerrado').length,
        teamSize: profiles.length,
        profiles,
      }
    },
  })
}
