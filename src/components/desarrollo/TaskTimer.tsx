import { useEffect, useState } from 'react'
import { Play, Pause, Clock } from 'lucide-react'
import { useToggleTimer } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return totalSeconds > 0 ? '<1m' : '0m'
}

interface Props {
  taskId: string
  timeSpentSeconds: number
  timerStartedAt: string | null
  done?: boolean
  className?: string
}

export default function TaskTimer({ taskId, timeSpentSeconds, timerStartedAt, done, className }: Props) {
  const toggle = useToggleTimer()
  const running = !!timerStartedAt
  const [, setTick] = useState(0)

  // Refresca el contador en pantalla mientras corre
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setTick(n => n + 1), 10_000)
    return () => clearInterval(t)
  }, [running])

  const total = timeSpentSeconds + (running
    ? Math.max(0, Math.round((Date.now() - new Date(timerStartedAt!).getTime()) / 1000))
    : 0)

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await toggle.mutateAsync({ id: taskId, action: running ? 'stop' : 'start' })
    } catch {
      toast.error('Error con el temporizador')
    }
  }

  if (done && total === 0) return null

  return (
    <span className={cn('flex items-center gap-1 shrink-0', className)}>
      {!done && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggle.isPending}
          title={running ? 'Pausar temporizador' : 'Iniciar temporizador'}
          className={cn(
            'p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-50',
            running ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
      )}
      {(total > 0 || running) && (
        <span
          className={cn(
            'flex items-center gap-0.5 text-[11px] tabular-nums whitespace-nowrap',
            running ? 'text-emerald-500 font-medium' : 'text-muted-foreground'
          )}
        >
          <Clock className="h-3 w-3" />
          {formatDuration(total)}
        </span>
      )}
    </span>
  )
}
