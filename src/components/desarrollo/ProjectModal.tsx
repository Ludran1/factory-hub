import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateProject } from '@/hooks/useProjects'
import { useAllProfiles } from '@/hooks/useUsers'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  client: z.string().min(1, 'Requerido'),
  color: z.string(),
})
type FormData = z.infer<typeof schema>

interface Props { open: boolean; onClose: () => void }

export default function ProjectModal({ open, onClose }: Props) {
  const createProject = useCreateProject()
  const { data: profiles = [] } = useAllProfiles()
  const [memberIds, setMemberIds] = useState<string[]>([])
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { color: COLORS[0] },
  })

  const allSelected = profiles.length > 0 && memberIds.length === profiles.length

  const toggleMember = (id: string) => {
    setMemberIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  const onSubmit = async (data: FormData) => {
    try {
      await createProject.mutateAsync({ ...data, member_ids: memberIds })
      toast.success('Proyecto creado')
      reset({ color: COLORS[0] })
      setMemberIds([])
      onClose()
    } catch {
      toast.error('Error al crear el proyecto')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre del proyecto</Label>
            <Input placeholder="Ej: FerrePOS v2" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Input placeholder="Ej: Ferreteria Central" {...register('client')} />
            {errors.client && <p className="text-xs text-destructive">{errors.client.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue('color', c)}
                  className="h-7 w-7 rounded-full transition-all"
                  style={{ background: c, outline: watch('color') === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Quién tiene acceso</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setMemberIds(allSelected ? [] : profiles.map(p => p.id))}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors',
                  allSelected
                    ? 'bg-primary/10 text-primary border-primary/40'
                    : 'bg-muted/50 text-muted-foreground border-transparent hover:opacity-80'
                )}
              >
                Todos
              </button>
              {profiles.map(p => {
                const selected = memberIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleMember(p.id)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border transition-colors',
                      selected
                        ? 'bg-primary/10 text-primary border-primary/40'
                        : 'bg-muted/50 text-muted-foreground border-transparent hover:opacity-80'
                    )}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tú quedas como owner automáticamente. Los miembros pueden gestionarse después desde "Miembros".
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createProject.isPending}>Crear</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
