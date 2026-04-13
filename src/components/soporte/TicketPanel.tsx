import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  ArrowUpRight, CheckCircle2, Clock, AlertCircle,
  MessageSquare, Activity, Loader2, Send
} from 'lucide-react'
import { useTicket, useUpdateTicket, useAddComment, useAddActivity, useSupportAgents } from '@/hooks/useTickets'
import { useCreateTask } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useObjectives } from '@/hooks/useObjectives'
import { useAuth } from '@/hooks/useAuth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { TicketStatus, TicketPriority } from '@/types/database'

const priorityConfig: Record<TicketPriority, { label: string; class: string }> = {
  urgente: { label: 'Urgente', class: 'text-red-500 border-red-500/30 bg-red-500/10' },
  alta:    { label: 'Alta',    class: 'text-orange-500 border-orange-500/30 bg-orange-500/10' },
  media:   { label: 'Media',   class: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10' },
  baja:    { label: 'Baja',    class: 'text-slate-400 border-slate-400/30 bg-slate-400/10' },
}

const statusConfig: Record<TicketStatus, { label: string; icon: React.ReactNode; class: string }> = {
  'Abierto':     { label: 'Abierto',     icon: <AlertCircle className="h-3.5 w-3.5" />, class: 'text-red-500 border-red-500/30 bg-red-500/10' },
  'En Revisión': { label: 'En Revisión', icon: <Clock className="h-3.5 w-3.5" />,        class: 'text-blue-500 border-blue-500/30 bg-blue-500/10' },
  'Resuelto':    { label: 'Resuelto',    icon: <CheckCircle2 className="h-3.5 w-3.5" />, class: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' },
}

interface Props {
  ticketId: string | null
  onClose: () => void
}

export default function TicketPanel({ ticketId, onClose }: Props) {
  const [comment, setComment] = useState('')
  const [escalating, setEscalating] = useState(false)

  const { profile } = useAuth()
  const { data: ticket, isLoading } = useTicket(ticketId)
  const { data: agents = [] } = useSupportAgents()
  const { data: projects = [] } = useProjects()
  const { data: objectives = [] } = useObjectives(projects[0]?.id ?? null)

  const updateTicket = useUpdateTicket()
  const addComment = useAddComment()
  const addActivity = useAddActivity()
  const createTask = useCreateTask()

  const handleStatusChange = async (status: TicketStatus) => {
    if (!ticket || !profile) return
    try {
      await updateTicket.mutateAsync({
        id: ticket.id,
        status,
        resolved_at: status === 'Resuelto' ? new Date().toISOString() : null,
      })
      await addActivity.mutateAsync({
        ticket_id: ticket.id,
        author_id: profile.id,
        action: `Estado cambiado a "${status}"`,
      })
      toast.success(`Estado actualizado a ${status}`)
    } catch {
      toast.error('Error al actualizar estado')
    }
  }

  const handleAssignChange = async (assigneeId: string) => {
    if (!ticket || !profile) return
    const agent = agents.find(a => a.id === assigneeId)
    try {
      await updateTicket.mutateAsync({ id: ticket.id, assigned_to: assigneeId === 'none' ? null : assigneeId })
      await addActivity.mutateAsync({
        ticket_id: ticket.id,
        author_id: profile.id,
        action: assigneeId === 'none' ? 'Agente removido' : `Asignado a ${agent?.name}`,
      })
    } catch {
      toast.error('Error al asignar agente')
    }
  }

  const handleSendComment = async () => {
    if (!ticket || !profile || !comment.trim()) return
    try {
      await addComment.mutateAsync({ ticket_id: ticket.id, author_id: profile.id, body: comment.trim() })
      setComment('')
    } catch {
      toast.error('Error al enviar comentario')
    }
  }

  const handleEscalate = async () => {
    if (!ticket || !profile) return
    if (!objectives.length) {
      toast.error('No hay objetivos en el proyecto. Crea uno primero en Desarrollo.')
      return
    }
    setEscalating(true)
    try {
      const task = await createTask.mutateAsync({
        objective_id: objectives[0].id,
        title: `[Soporte] ${ticket.subject} — ${ticket.client}`,
        priority: ticket.priority as 'urgente' | 'alta' | 'media' | 'baja',
      })
      await updateTicket.mutateAsync({
        id: ticket.id,
        status: 'En Revisión',
        escalated_task_id: task.id,
      })
      await addActivity.mutateAsync({
        ticket_id: ticket.id,
        author_id: profile.id,
        action: 'Escalado a Desarrollo',
        metadata: { task_id: task.id },
      })
      toast.success('Ticket escalado — tarea creada en Desarrollo')
    } catch {
      toast.error('Error al escalar el ticket')
    } finally {
      setEscalating(false)
    }
  }

  return (
    <Sheet open={!!ticketId} onOpenChange={onClose}>
      <SheetContent className="w-full max-w-xl flex flex-col">
        {isLoading || !ticket ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">{ticket.id}</span>
                <Badge className={cn('text-xs gap-1', statusConfig[ticket.status as TicketStatus].class)}>
                  {statusConfig[ticket.status as TicketStatus].icon}
                  {statusConfig[ticket.status as TicketStatus].label}
                </Badge>
                <Badge className={cn('text-xs', priorityConfig[ticket.priority as TicketPriority].class)}>
                  {priorityConfig[ticket.priority as TicketPriority].label}
                </Badge>
              </div>
              <SheetTitle className="text-base leading-snug">{ticket.subject}</SheetTitle>
              <p className="text-sm text-muted-foreground">{ticket.client} · {ticket.system}</p>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Description */}
              {ticket.description && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">DESCRIPCION</p>
                  <p className="text-sm leading-relaxed">{ticket.description}</p>
                </div>
              )}

              <Separator />

              {/* Controls */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">ESTADO</p>
                  <Select value={ticket.status} onValueChange={(v) => handleStatusChange(v as TicketStatus)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Abierto">Abierto</SelectItem>
                      <SelectItem value="En Revisión">En Revisión</SelectItem>
                      <SelectItem value="Resuelto">Resuelto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">AGENTE</p>
                  <Select
                    value={(ticket.assigned as { id: string } | null)?.id ?? 'none'}
                    onValueChange={handleAssignChange}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {agents.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Escalate button */}
              {ticket.status !== 'Resuelto' && !ticket.escalated_task_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-orange-500/30 text-orange-500 hover:bg-orange-500/10"
                  onClick={handleEscalate}
                  disabled={escalating}
                >
                  {escalating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                  Escalar a Desarrollo
                </Button>
              )}
              {ticket.escalated_task_id && (
                <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 rounded-lg px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Escalado a Desarrollo
                </div>
              )}

              <Separator />

              {/* Comments */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> COMENTARIOS
                </p>
                <div className="space-y-3">
                  {(ticket.ticket_comments as Array<{ id: string; body: string; created_at: string; author: { name: string } | null }> ?? []).map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[10px]">{c.author?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-medium">{c.author?.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.created_at), 'dd MMM HH:mm', { locale: es })}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5 text-muted-foreground">{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comment input */}
                <div className="mt-3 flex gap-2">
                  <Textarea
                    placeholder="Agregar comentario interno..."
                    rows={2}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    className="flex-1 text-sm"
                    onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSendComment() }}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="shrink-0 self-end"
                    onClick={handleSendComment}
                    disabled={!comment.trim() || addComment.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Activity timeline */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> ACTIVIDAD
                </p>
                <div className="space-y-2">
                  {(ticket.ticket_activity as Array<{ id: string; action: string; created_at: string; author: { name: string } | null }> ?? [])
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map(act => (
                      <div key={act.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                        <span>
                          <span className="font-medium text-foreground">{act.author?.name}</span>
                          {' — '}{act.action}
                          <span className="ml-2 text-[10px]">
                            {format(new Date(act.created_at), 'dd MMM HH:mm', { locale: es })}
                          </span>
                        </span>
                      </div>
                    ))}
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                    <span>
                      Ticket creado —{' '}
                      {format(new Date(ticket.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
