import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateUser } from '@/hooks/useUsers'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { UserRole } from '@/types/database'
import { useState } from 'react'

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: z.enum(['admin', 'developer', 'support', 'closer', 'marketing']),
})

type FormData = z.infer<typeof schema>

const roles: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'developer', label: 'Developer' },
  { value: 'support', label: 'Soporte' },
  { value: 'closer', label: 'Closer B2B' },
  { value: 'marketing', label: 'Marketing' },
]

export const ALL_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'desarrollo', label: 'Desarrollo' },
  { key: 'colaboracion', label: 'Colaboración' },
  { key: 'marketing', label: 'Marketing / CRM' },
  { key: 'soporte', label: 'Soporte' },
  { key: 'usuarios', label: 'Usuarios' },
] as const

interface Props {
  open: boolean
  onClose: () => void
}

export default function UserModal({ open, onClose }: Props) {
  const createUser = useCreateUser()
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: 'developer' },
  })

  const [selectedModules, setSelectedModules] = useState<string[]>(
    ALL_MODULES.map(m => m.key)
  )

  const selectedRole = watch('role')

  const toggleModule = (key: string) => {
    if (key === 'dashboard') return // dashboard siempre activo
    setSelectedModules(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    )
  }

  const onSubmit = async (data: FormData) => {
    try {
      await createUser.mutateAsync({
        ...data,
        allowed_modules: selectedModules,
      })
      toast.success('Usuario creado correctamente')
      reset()
      setSelectedModules(ALL_MODULES.map(m => m.key))
      onClose()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al crear usuario')
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre completo</Label>
            <Input {...register('name')} placeholder="Juan Pérez" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" {...register('email')} placeholder="juan@empresa.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Contraseña</Label>
            <Input type="password" {...register('password')} placeholder="Mínimo 6 caracteres" />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={selectedRole} onValueChange={v => setValue('role', v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Módulos permitidos</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODULES.map(mod => (
                <label
                  key={mod.key}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-accent transition-colors text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedModules.includes(mod.key)}
                    onChange={() => toggleModule(mod.key)}
                    disabled={mod.key === 'dashboard'}
                    className="rounded accent-primary"
                  />
                  {mod.label}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crear usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
