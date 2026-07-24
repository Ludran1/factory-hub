import { useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  differenceInDays, parseISO, format, eachWeekOfInterval, eachDayOfInterval,
  startOfWeek, endOfWeek, addDays, isSameDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, ChevronRight, CheckCircle2, Circle, Loader2, Pencil } from 'lucide-react'
import { useUpdateTaskStatus } from '@/hooks/useTasks'
import TaskTimer from './TaskTimer'
import { toast } from 'sonner'

interface Assignee { id: string; name: string; avatar_url: string | null }
interface Task {
  id: string
  title?: string
  status: string
  priority?: string
  due_date?: string | null
  time_spent_seconds?: number
  timer_started_at?: string | null
  assignee?: Assignee | null
}
interface Objective {
  id: string
  name: string
  color: string
  start_date: string
  end_date: string
  status: string
  tasks: Task[]
}

interface Props {
  objectives: Objective[]
  onNewObjective: () => void
  onEditObjective?: (obj: Objective) => void
  onTaskClick?: (task: {
    id: string
    title: string
    priority: string
    objective_id: string
    assignee_id: string | null
    due_date: string | null
  }) => void
}

function getProgress(tasks: Task[]) {
  if (!tasks.length) return 0
  const done = tasks.filter(t => t.status === 'done').length
  return Math.round((done / tasks.length) * 100)
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const priorityColor: Record<string, string> = {
  urgente: 'bg-red-500/10 text-red-600 border-red-500/30',
  importante: 'bg-pink-500/10 text-pink-600 border-pink-500/30',
  alta: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  media: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  baja: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
  delegar: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
}

const statusLabel: Record<string, string> = {
  todo: 'Por hacer',
  in_progress: 'En progreso',
  code_review: 'En revisión',
  done: 'Hecho',
}

const statusColor: Record<string, string> = {
  todo: 'text-muted-foreground',
  in_progress: 'text-blue-600',
  code_review: 'text-amber-600',
  done: 'text-emerald-600',
}

const objStatusLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completado: 'Completado',
}

