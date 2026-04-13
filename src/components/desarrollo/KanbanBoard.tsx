import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { GripVertical, Plus, Circle } from 'lucide-react'
import { useUpdateTaskStatus } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/types/database'
import { toast } from 'sonner'

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'Por hacer' },
  { key: 'in_progress', label: 'En progreso' },
  { key: 'code_review', label: 'Code review' },
  { key: 'done', label: 'Hecho' },
]

const priorityConfig: Record<string, { color: string; label: string }> = {
  urgente: { color: 'text-red-500', label: 'Urgente' },
  alta:    { color: 'text-orange-500', label: 'Alta' },
  media:   { color: 'text-yellow-500', label: 'Media' },
  baja:    { color: 'text-slate-400', label: 'Baja' },
}

interface Task {
  id: string
  title: string
  priority: string
  status: TaskStatus
  objective_id: string
  assignee_id: string | null
  objectives: { name: string; color: string } | null
  assignee: { id: string; name: string; avatar_url: string | null } | null
}

interface KanbanCardProps {
  task: Task
  onClick: (task: Task) => void
  overlay?: boolean
}

function KanbanCard({ task, onClick, overlay }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-40')}
    >
      <Card
        className={cn(
          'cursor-pointer hover:ring-1 hover:ring-primary/40 transition-all',
          overlay && 'shadow-xl rotate-1 ring-1 ring-primary/40'
        )}
        onClick={() => onClick(task)}
      >
        <CardContent className="p-3 space-y-2.5">
          <div className="flex items-start gap-2">
            <button
              {...attributes}
              {...listeners}
              className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
              onClick={e => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
          </div>

          <div className="flex items-center justify-between pl-6">
            <div className="flex items-center gap-1.5">
              {task.objectives && (
                <Badge variant="outline" className="text-xs py-0 gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: task.objectives.color }} />
                  {task.objectives.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Circle className={cn('h-2 w-2 fill-current', priorityConfig[task.priority]?.color)} />
              {task.assignee && (
                <Avatar className="h-5 w-5">
                  <AvatarImage src={task.assignee.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {task.assignee.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface Props {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onNewTask: () => void
}

export default function KanbanBoard({ tasks, onTaskClick, onNewTask }: Props) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const updateStatus = useUpdateTaskStatus()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const tasksByColumn = (status: TaskStatus) => tasks.filter(t => t.status === status)

  const handleDragStart = (e: DragStartEvent) => {
    const task = tasks.find(t => t.id === e.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = e
    if (!over) return

    const newStatus = over.id as TaskStatus
    const task = tasks.find(t => t.id === active.id)
    if (!task || task.status === newStatus) return

    try {
      await updateStatus.mutateAsync({ id: task.id, status: newStatus })
    } catch {
      toast.error('Error al mover la tarea')
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const colTasks = tasksByColumn(col.key)
          return (
            <div
              key={col.key}
              id={col.key}
              className="flex flex-col rounded-xl border bg-muted/30 p-3 min-h-[400px]"
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                    {colTasks.length}
                  </span>
                </div>
                {col.key === 'todo' && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onNewTask}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Drop zone */}
              <SortableContext
                items={colTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
                id={col.key}
              >
                <div className="flex flex-col gap-2 flex-1">
                  {colTasks.map(task => (
                    <KanbanCard key={task.id} task={task} onClick={onTaskClick} />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border rounded-lg min-h-[80px]">
                      <p className="text-xs text-muted-foreground">Sin tareas</p>
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>

      <DragOverlay>
        {activeTask && (
          <KanbanCard task={activeTask} onClick={() => {}} overlay />
        )}
      </DragOverlay>
    </DndContext>
  )
}
