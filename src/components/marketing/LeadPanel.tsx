import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Phone, Mail, DollarSign, Calendar, User, Pencil,
  Phone as PhoneIcon, Users, AtSign, FileText, Plus,
  CheckSquare, Square, Loader2, Send
} from 'lucide-react'
import { useLead, useUpdateLead, useAddLeadActivity, useAddLeadTask, useToggleLeadTask } from '@/hooks/useLeads'
import { useAuth } from '@/hooks/useAuth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { LeadStage, ActivityType } from '@/types/database'

const stageConfig: Record<LeadStage, { label: string; class: string }> = {
  prospecto:   { label: 'Prospecto',   class: 'bg-slate-500/10 text-slate-500 border-slate-500/30' },
  demo:        { label: 'Demo',        class: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  negociacion: { label: 'Negociación', class: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  cerrado:     { label: 'Cerrado',     class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
}

const activityIcons: Record<ActivityType, React.ReactNode> = {
  llamada: <PhoneIcon className="h-3.5 w-3.5" />,
  reunion: <Users className="h-3.5 w-3.5" />,
  email:   <AtSign className="h-3.5 w-3.5" />,
  nota:    <FileText className="h-3.5 w-3.5" />,
}

const activityLabels: Record<ActivityType, string> = {
  llamada: 'Llamada', reunion: 'Reunión', email: 'Email', nota: 'Nota',
}

interface Props {
  leadId: string | null
  onClose: () => void
  onEdit: () => void
}

export default function LeadPanel({ leadId, onClose, onEdit }: Props) {
  const [activityType, setActivityType] = useState<ActivityType>('nota')
  const [activityBody, setActivityBody] = useState('')
  const [newTask, setNewTask] = useState('')
  const [taskDue, setTaskDue] = useState('')

  const { profile } = useAuth()
  const { data: lead, isLoading } = useLead(leadId)
  const updateLead = useUpdateLead()
  const addActivity = useAddLeadActivity()
  const addTask = useAddLeadTask()
  const toggleTask = useToggleLeadTask()

  const handleStageChange = async (stage: LeadStage) => {
    if (!lead) return
    try {
      await updateLead.mutateAsync({ id: lead.id, stage })
      toast.success(`Etapa cambiada a ${stageConfig[stage].label}`)
    } catch {
      toast.error('Error al actualizar etapa')
    }
  }

  const handleAddActivity = async () => {
    if (!lead || !profile || !activityBody.trim()) return
    try {
      await addActivity.mutateAsync({ lead_id: lead.id, author_id: profile.id, type: activityType, body: activityBody.trim() })
      setActivityBody('')
      toast.success('Actividad registrada')
    } catch {
      toast.error('Error al registrar actividad')
    }
  }

  const handleAddTask = async () => {
    if (!lead || !newTask.trim()) return
    try {
      await addTask.mutateAsync({ lead_id: lead.id, title: newTask.trim(), due_date: taskDue || null })
      setNewTask('')
      setTaskDue('')
    } catch {
      toast.error('Error al agregar tarea')
    }
  }

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    if (!lead) return
    await toggleTask.mutateAsync({ id: taskId, completed: !completed, lead_id: lead.id })
  }

  return (
    <Sheet open={!!leadId} onOpenChange={onClose}>
      <SheetContent className="w-full max-w-xl flex flex-col">
        {isLoading || !lead ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between pr-6">
                <Badge className={cn('text-xs', stageConfig[lead.stage as LeadStage].class)}>
                  {stageConfig[lead.stage as LeadStage].label}
                </Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              <SheetTitle className="text-base">{lead.company}</SheetTitle>
              <p className="text-sm text-muted-foreground">{lead.contact_name}</p>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Info */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {lead.contact_email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{lead.contact_email}</span>
                  </div>
                )}
                {lead.contact_phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{lead.contact_phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-semibold text-foreground">${lead.value.toLocaleString()}</span>
                </div>
                {lead.expected_close_date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{format(new Date(lead.expected_close_date), 'dd MMM yyyy', { locale: es })}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span>{(lead.owner as { name: string } | null)?.name ?? 'Sin closer'}</span>
                </div>
              </div>

              {lead.notes && (
                <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed">
                  {lead.notes}
                </p>
              )}

              {/* Stage selector */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">ETAPA</p>
                <Select value={lead.stage} onValueChange={v => handleStageChange(v as LeadStage)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(stageConfig) as [LeadStage, { label: string }][]).map(([v, c]) => (
                      <SelectItem key={v} value={v}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Tasks */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">TAREAS DE SEGUIMIENTO</p>
                <div className="space-y-2 mb-3">
                  {(lead.lead_tasks as Array<{ id: string; title: string; completed: boolean; due_date: string | null }> ?? []).map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 cursor-pointer group"
                      onClick={() => handleToggleTask(task.id, task.completed)}
                    >
                      {task.completed
                        ? <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                        : <Square className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                      }
                      <span className={cn('text-sm flex-1', task.completed && 'line-through text-muted-foreground')}>
                        {task.title}
                      </span>
                      {task.due_date && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(task.due_date), 'dd MMM', { locale: es })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva tarea..."
                    value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                    className="h-8 text-sm flex-1"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddTask() }}
                  />
                  <Input
                    type="date"
                    value={taskDue}
                    onChange={e => setTaskDue(e.target.value)}
                    className="h-8 text-sm w-32"
                  />
                  <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={handleAddTask}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Activities */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">ACTIVIDADES</p>

                {/* Log new activity */}
                <div className="space-y-2 mb-4">
                  <div className="flex gap-2">
                    <Select value={activityType} onValueChange={v => setActivityType(v as ActivityType)}>
                      <SelectTrigger className="h-8 w-32 text-xs shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(activityLabels) as [ActivityType, string][]).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            <span className="flex items-center gap-1.5">{activityIcons[v]} {l}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder={`Registrar ${activityLabels[activityType].toLowerCase()}...`}
                      rows={2}
                      value={activityBody}
                      onChange={e => setActivityBody(e.target.value)}
                      className="text-sm flex-1"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="shrink-0 self-end"
                      onClick={handleAddActivity}
                      disabled={!activityBody.trim() || addActivity.isPending}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Activity list */}
                <div className="space-y-3">
                  {(lead.lead_activities as Array<{ id: string; type: string; body: string; created_at: string; author: { name: string } | null }> ?? [])
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map(act => (
                      <div key={act.id} className="flex gap-2.5">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary">
                          {activityIcons[act.type as ActivityType]}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium">{act.author?.name}</span>
                            <Badge variant="outline" className="text-[10px] py-0 h-4">{activityLabels[act.type as ActivityType]}</Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {format(new Date(act.created_at), 'dd MMM HH:mm', { locale: es })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{act.body}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
