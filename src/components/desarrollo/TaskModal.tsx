import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { useCreateTask, useUpdateTask, useDeleteTask, useDevelopers } from '@/hooks/useTasks'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

const schema = z.object({
  title: z.string().min(1, 'Requerido'),
  priority: z.enum(['urgente', 'importante', 'alta', 'media', 'baja', 'delegar']),
  objective_id: z.string().min(1, 'Requerido'),
  assignee_id: z.string().optional(),
  due_date: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  objectives: Array<{ id: string; name: string; color: string }>
  task?: {
    id: string
    title: string
    priority: string
    objective_id: string
    assignee_id: string | null
    due_date: string | null
  } | null
}

const priorityColors: Record<string, string> = {
  urgente: 'text-red-500',
  importante: 'text-pink-500',
  alta: 'text-orange-500',
  media: 'text-yellow-500',
  baja: 'text-slate-400',
  delegar: 'text-sky-500',
}

export default function TaskModal({ open, onClose, objectives, task }: Props) {
  const isEdit = !!task
  const { data: developers = [] } = useDevelopers()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const { register, handleSubmit, setValue, watch, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'media', objective_id: objectives[0]?.id ?? '' },
  })

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        priority: task.priority as FormData['priority'],
        objective_id: task.objective_id,
        assignee_id: task.assignee_id ?? undefined,
        due_date: task.due_date ?? undefined,
      })
    } else {
      reset({ priority: 'media', objective_id: objectives[0]?.id ?? '' })
    }
  }, [task, open])

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && task) {
        await updateTask.mutateAsync({ id: task.id, ...data, assignee_id: data.assignee_id || null, due_date: data.due_date || null })
        toast.success('Tarea actualizada')
      } else {
        await createTask.mutateAsync({ ...data, assignee_id: data.assignee_id || null, due_date: data.due_date || null })
        toast.success('Tarea creada')
      }
      onClose()
    } catch {
      toast.error('Error al guardar la tarea')
    }
  }

  const handleDelete = async () => {
    if (!task) return
    try {
      await deleteTask.mutateAsync(task.id)
      toast.success('Tarea eliminada')
      onClose()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titulo</Label>
            <Input placeholder="Descripcion de la tarea..." {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Objetivo</Label>
            <Select value={watch('objective_id')} onValueChange={(v) => setValue('objective_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {objectives.map(obj => (
                  <SelectItem key={obj.id} value={obj.id}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: obj.color }} />
                      <span className="truncate">{obj.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.objective_id && <p className="text-xs text-destructive">{errors.objective_id.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Prioridad</Label>
            <Select value={watch('priority')} onValueChange={(v) => setValue('priority', v as FormData['priority'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['urgente', 'importante', 'alta', 'media', 'baja', 'delegar'] as const).map(p => (
                  <SelectItem key={p} value={p}>
                    <span className={priorityColors[p]}>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Fecha estimada de finalizacion</Label>
            <Controller
              name="due_date"
              control={control}
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Asignar a</Label>
            <Select value={watch('assignee_id') ?? 'none'} onValueChange={(v) => setValue('assignee_id', v === 'none' ? undefined : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {developers.map(dev => (
                  <SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between pt-2">
            {isEdit && (
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={createTask.isPending || updateTask.isPending}>
                {isEdit ? 'Guardar' : 'Crear tarea'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
