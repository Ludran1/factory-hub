import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, DollarSign, TrendingUp, Target, Users, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLeads } from '@/hooks/useLeads'
import { useAuth } from '@/hooks/useAuth'
import LeadKanban from '@/components/marketing/LeadKanban'
import LeadPanel from '@/components/marketing/LeadPanel'
import LeadModal from '@/components/marketing/LeadModal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { LeadStage } from '@/types/database'

const PAGE_SIZE = 10

const stageConfig: Record<LeadStage, { label: string; class: string }> = {
  prospecto:   { label: 'Prospecto',   class: 'bg-slate-500/10 text-slate-500 border-slate-500/30' },
  demo:        { label: 'Demo',        class: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  negociacion: { label: 'Negociación', class: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  cerrado:     { label: 'Cerrado',     class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
}

const sourceLabels: Record<string, string> = {
  referido: 'Referido', cold_outreach: 'Cold Outreach',
  sitio_web: 'Sitio Web', evento: 'Evento',
  redes_sociales: 'Redes', otro: 'Otro',
}

export default function MarketingPage() {
  const { profile, role } = useAuth()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Parameters<typeof LeadModal>[0]['lead']>(null)

  // Closers only see their own leads
  const ownerId = role === 'closer' ? profile?.id : undefined

  const { data: leads = [], isLoading } = useLeads({
    stage: stageFilter,
    search,
    ownerId,
  })

  // Metrics
  const totalValue = leads.reduce((s, l) => s + l.value, 0)
  const closedValue = leads.filter(l => l.stage === 'cerrado').reduce((s, l) => s + l.value, 0)
  const conversionRate = leads.length > 0
    ? Math.round((leads.filter(l => l.stage === 'cerrado').length / leads.length) * 100)
    : 0

  // Table pagination
  const totalPages = Math.ceil(leads.length / PAGE_SIZE)
  const paged = leads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleLeadClick = (lead: { id: string }) => setSelectedLeadId(lead.id)

  const handleEdit = () => {
    const lead = leads.find(l => l.id === selectedLeadId)
    if (lead) {
      setEditingLead(lead as Parameters<typeof LeadModal>[0]['lead'])
      setSelectedLeadId(null)
      setModalOpen(true)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing / CRM</h1>
          <p className="text-sm text-muted-foreground">Pipeline de leads y oportunidades de venta</p>
        </div>
        {(role === 'admin' || role === 'closer') && (
          <Button size="sm" onClick={() => { setEditingLead(null); setModalOpen(true) }}>
            <Plus className="h-4 w-4" /> Nuevo lead
          </Button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Pipeline total', value: `$${(totalValue / 1000).toFixed(0)}k`, icon: <DollarSign className="h-4 w-4 text-primary" />, sub: `${leads.length} leads` },
          { label: 'Cerrado', value: `$${(closedValue / 1000).toFixed(0)}k`, icon: <Target className="h-4 w-4 text-emerald-500" />, sub: `${leads.filter(l => l.stage === 'cerrado').length} deals` },
          { label: 'Conversion', value: `${conversionRate}%`, icon: <TrendingUp className="h-4 w-4 text-blue-500" />, sub: 'tasa de cierre' },
          { label: 'En negociacion', value: leads.filter(l => l.stage === 'negociacion').length.toString(), icon: <Users className="h-4 w-4 text-amber-500" />, sub: `$${(leads.filter(l => l.stage === 'negociacion').reduce((s, l) => s + l.value, 0) / 1000).toFixed(0)}k` },
        ].map(m => (
          <Card key={m.label} className="py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {m.icon}
              </div>
              <div>
                <p className="text-lg font-bold">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-[10px] text-muted-foreground/60">{m.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pipeline">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="tabla">Tabla</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                className="pl-9 h-9 w-48"
              />
            </div>
            <Select value={stageFilter} onValueChange={v => { setStageFilter(v); setPage(0) }}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las etapas</SelectItem>
                {(Object.entries(stageConfig) as [LeadStage, { label: string }][]).map(([v, c]) => (
                  <SelectItem key={v} value={v}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pipeline Kanban */}
        <TabsContent value="pipeline">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <LeadKanban leads={leads as Parameters<typeof LeadKanban>[0]['leads']} onLeadClick={handleLeadClick} />
          )}
        </TabsContent>

        {/* Table */}
        <TabsContent value="tabla">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead className="hidden md:table-cell">Contacto</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Etapa</TableHead>
                        <TableHead className="hidden lg:table-cell">Fuente</TableHead>
                        <TableHead className="hidden lg:table-cell">Closer</TableHead>
                        <TableHead className="hidden sm:table-cell">Cierre est.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map(lead => (
                        <TableRow key={lead.id} onClick={() => handleLeadClick(lead)}>
                          <TableCell className="font-medium text-sm">{lead.company}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{lead.contact_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{lead.product}</Badge>
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-primary">
                            ${lead.value.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-xs', stageConfig[lead.stage as LeadStage].class)}>
                              {stageConfig[lead.stage as LeadStage].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {sourceLabels[lead.source] ?? lead.source}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {(lead.owner as { name: string } | null) ? (
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-[10px]">
                                    {(lead.owner as { name: string }).name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs">{(lead.owner as { name: string }).name}</span>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {lead.expected_close_date
                              ? format(new Date(lead.expected_close_date), 'dd MMM yyyy', { locale: es })
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground border-t">
                      <span>{leads.length} leads</span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span>{page + 1} / {totalPages}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lead panel + modal */}
      <LeadPanel
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onEdit={handleEdit}
      />
      <LeadModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingLead(null) }}
        lead={editingLead}
      />
    </div>
  )
}
