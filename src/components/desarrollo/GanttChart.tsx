import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { differenceInDays, parseISO, format, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'

interface Task { id: string; status: string }
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
}

function getProgress(tasks: Task[]) {
  if (!tasks.length) return 0
  const done = tasks.filter(t => t.status === 'done').length
  return Math.round((done / tasks.length) * 100)
}

export default function GanttChart({ objectives }: Props) {
  if (!objectives.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">No hay objetivos creados aun.</p>
        <p className="text-muted-foreground text-xs mt-1">Usa el boton "Nuevo objetivo" para agregar uno.</p>
      </div>
    )
  }

  // Calcular rango de fechas total
  const allDates = objectives.flatMap(o => [parseISO(o.start_date), parseISO(o.end_date)])
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))

  const weeks = eachWeekOfInterval({ start: startOfWeek(minDate), end: endOfWeek(maxDate) })
  const totalDays = differenceInDays(endOfWeek(maxDate), startOfWeek(minDate)) || 1

  const getBarStyle = (obj: Objective) => {
    const start = differenceInDays(parseISO(obj.start_date), startOfWeek(minDate))
    const duration = differenceInDays(parseISO(obj.end_date), parseISO(obj.start_date))
    const left = (start / totalDays) * 100
    const width = (duration / totalDays) * 100
    return { left: `${left}%`, width: `${Math.max(width, 3)}%` }
  }

  const statusLabel: Record<string, string> = {
    pendiente: 'Pendiente',
    en_progreso: 'En progreso',
    completado: 'Completado',
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border overflow-hidden">
        {/* Timeline header */}
        <div className="flex border-b bg-muted/40">
          <div className="w-64 shrink-0 px-4 py-2 text-xs font-semibold text-muted-foreground border-r">
            Objetivo
          </div>
          <div className="flex-1 relative">
            <div className="flex">
              {weeks.map((week, i) => (
                <div
                  key={i}
                  className="flex-1 px-1 py-2 text-xs text-muted-foreground border-r last:border-r-0 text-center"
                >
                  {format(week, 'dd MMM', { locale: es })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rows */}
        {objectives.map(obj => {
          const progress = getProgress(obj.tasks)
          const bar = getBarStyle(obj)
          const isActive = obj.tasks.some(t => t.status === 'in_progress')
          const isDone = obj.tasks.length > 0 && obj.tasks.every(t => t.status === 'done')

          return (
            <div key={obj.id} className="flex border-b last:border-b-0 hover:bg-muted/20 transition-colors">
              {/* Info column */}
              <div className="w-64 shrink-0 px-4 py-3 border-r">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: obj.color }} />
                  <span className="text-sm font-medium truncate">{obj.name}</span>
                </div>
                <div className="flex items-center gap-2 pl-4">
                  <Progress value={progress} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
                </div>
                <div className="mt-1 pl-4">
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] py-0 h-4',
                      isDone && 'border-emerald-500/40 text-emerald-600',
                      isActive && !isDone && 'border-blue-500/40 text-blue-600'
                    )}
                  >
                    {isDone ? 'Completado' : isActive ? 'En progreso' : statusLabel[obj.status]}
                  </Badge>
                </div>
              </div>

              {/* Timeline column */}
              <div className="flex-1 relative py-4 px-1">
                {/* Week lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {weeks.map((_, i) => (
                    <div key={i} className="flex-1 border-r border-border/40 last:border-r-0" />
                  ))}
                </div>

                {/* Bar */}
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
                      {obj.name}
                    </span>
                  </div>
                </div>

                {/* Task summary */}
                <div className="mt-1 px-1">
                  <span className="text-[10px] text-muted-foreground">
                    {obj.tasks.filter(t => t.status === 'done').length}/{obj.tasks.length} tareas
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
