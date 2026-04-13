import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateLead, useUpdateLead, useClosers } from '@/hooks/useLeads'
import { toast } from 'sonner'
import type { LeadStage, LeadSource } from '@/types/database'

const schema = z.object({
  company: z.string().min(1, 'Requerido'),
  contact_name: z.string().min(1, 'Requerido'),
  contact_email: z.string().email('Email invalido').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  product: z.string().min(1, 'Requerido'),
  value: z.coerce.number().min(0),
  stage: z.enum(['prospecto', 'demo', 'negociacion', 'cerrado']),
  source: z.enum(['referido', 'cold_outreach', 'sitio_web', 'evento', 'redes_sociales', 'otro']),
  owner_id: z.string().optional(),
  expected_close_date: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const sourceLabels: Record<LeadSource, string> = {
  referido: 'Referido', cold_outreach: 'Cold Outreach',
  sitio_web: 'Sitio Web', evento: 'Evento',
  redes_sociales: 'Redes Sociales', otro: 'Otro',
}

const stageLabels: Record<LeadStage, string> = {
  prospecto: 'Prospecto', demo: 'Demo',
  negociacion: 'Negociación', cerrado: 'Cerrado',
}

interface ExistingLead {
  id: string; company: string; contact_name: string; contact_email: string | null
  contact_phone: string | null; product: string; value: number; stage: string
  source: string; owner_id: string | null; expected_close_date: string | null; notes: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  lead?: ExistingLead | null
}

export default function LeadModal({ open, onClose, lead }: Props) {
  const isEdit = !!lead
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const { data: closers = [] } = useClosers()

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { stage: 'prospecto', source: 'otro', value: 0 },
  })

  useEffect(() => {
    if (lead) {
      reset({
        company: lead.company, contact_name: lead.contact_name,
        contact_email: lead.contact_email ?? '', contact_phone: lead.contact_phone ?? '',
        product: lead.product, value: lead.value,
        stage: lead.stage as LeadStage, source: lead.source as LeadSource,
        owner_id: lead.owner_id ?? undefined,
        expected_close_date: lead.expected_close_date ?? '',
        notes: lead.notes ?? '',
      })
    } else {
      reset({ stage: 'prospecto', source: 'otro', value: 0 })
    }
  }, [lead, open])

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        owner_id: data.owner_id || null,
        expected_close_date: data.expected_close_date || null,
        notes: data.notes || null,
      }
      if (isEdit && lead) {
        await updateLead.mutateAsync({ id: lead.id, ...payload })
        toast.success('Lead actualizado')
      } else {
        await createLead.mutateAsync(payload)
        toast.success('Lead creado')
      }
      onClose()
    } catch {
      toast.error('Error al guardar el lead')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar lead' : 'Nuevo lead'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input placeholder="Nombre de la empresa" {...register('company')} />
              {errors.company && <p className="text-xs text-destructive">{errors.company.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Contacto</Label>
              <Input placeholder="Nombre del contacto" {...register('contact_name')} />
              {errors.contact_name && <p className="text-xs text-destructive">{errors.contact_name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="email@empresa.com" {...register('contact_email')} />
              {errors.contact_email && <p className="text-xs text-destructive">{errors.contact_email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Telefono</Label>
              <Input placeholder="+1 234 567 8900" {...register('contact_phone')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Producto</Label>
              <Input placeholder="Ej: FerrePOS, ERP..." {...register('product')} />
              {errors.product && <p className="text-xs text-destructive">{errors.product.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Valor ($)</Label>
              <Input type="number" min={0} {...register('value')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={watch('stage')} onValueChange={v => setValue('stage', v as LeadStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(stageLabels) as [LeadStage, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fuente</Label>
              <Select value={watch('source')} onValueChange={v => setValue('source', v as LeadSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(sourceLabels) as [LeadSource, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Closer asignado</Label>
              <Select value={watch('owner_id') ?? 'none'} onValueChange={v => setValue('owner_id', v === 'none' ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cierre estimado</Label>
              <Input type="date" {...register('expected_close_date')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea placeholder="Contexto, intereses, comentarios..." rows={2} {...register('notes')} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createLead.isPending || updateLead.isPending}>
              {isEdit ? 'Guardar cambios' : 'Crear lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
