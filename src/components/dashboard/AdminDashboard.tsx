import { CheckSquare, Ticket, TrendingUp, Users, AlertTriangle, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import StatCard from './StatCard'
import { useAdminDashboard } from '@/hooks/useDashboard'
import { Loader2 } from 'lucide-react'

const roleColors: Record<string, string> = {
  admin: 'destructive',
  developer: 'primary',
  support: 'blue',
  closer: 'success',
  marketing: 'warning',
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  developer: 'Developer',
  support: 'Soporte',
  closer: 'Closer',
  marketing: 'Marketing',
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function AdminDashboard() {
  const { data, isLoading } = useAdminDashboard()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const { totalTasks = 0, activeTasks = 0, openTickets = 0, urgentTickets = 0, totalPipeline = 0, closedDeals = 0, teamSize = 0, profiles = [] } = data ?? {}

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Tareas totales"
          value={totalTasks}
          sub={`${activeTasks} en progreso`}
          icon={<CheckSquare className="h-5 w-5" />}
          color="primary"
        />
        <StatCard
          label="Tickets abiertos"
          value={openTickets}
          sub={urgentTickets > 0 ? `${urgentTickets} urgentes` : undefined}
          icon={<Ticket className="h-5 w-5" />}
          color={urgentTickets > 0 ? 'danger' : 'blue'}
        />
        <StatCard
          label="Pipeline"
          value={formatCurrency(totalPipeline)}
          sub={`${closedDeals} deals cerrados`}
          icon={<DollarSign className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          label="Equipo"
          value={teamSize}
          icon={<Users className="h-5 w-5" />}
          color="default"
        />
      </div>

      {/* Team members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Miembros del equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {profiles.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg border">
                <Avatar className="h-9 w-9 shrink-0">
                  {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                  <AvatarFallback className="text-xs">{getInitials(p.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <Badge variant={roleColors[p.role] as any} className="text-[10px] px-1.5 py-0 mt-0.5">
                    {roleLabels[p.role] ?? p.role}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alert for urgent tickets */}
      {urgentTickets > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm">
              Hay <span className="font-bold text-red-500">{urgentTickets}</span> ticket{urgentTickets > 1 ? 's' : ''} urgente{urgentTickets > 1 ? 's' : ''} sin resolver. Revisa el módulo de Soporte.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
