import { DollarSign, TrendingUp, Users, CalendarCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatCard from './StatCard'
import { useCloserDashboard } from '@/hooks/useDashboard'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const stageColors: Record<string, string> = {
  prospecto: 'secondary',
  demo: 'blue',
  negociacion: 'warning',
  cerrado: 'success',
}

const stageLabels: Record<string, string> = {
  prospecto: 'Prospecto',
  demo: 'Demo',
  negociacion: 'Negociación',
  cerrado: 'Cerrado',
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

export default function CloserDashboard() {
  const { profile } = useAuth()
  const { data, isLoading } = useCloserDashboard(profile?.id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const { totalPipeline = 0, closedValue = 0, inNegotiation = 0, prospects = 0, myLeads = [], pendingTasks = [] } = data ?? {}

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Pipeline total"
          value={formatCurrency(totalPipeline)}
          icon={<DollarSign className="h-5 w-5" />}
          color="primary"
        />
        <StatCard
          label="Valor cerrado"
          value={formatCurrency(closedValue)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          label="En negociación"
          value={inNegotiation}
          icon={<Users className="h-5 w-5" />}
          color="warning"
        />
        <StatCard
          label="Prospectos"
          value={prospects}
          icon={<Users className="h-5 w-5" />}
          color="blue"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Mis leads</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {myLeads.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin leads asignados</p>
            )}
            {myLeads.slice(0, 6).map(lead => (
              <div key={lead.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{lead.company}</p>
                  <p className="text-xs text-muted-foreground">{lead.contact_name} · {lead.product}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-muted-foreground">{formatCurrency(lead.value)}</span>
                  <Badge variant={stageColors[lead.stage] as any} className="text-xs">
                    {stageLabels[lead.stage]}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Tareas pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {pendingTasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin tareas pendientes</p>
            )}
            {pendingTasks.map((task: any) => (
              <div key={task.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.leads?.company}</p>
                </div>
                {task.due_date && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(task.due_date), 'd MMM', { locale: es })}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
