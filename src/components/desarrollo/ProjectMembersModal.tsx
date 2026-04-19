import { useState, useMemo } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
  useUpdateProjectMemberRole,
} from '@/hooks/useProjectMembers'
import { useAllProfiles } from '@/hooks/useUsers'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Crown, UserCircle2, Search } from 'lucide-react'
import type { ProjectMemberRole } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string | null
  projectName: string
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const roleLabel: Record<ProjectMemberRole, string> = {
  owner: 'Owner',
  contributor: 'Contributor',
}

export default function ProjectMembersModal({ open, onClose, projectId, projectName }: Props) {
  const { data: members = [], isLoading: loadingMembers } = useProjectMembers(projectId)
  const { data: profiles = [], isLoading: loadingProfiles } = useAllProfiles()
  const addMember = useAddProjectMember()
  const removeMember = useRemoveProjectMember()
  const updateRole = useUpdateProjectMemberRole()

  const [search, setSearch] = useState('')

  // IDs que ya son miembros para filtrarlos de la lista de "agregar"
  const memberIds = useMemo(() => new Set(members.map(m => m.profile_id)), [members])

  const availableProfiles = useMemo(() => {
    const q = search.trim().toLowerCase()
    return profiles.filter(p => {
      if (memberIds.has(p.id)) return false
      if (!q) return true
      return p.name.toLowerCase().includes(q)
    })
  }, [profiles, memberIds, search])

  const handleAdd = async (profile_id: string) => {
    if (!projectId) return
    try {
      await addMember.mutateAsync({ project_id: projectId, profile_id })
      toast.success('Miembro agregado')
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al agregar miembro')
    }
  }

  const handleRemove = async (id: string) => {
    if (!projectId) return
    try {
      await removeMember.mutateAsync({ id, project_id: projectId })
      toast.success('Miembro removido')
    } catch {
      toast.error('Error al remover miembro')
    }
  }

  const handleRoleChange = async (id: string, role: ProjectMemberRole) => {
    if (!projectId) return
    try {
      await updateRole.mutateAsync({ id, role, project_id: projectId })
      toast.success('Rol actualizado')
    } catch {
      toast.error('Error al actualizar rol')
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Miembros de {projectName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Miembros actuales */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Equipo actual ({members.length})
            </p>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                Aún no hay miembros asignados explícitamente
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      {m.profile.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                      <AvatarFallback className="text-xs">{getInitials(m.profile.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.profile.name}</p>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 mt-0.5">
                        {m.profile.role}
                      </Badge>
                    </div>

                    <Select
                      value={m.role}
                      onValueChange={v => handleRoleChange(m.id, v as ProjectMemberRole)}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">
                          <div className="flex items-center gap-2">
                            <Crown className="h-3 w-3" /> Owner
                          </div>
                        </SelectItem>
                        <SelectItem value="contributor">
                          <div className="flex items-center gap-2">
                            <UserCircle2 className="h-3 w-3" /> Contributor
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(m.id)}
                      disabled={removeMember.isPending}
                      title="Remover del proyecto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agregar miembros */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Agregar miembro
            </p>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar usuario..."
                className="pl-9"
              />
            </div>

            {loadingProfiles ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : availableProfiles.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                {search ? 'Sin resultados' : 'Todos los usuarios ya son miembros'}
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto divide-y rounded-lg border">
                {availableProfiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAdd(p.id)}
                    disabled={addMember.isPending}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors text-left disabled:opacity-50"
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                      <AvatarFallback className="text-[10px]">{getInitials(p.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.role}</p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Re-export para que TypeScript no se queje de no-used
export { roleLabel }
