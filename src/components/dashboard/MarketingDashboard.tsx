import { TrendingUp, DollarSign, BarChart3, Percent } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import StatCard from './StatCard'
import { useMarketingDashboard } from '@/hooks/useDashboard'
import { Loader2 } from 'lucide-react'

const stageLabels: Record<string, string> = {
  prospecto: 'Prospecto',
  demo: 'Demo',
  negociacion: 'Negociación',
  cerrado: 'Cerrado',
}

const stageColors: Record<string, string> = {
  prospecto: 'bg-slate-400',
  demo: 'bg-blue-400',
  negociacion: 'bg-amber-400',
  cerrado: 'bg-emerald-400',
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

export default function MarketingDashboard() {
  const { data, isLoading } = useMarketingDashboard()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const { totalLeads = 0, totalPipeline = 0, closedValue = 0, conversionRate = 0, bySource = {}, byStage = { prospecto: 0, demo: 0, negociacion: 0, cerrado: 0 }, recentLeads = [] } = data ?? {}

  const totalByStage = Object.values(byStage).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total leads"
          value={totalLeads}
          icon={<BarChart3 className="h-5 w-5" />}
          color="primary"
        />
        <StatCard
          label="Pipeline total"
          value={formatCurrency(totalPipeline)}
          icon={<DollarSign className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          label="Valor cerrado"
          value={formatCurrency(closedValue)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          label="Conversión"
          value={`${conversionRate}%`}
          icon={<Percent className="h-5 w-5" />}
          color={conversionRate >= 20 ? 'success' : conversionRate >= 10 ? 'warning' : 'danger'}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Funnel */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Embudo de ventas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(byStage).map(([stage, count]) => {
              const pct = totalByStage > 0 ? Math.round((count / totalByStage) * 100) : 0
              return (
                <div key={stage} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{stageLabels[stage]}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stageColors[stage]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* By source */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Por fuente</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {Object.keys(bySource).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
            )}
            {Object.entries(bySource)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => (
                <div key={source} className="flex items-center justify-between py-1.5">
                  <span className="text-sm capitalize">{source}</span>
                  <Badge variant="secondary" className="text-xs">{count}</Badge>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Recent leads */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Leads recientes</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {recentLeads.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin leads</p>
            )}
            {recentLeads.map((lead: any) => (
              <div key={lead.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{lead.company}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{formatCurrency(lead.value)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{lead.owner?.name ?? '—'} · {lead.source}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
