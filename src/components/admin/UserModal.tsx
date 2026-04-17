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
import {
  useCreateUser,
  useUpdateUserName,
  useUpdateUserRole,
  useUpdateUserModules,
  useResetPassword,
} from '@/hooks/useUsers'
import { toast } from 'sonner'
import { Loader2, KeyRound } from 'lucide-react'
import type { Database, UserRole } from '@/types/database'
import { useEffect, useState } from 'react'

type Profile = Database['public']['Tables']['profiles']['Row']

const createSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: z.enum(['admin', 'developer', 'support', 'closer', 'marketing']),
})

const editSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().optional(),
  password: z.string().optional(),
  role: z.enum(['admin', 'developer', 'support', 'closer', 'marketing']),
})

type FormData = z.infer<typeof createSchema>

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
  mode?: 'create' | 'edit'
  user?: Profile | null
}

export default function UserModal({ open, onClose, mode = 'create', user = null }: Props) {
  const isEdit = mode === 'edit' && !!user

  const createUser = useCreateUser()
  const updateName = useUpdateUserName()
  const updateRole = useUpdateUserRole()
  const updateModules = useUpdateUserModules()
  const resetPassword = useResetPassword()

  const handleResetPassword = async () => {
    if (!user?.email) {
      toast.error('Este usuario no tiene email registrado, no se puede enviar recuperación')
      return
    }
    try {
      await resetPassword.mutateAsync({ email: user.email })
      toast.success(`Email de recuperación enviado a ${user.email}`)
    } catch {
      toast.error('Error al enviar email de recuperación')
    }
  }

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(isEdit ? editSchema : createSchema) as any,
    defaultValues: { name: '', email: '', password: '', role: 'developer' },
  })

  const [selectedModules, setSelectedModules] = useState<string[]>(
    ALL_MODULES.map(m => m.key)
  )

  const selectedRole = watch('role')

  // Prefill cuando se abre en modo edición
  useEffect(() => {
    if (open && isEdit && user) {
      reset({ name: user.name, email: user.email ?? '', password: '', role: user.role })
      setSelectedModules(user.allowed_modules ?? ALL_MODULES.map(m => m.key))
    } else if (open && !isEdit) {
      reset({ name: '', email: '', password: '', role: 'developer' })
      setSelectedModules(ALL_MODULES.map(m => m.key))
    }
  }, [open, isEdit, user, reset])

  const toggleModule = (key: string) => {
    if (key === 'dashboard') return
    setSelectedModules(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    )
  }

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && user) {
        const tasks: Promise<unknown>[] = []
        if (data.name !== user.name) {
          tasks.push(updateName.mutateAsync({ profileId: user.id, name: data.name }))
        }
        if (data.role !== user.role) {
          tasks.push(updateRole.mutateAsync({ profileId: user.id, role: data.role }))
        }
        const currentModules = user.allowed_modules ?? []
        const modulesChanged =
          selectedModules.length !== currentModules.length ||
          selectedModules.some(m => !currentModules.includes(m))
        if (modulesChanged) {
          tasks.push(updateModules.mutateAsync({ profileId: user.id, allowed_modules: selectedModules }))
        }

        if (tasks.length === 0) {
          toast.info('No hay cambios para guardar')
          onClose()
          return
        }

        await Promise.all(tasks)
        toast.success('Usuario actualizado')
        onClose()
      } else {
        await createUser.mutateAsync({
          ...data,
          allowed_modules: selectedModules,
        })
        toast.success('Usuario creado', {
          description: 'Puede que le llegue un email de confirmación antes de poder loguearse, según tu configuración de Supabase Auth.',
          duration: 6000,
        })
        reset()
        setSelectedModules(ALL_MODULES.map(m => m.key))
        onClose()
      }
    } catch (err: any) {
      toast.error(err.message ?? (isEdit ? 'Error al actualizar usuario' : 'Error al crear usuario'))
    }
  }

  const isPending =
    createUser.isPending || updateName.isPending || updateRole.isPending || updateModules.isPending

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre completo</Label>
            <Input {...register('name')} placeholder="Juan Pérez" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {!isEdit && (
            <>
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
            </>
          )}

          {isEdit && (
            <>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  value={user?.email ?? ''}
                  placeholder="Sin email registrado"
                  disabled
                  className="bg-muted/50"
                />
                <p className="text-[11px] text-muted-foreground">
                  Para cambiar el email es necesario un flujo aparte de Supabase Auth.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Contraseña</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleResetPassword}
                  disabled={resetPassword.isPending || !user?.email}
                >
                  {resetPassword.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <KeyRound className="h-4 w-4" />}
                  Enviar email de recuperación
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Las contraseñas están hasheadas y no se pueden ver. Esto envía un link para que el usuario la cambie.
                </p>
              </div>
            </>
          )}

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
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