export default function GanttChart({ objectives, onEditObjective, onTaskClick }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const updateStatus = useUpdateTaskStatus()

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleTaskDone = async (task: Task) => {
    if (pendingTaskId) return
    setPendingTaskId(task.id)
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done'
      await updateStatus.mutateAsync({ id: task.id, status: newStatus as any })
      toast.success(newStatus === 'done' ? 'Tarea completada' : 'Tarea reabierta')
    } catch {
      toast.error('Error al actualizar tarea')
    } finally {
      setPendingTaskId(null)
    }
  }

  if (!objectives.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">No hay objetivos creados aun.</p>
        <p className="text-muted-foreground text-xs mt-1">Usa el boton "Nuevo objetivo" para agregar uno.</p>
      </div>
    )
  }

  // Rango total: objetivos + fechas estimadas de tareas + hoy, con padding
  // corto para no dejar semanas vacías al inicio.
  const today = new Date()
  const allDates = [
    ...objectives.flatMap(o => [parseISO(o.start_date), parseISO(o.end_date)]),
    ...objectives.flatMap(o => o.tasks.filter(t => t.due_date).map(t => parseISO(t.due_date!))),
    today,
  ]
  const rawMin = new Date(Math.min(...allDates.map(d => d.getTime())))
  const rawMax = new Date(Math.max(...allDates.map(d => d.getTime())))
  const minDate = addDays(rawMin, -2)
  const maxDate = addDays(rawMax, 7)

  // Semanas de lunes a domingo (consistente con locale es del resto de la app)
  const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 1 })
  const weekEnd = (d: Date) => endOfWeek(d, { weekStartsOn: 1 })

  // Granularidad adaptativa: rangos cortos muestran días individuales; los largos,
  // semanas (evita cientos de columnas ilegibles en proyectos de meses).
  const spanDays = differenceInDays(maxDate, minDate)
  const useDays = spanDays <= 45

  const origin = useDays ? minDate : weekStart(minDate)
  const finish = useDays ? maxDate : weekEnd(maxDate)

  const columns = useDays
    ? eachDayOfInterval({ start: origin, end: finish })
    : eachWeekOfInterval({ start: origin, end: finish }, { weekStartsOn: 1 })

  // Ancho continuo del timeline en días: debe coincidir con lo que dibuja la
  // grilla (N columnas de 1 día o de 1 semana), no con finish - origin, que
  // tiene 1 día menos y corría todos los marcadores hacia la derecha.
  const totalDays = columns.length * (useDays ? 1 : 7)

  // Centro del día `d` como % del timeline
  const dayPos = (d: Date) => ((differenceInDays(d, origin) + 0.5) / totalDays) * 100

  // Posición de la línea "hoy"
  const todayOffset = differenceInDays(today, origin)
  const todayPos = dayPos(today)
  const showToday = todayOffset >= 0 && todayOffset < totalDays

  const getBarStyle = (obj: Objective) => {
    const start = differenceInDays(parseISO(obj.start_date), origin)
    const days = differenceInDays(parseISO(obj.end_date), parseISO(obj.start_date)) + 1
    const left = (start / totalDays) * 100
    const width = (days / totalDays) * 100
    return { left: `${left}%`, width: `${Math.max(width, useDays ? 1.5 : 3)}%` }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border overflow-hidden">
        {/* Timeline header */}
        <div className="flex border-b bg-muted/40 sticky top-0 z-10">
          <div className="w-80 shrink-0 px-4 py-2 text-xs font-semibold text-muted-foreground border-r">
            Objetivo / Tareas
          </div>
          <div className="flex-1 relative min-w-0">
            <div className="flex">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 px-0.5 py-2 border-r last:border-r-0 text-center',
                    useDays ? 'text-[10px]' : 'text-xs',
                    useDays && isSameDay(col, today)
                      ? 'text-primary font-bold bg-primary/10'
                      : 'text-muted-foreground'
                  )}
                >
                  {useDays
                    ? (col.getDate() === 1 || i === 0
                        ? format(col, 'd MMM', { locale: es })
                        : format(col, 'd', { locale: es }))
                    : format(col, 'dd MMM', { locale: es })}
                </div>
              ))}
            </div>
            {showToday && (
              <div className="absolute inset-y-0 w-px bg-primary pointer-events-none" style={{ left: `${todayPos}%` }} />
            )}
          </div>
        </div>

        {/* Rows */}
        {objectives.map(obj => {
          const progress = getProgress(obj.tasks)
          const bar = getBarStyle(obj)
          const isActive = obj.tasks.some(t => t.status === 'in_progress')
          const isDone = obj.tasks.length > 0 && obj.tasks.every(t => t.status === 'done')
          const isExpanded = expanded.has(obj.id)
          const doneCount = obj.tasks.filter(t => t.status === 'done').length

          return (
            <div key={obj.id} className="border-b last:border-b-0">
              {/* Objective row */}
              <div className="flex hover:bg-muted/20 transition-colors">
                {/* Info column */}
                <div className="w-80 shrink-0 px-3 py-3 border-r relative group/obj">
                  {onEditObjective && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onEditObjective(obj) }}
                      title="Editar objetivo"
                      className="absolute top-2 right-2 z-10 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/obj:opacity-100 transition-opacity"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(obj.id)}
                    className="flex items-start gap-2 w-full text-left group"
                  >
                    <div className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: obj.color }} />
                        <span className="text-sm font-medium truncate">{obj.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{progress}%</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] py-0 h-4',
                            isDone && 'border-emerald-500/40 text-emerald-600',
                            isActive && !isDone && 'border-blue-500/40 text-blue-600'
                          )}
                        >
                          {isDone ? 'Completado' : isActive ? 'En progreso' : objStatusLabel[obj.status]}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {doneCount}/{obj.tasks.length} tareas
                        </span>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Timeline column */}
                <div className="flex-1 relative py-4 px-1 min-w-0">
                  <div className="absolute inset-0 flex pointer-events-none">
                    {columns.map((_, i) => (
                      <div key={i} className="flex-1 border-r border-border/40 last:border-r-0" />
                    ))}
                  </div>
                  {showToday && (
                    <div className="absolute inset-y-0 w-px bg-primary/50 pointer-events-none" style={{ left: `${todayPos}%` }} />
                  )}

                  <div className="relative h-7">
                    <div
                      className="absolute top-0 h-full rounded-md flex items-center px-2 overflow-hidden"
                      style={{ ...bar, background: obj.color + '33', border: `1.5px solid ${obj.color}` }}
                    >
                      <div
                        className="absolute left-0 top-0 h-full rounded-l-md opacity-60 transition-all"
                        style={{ width: `${progress}%`, background: obj.color }}
                      />
                      <span className="relative text-[11px] font-medium truncate" style={{ color: obj.color }}>
                        {format(parseISO(obj.start_date), 'd MMM', { locale: es })} — {format(parseISO(obj.end_date), 'd MMM', { locale: es })}
                      </span>
                    </div>
                    {/* Fecha fin visible junto al extremo derecho de la barra */}
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-[10px] font-medium whitespace-nowrap pl-1.5"
                      style={{ left: `calc(${bar.left} + ${bar.width})`, color: obj.color }}
                    >
                      {format(parseISO(obj.end_date), 'd MMM', { locale: es })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Task rows (expanded) */}
              {isExpanded && (
                <div className="bg-muted/10 border-t">
                  {obj.tasks.length === 0 ? (
                    <div className="px-12 py-3 text-xs text-muted-foreground italic">
                      Sin tareas. Crea una desde "Nueva tarea".
                    </div>
                  ) : (
                    obj.tasks.map(task => {
                      const done = task.status === 'done'
                      const isLoading = pendingTaskId === task.id
                      const duePos = task.due_date
                        ? Math.min(100, Math.max(0, dayPos(parseISO(task.due_date))))
                        : null
                      const overdue = !done && !!task.due_date && task.due_date < format(new Date(), 'yyyy-MM-dd')
                      const dueLabelLeft = duePos !== null && duePos > 88
                      return (
                        <div
                          key={task.id}
                          onClick={() => onTaskClick?.({
                            id: task.id,
                            title: task.title ?? '',
                            priority: task.priority ?? 'media',
                            objective_id: obj.id,
                            assignee_id: task.assignee?.id ?? null,
                            due_date: task.due_date ?? null,
                          })}
                          title="Click para editar o borrar la tarea"
                          className="flex border-b last:border-b-0 border-border/40 hover:bg-muted/30 transition-colors group cursor-pointer"
                        >
                          {/* Info column */}
                          <div className="w-80 shrink-0 flex items-center gap-3 pl-12 pr-3 py-2 border-r">
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleTaskDone(task) }}
                              disabled={isLoading}
                              className="shrink-0 transition-transform hover:scale-110 disabled:opacity-50"
                              title={done ? 'Marcar como pendiente' : 'Marcar como completada'}
                            >
                              {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              ) : done ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                'text-sm break-words',
                                done && 'line-through text-muted-foreground'
                              )}>
                                {task.title ?? '(sin título)'}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {task.priority && (
                                  <span
                                    className={cn(
                                      'text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0',
                                      priorityColor[task.priority] ?? priorityColor.media
                                    )}
                                  >
                                    {task.priority}
                                  </span>
                                )}
                                <span className={cn(
                                  'text-[10px] font-medium shrink-0',
                                  statusColor[task.status]
                                )}>
                                  {statusLabel[task.status] ?? task.status}
                                </span>
                                {task.assignee && (
                                  <span className="flex items-center gap-1 min-w-0">
                                    <Avatar className="h-4 w-4 shrink-0">
                                      {task.assignee.avatar_url && <AvatarImage src={task.assignee.avatar_url} />}
                                      <AvatarFallback className="text-[8px]">{getInitials(task.assignee.name)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-[10px] text-muted-foreground truncate">{task.assignee.name}</span>
                                  </span>
                                )}
                                <TaskTimer
                                  taskId={task.id}
                                  timeSpentSeconds={task.time_spent_seconds ?? 0}
                                  timerStartedAt={task.timer_started_at ?? null}
                                  done={done}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Timeline column: marcador de fecha estimada */}
                          <div className="flex-1 relative min-w-0">
                            <div className="absolute inset-0 flex pointer-events-none">
                              {columns.map((_, i) => (
                                <div key={i} className="flex-1 border-r border-border/40 last:border-r-0" />
                              ))}
                            </div>
                            {showToday && (
                              <div className="absolute inset-y-0 w-px bg-primary/50 pointer-events-none" style={{ left: `${todayPos}%` }} />
                            )}
                            {duePos !== null && task.due_date && (
                              <div
                                className={cn(
                                  'absolute inset-y-0 flex items-center gap-1.5',
                                  dueLabelLeft && 'flex-row-reverse'
                                )}
                                style={dueLabelLeft ? { right: `${100 - duePos}%` } : { left: `${duePos}%` }}
                                title="Fecha estimada de finalización"
                              >
                                <span className={cn(
                                  'h-2 w-2 rotate-45 shrink-0',
                                  done ? 'bg-emerald-500' : overdue ? 'bg-red-500' : 'bg-muted-foreground'
                                )} />
                                <span className={cn(
                                  'text-[10px] whitespace-nowrap',
                                  done ? 'text-emerald-600' : overdue ? 'text-red-500' : 'text-muted-foreground'
                                )}>
                                  {format(parseISO(task.due_date), 'd MMM', { locale: es })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Click para marcar tarea como hecha</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          <span>Click en un objetivo para expandir sus tareas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rotate-45 bg-muted-foreground" />
          <span>Fecha estimada de tarea (roja si venció)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-px bg-primary" />
          <span>Hoy</span>
        </div>
      </div>
    </div>
  )
}
