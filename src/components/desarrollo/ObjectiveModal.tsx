import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { useCreateObjective, useUpdateObjective, useDeleteObjective } from '@/hooks/useObjectives'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6']

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  start_date: z.string().min(1, 'Requerido'),
  end_date: z.string().min(1, 'Requerido'),
  color: z.string(),
})

type FormData = z.infer<typeof schema>

export interface EditableObjective {
  id: string
  name: string
  color: string
  start_date: string
  end_date: string
}

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  objective?: EditableObjective | null
}

export default function ObjectiveModal({ open, onClose, projectId, objective = null }: Props) {
  const createObjective = useCreateObjective()
  const updateObjective = useUpdateObjective()
  const deleteObjective = useDeleteObjective()
  const isEdit = !!objective

  const { register, handleSubmit, setValue, watch, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { color: COLORS[0] },
  })

  useEffect(() => {
    if (!open) return
    if (objective) {
      reset({
        name: objective.name,
        start_date: objective.start_date,
        end_date: objective.end_date,
        color: objective.color,
      })
    } else {
      reset({ name: '', start_date: '', end_date: '', color: COLORS[0] })
    }
  }, [open, objective])

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit) {
        await updateObjective.mutateAsync({ id: objective!.id, ...data })
        toast.success('Objetivo actualizado')
      } else {
        await createObjective.mutateAsync({ ...data, project_id: projectId })
        toast.success('Objetivo creado')
      }
      onClose()
    } catch {
      toast.error(isEdit ? 'Error al actualizar el objetivo' : 'Error al crear el objetivo')
    }
  }

  const handleDelete = async () => {
    if (!objective) return
    if (!confirm(`¿Eliminar el objetivo "${objective.name}" y todas sus tareas?`)) return
    try {
      await deleteObjective.mutateAsync({ id: objective.id, project_id: projectId })
      toast.success('Objetivo eliminado')
      onClose()
    } catch {
      toast.error('Error al eliminar el objetivo')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar objetivo' : 'Nuevo objetivo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre del objetivo</Label>
            <Input placeholder="Ej: Modulo de ventas, Login de usuarios..." {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha inicio</Label>
              <Controller
                control={control}
                name="start_date"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} />
                )}
              />
              {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Fecha fin</Label>
              <Controller
                control={control}
                name="end_date"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} />
                )}
              />
              {errors.end_date && <p className="text-xs text-destructive">{errors.end_date.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue('color', color)}
                  className="h-7 w-7 rounded-full ring-offset-2 transition-all"
                  style={{
                    background: color,
                    ringColor: color,
                    outline: watch('color') === color ? `2px solid ${color}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteObjective.isPending}
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={createObjective.isPending || updateObjective.isPending}>
                {isEdit ? 'Guardar cambios' : 'Crear objetivo'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
