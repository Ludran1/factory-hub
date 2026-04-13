import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateTicket, useSupportAgents } from '@/hooks/useTickets'
import { toast } from 'sonner'

const schema = z.object({
  client: z.string().min(1, 'Requerido'),
  system: z.string().min(1, 'Requerido'),
  subject: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
  priority: z.enum(['urgente', 'alta', 'media', 'baja']),
  assigned_to: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const priorityColors: Record<string, string> = {
  urgente: 'text-red-500',
  alta: 'text-orange-500',
  media: 'text-yellow-500',
  baja: 'text-slate-400',
}

interface Props { open: boolean; onClose: () => void }

export default function TicketModal({ open, onClose }: Props) {
  const createTicket = useCreateTicket()
  const { data: agents = [] } = useSupportAgents()

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'media' },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await createTicket.mutateAsync({
        ...data,
        assigned_to: data.assigned_to || null,
      })
      toast.success('Ticket creado correctamente')
      reset({ priority: 'media' })
      onClose()
    } catch {
      toast.error('Error al crear el ticket')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo ticket</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Input placeholder="Ej: FerrePOS" {...register('client')} />
              {errors.client && <p className="text-xs text-destructive">{errors.client.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Sistema</Label>
              <Input placeholder="Ej: ERP, POS, Web..." {...register('system')} />
              {errors.system && <p className="text-xs text-destructive">{errors.system.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Asunto</Label>
            <Input placeholder="Descripcion breve del problema..." {...register('subject')} />
            {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Descripcion <span className="text-muted-foreground">(opcional)</span></Label>
            <Textarea placeholder="Detalle completo del problema..." rows={3} {...register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={watch('priority')} onValueChange={(v) => setValue('priority', v as FormData['priority'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['urgente', 'alta', 'media', 'baja'] as const).map(p => (
                    <SelectItem key={p} value={p}>
                      <span className={priorityColors[p]}>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Asignar a</Label>
              <Select value={watch('assigned_to') ?? 'none'} onValueChange={(v) => setValue('assigned_to', v === 'none' ? undefined : v)}>
                <SelectTrigger>
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

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createTicket.isPending}>Crear ticket</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
