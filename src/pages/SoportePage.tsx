import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, ChevronLeft, ChevronRight, AlertCircle, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import { useTickets } from '@/hooks/useTickets'
import TicketModal from '@/components/soporte/TicketModal'
import TicketPanel from '@/components/soporte/TicketPanel'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { TicketStatus, TicketPriority } from '@/types/database'

const PAGE_SIZE = 8

const priorityConfig: Record<TicketPriority, { label: string; class: string }> = {
  urgente: { label: 'Urgente', class: 'text-red-500 border-red-500/30 bg-red-500/10' },
  alta:    { label: 'Alta',    class: 'text-orange-500 border-orange-500/30 bg-orange-500/10' },
  media:   { label: 'Media',   class: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10' },
  baja:    { label: 'Baja',    class: 'text-slate-400 border-slate-400/30 bg-slate-400/10' },
}

const statusConfig: Record<TicketStatus, { label: string; icon: React.ReactNode; class: string }> = {
  'Abierto':     { label: 'Abierto',     icon: <AlertCircle className="h-3 w-3" />, class: 'text-red-500 border-red-500/30 bg-red-500/10' },
  'En Revisión': { label: 'En Revisión', icon: <Clock className="h-3 w-3" />,       class: 'text-blue-500 border-blue-500/30 bg-blue-500/10' },
  'Resuelto':    { label: 'Resuelto',    icon: <CheckCircle2 className="h-3 w-3" />, class: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' },
}

export default function SoportePage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  const { data: tickets = [], isLoading } = useTickets({
    status: statusFilter,
    priority: priorityFilter,
    search,
  })

  const totalPages = Math.ceil(tickets.length / PAGE_SIZE)
  const paged = tickets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(0)
  }

  // Summary counts
  const open = tickets.filter(t => t.status === 'Abierto').length
  const inReview = tickets.filter(t => t.status === 'En Revisión').length
  const resolved = tickets.filter(t => t.status === 'Resuelto').length

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Soporte</h1>
          <p className="text-sm text-muted-foreground">Bandeja de tickets e incidencias</p>
        </div>
        <Button size="sm" onClick={() => setTicketModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo ticket
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Abiertos', count: open, icon: <AlertCircle className="h-4 w-4 text-red-500" />, color: 'text-red-500' },
          { label: 'En revisión', count: inReview, icon: <Clock className="h-4 w-4 text-blue-500" />, color: 'text-blue-500' },
          { label: 'Resueltos', count: resolved, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, color: 'text-emerald-500' },
        ].map(item => (
          <Card key={item.label} className="py-0">
            <CardContent className="p-4 flex items-center gap-3">
              {item.icon}
              <div>
                <p className={cn('text-xl font-bold', item.color)}>{item.count}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, cliente o asunto..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="Abierto">Abierto</SelectItem>
                <SelectItem value="En Revisión">En Revisión</SelectItem>
                <SelectItem value="Resuelto">Resuelto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={v => { setPriorityFilter(v); setPage(0) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No hay tickets que coincidan con los filtros
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Sistema</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead className="w-24">Prioridad</TableHead>
                  <TableHead className="w-28">Estado</TableHead>
                  <TableHead className="hidden lg:table-cell w-28">Agente</TableHead>
                  <TableHead className="hidden sm:table-cell w-28">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map(ticket => (
                  <TableRow
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{ticket.id}</span>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{ticket.client}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">{ticket.system}</Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate text-muted-foreground">
                      {ticket.subject}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', priorityConfig[ticket.priority as TicketPriority].class)}>
                        {priorityConfig[ticket.priority as TicketPriority].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs gap-1', statusConfig[ticket.status as TicketStatus].class)}>
                        {statusConfig[ticket.status as TicketStatus].icon}
                        {statusConfig[ticket.status as TicketStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {(ticket.assigned as { name: string } | null) ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px]">
                              {(ticket.assigned as { name: string }).name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{(ticket.assigned as { name: string }).name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {format(new Date(ticket.created_at), 'dd MMM', { locale: es })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{tickets.length} ticket(s)</span>
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
        </CardContent>
      </Card>

      {/* Modals */}
      <TicketModal open={ticketModalOpen} onClose={() => setTicketModalOpen(false)} />
      <TicketPanel ticketId={selectedTicketId} onClose={() => setSelectedTicketId(null)} />
    </div>
  )
}
