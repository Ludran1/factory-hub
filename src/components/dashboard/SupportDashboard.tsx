import { Ticket, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatCard from './StatCard'
import { useSupportDashboard } from '@/hooks/useDashboard'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const priorityBadge: Record<string, any> = {
  baja: 'secondary',
  media: 'warning',
  alta: 'destructive',
  urgente: 'destructive',
}

export default function SupportDashboard() {
  const { profile } = useAuth()
  const { data, isLoading } = useSupportDashboard(profile?.id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const { totalOpen = 0, totalInReview = 0, totalResolved = 0, urgent = 0, myTickets = [], recentOpen = [] } = data ?? {}

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Tickets abiertos"
          value={totalOpen}
          icon={<Ticket className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          label="En revisión"
          value={totalInReview}
          icon={<Clock className="h-5 w-5" />}
          color="warning"
        />
        <StatCard
          label="Resueltos"
          value={totalResolved}
          icon={<CheckCircle className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          label="Urgentes"
          value={urgent}
          icon={<AlertTriangle className="h-5 w-5" />}
          color={urgent > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Mis tickets asignados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y">
            {myTickets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin tickets asignados</p>
            )}
            {myTickets.map(ticket => (
              <div key={ticket.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.client} · {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: es })}
                  </p>
                </div>
                <Badge variant={priorityBadge[ticket.priority]} className="shrink-0 text-xs">
                  {ticket.priority}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Tickets abiertos recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y">
            {recentOpen.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin tickets abiertos</p>
            )}
            {recentOpen.map(ticket => (
              <div key={ticket.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.client} · {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: es })}
                  </p>
                </div>
                <Badge variant={priorityBadge[ticket.priority]} className="shrink-0 text-xs">
                  {ticket.priority}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
