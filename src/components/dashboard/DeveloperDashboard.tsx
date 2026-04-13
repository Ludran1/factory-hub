import { CheckSquare, AlertTriangle, Target, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import StatCard from './StatCard'
import { useDeveloperDashboard } from '@/hooks/useDashboard'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

const priorityColor: Record<string, string> = {
  low: 'secondary',
  medium: 'warning',
  high: 'destructive',
  critical: 'destructive',
}

export default function DeveloperDashboard() {
  const { profile } = useAuth()
  const { data, isLoading } = useDeveloperDashboard(profile?.id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const { activeTasks = [], escalatedTickets = [], activeObjectives = [] } = data ?? {}

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Tareas activas"
          value={activeTasks.length}
          icon={<CheckSquare className="h-5 w-5" />}
          color="primary"
        />
        <StatCard
          label="En progreso"
          value={activeTasks.filter(t => t.status === 'in_progress').length}
          icon={<Clock className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          label="Objetivos activos"
          value={activeObjectives.length}
          icon={<Target className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          label="Tickets escalados"
          value={escalatedTickets.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          color={escalatedTickets.length > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Active tasks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Mis tareas pendientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeTasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin tareas pendientes</p>
            )}
            {activeTasks.slice(0, 6).map(task => (
              <div key={task.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.objectives && (
                    <p className="text-xs text-muted-foreground truncate">
                      {(task.objectives as any).name} · {(task.objectives as any).projects?.name}
                    </p>
                  )}
                </div>
                <Badge variant={priorityColor[task.priority] as any} className="shrink-0 text-xs">
                  {task.priority}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Objectives progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Objetivos en progreso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeObjectives.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin objetivos activos</p>
            )}
            {activeObjectives.slice(0, 5).map((obj: any) => {
              const tasks = obj.tasks ?? []
              const done = tasks.filter((t: any) => t.status === 'done').length
              const total = tasks.length
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <div key={obj.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{obj.name}</span>
                    <span className="text-muted-foreground text-xs shrink-0 ml-2">{done}/{total}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Escalated tickets */}
        {escalatedTickets.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Tickets escalados a dev
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {escalatedTickets.map(ticket => (
                  <div key={ticket.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">{ticket.client}</p>
                    </div>
                    <Badge variant={ticket.priority === 'urgente' ? 'destructive' : 'warning'} className="shrink-0 text-xs">
                      {ticket.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
