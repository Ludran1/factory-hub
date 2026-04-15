import { useState } from 'react'
import { useUsers, useUpdateUserRole, useUpdateUserModules } from '@/hooks/useUsers'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import UserModal, { ALL_MODULES } from '@/components/admin/UserModal'
import type { UserRole } from '@/types/database'

const roles: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'developer', label: 'Developer' },
  { value: 'support', label: 'Soporte' },
  { value: 'closer', label: 'Closer' },
  { value: 'marketing', label: 'Marketing' },
]

const roleBadge: Record<UserRole, string> = {
  admin: 'destructive',
  developer: 'default',
  support: 'warning',
  closer: 'success',
  marketing: 'secondary',
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function UsersPage() {
  const { data: users = [], isLoading } = useUsers()
  const updateRole = useUpdateUserRole()
  const updateModules = useUpdateUserModules()
  const [showCreate, setShowCreate] = useState(false)

  const handleRoleChange = async (profileId: string, role: UserRole) => {
    try {
      await updateRole.mutateAsync({ profileId, role })
      toast.success('Rol actualizado')
    } catch {
      toast.error('Error al actualizar rol')
    }
  }

  const handleModuleToggle = async (profileId: string, currentModules: string[], moduleKey: string) => {
    if (moduleKey === 'dashboard') return
    const updated = currentModules.includes(moduleKey)
      ? currentModules.filter(m => m !== moduleKey)
      : [...currentModules, moduleKey]
    try {
      await updateModules.mutateAsync({ profileId, allowed_modules: updated })
      toast.success('Módulos actualizados')
    } catch {
      toast.error('Error al actualizar módulos')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los miembros del equipo, roles y módulos
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Nuevo usuario
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No hay usuarios registrados</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Crear primer usuario
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Módulos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const modules = user.allowed_modules ?? ALL_MODULES.map(m => m.key)
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                        <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{user.name}</p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={v => handleRoleChange(user.id, v as UserRole)}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_MODULES.map(mod => {
                          const active = modules.includes(mod.key)
                          return (
                            <button
                              key={mod.key}
                              onClick={() => handleModuleToggle(user.id, modules, mod.key)}
                              disabled={mod.key === 'dashboard'}
                              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                                active
                                  ? 'bg-primary/10 text-primary border-primary/30'
                                  : 'bg-muted/50 text-muted-foreground/50 border-transparent'
                              } ${mod.key === 'dashboard' ? 'opacity-60 cursor-default' : 'cursor-pointer hover:opacity-80'}`}
                            >
                              {mod.label}
                            </button>
                          )
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <UserModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
