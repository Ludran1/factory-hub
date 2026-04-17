import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, PenLine, FileText, AlertCircle } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { usePresence, type PresenceUser } from '@/hooks/usePresence'
import WhiteBoard from '@/components/colaboracion/WhiteBoard'
import NotesEditor from '@/components/colaboracion/NotesEditor'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function PresenceBar({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null
  const MAX_SHOWN = 4
  const shown = users.slice(0, MAX_SHOWN)
  const extra = users.length - MAX_SHOWN
  const names = users.map(u => u.name).join(', ')

  return (
    <div className="flex items-center gap-2" title={`Viendo ahora: ${names}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <div className="flex -space-x-2">
        {shown.map(u => (
          <Avatar key={u.profile_id} className="h-7 w-7 border-2 border-background">
            {u.avatar_url && <AvatarImage src={u.avatar_url} />}
            <AvatarFallback className="text-[10px]">{getInitials(u.name)}</AvatarFallback>
          </Avatar>
        ))}
        {extra > 0 && (
          <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium text-muted-foreground">
            +{extra}
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {users.length === 1 ? '1 viendo' : `${users.length} viendo`}
      </span>
    </div>
  )
}

export default function ColaboracionPage() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const { data: projects = [], isLoading, isError, error, refetch } = useProjects()

  const activeProject = selectedProject ?? projects[0]?.id ?? null
  const currentProject = projects.find(p => p.id === activeProject)
  const presentUsers = usePresence(activeProject)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Colaboracion</h1>
          <p className="text-sm text-muted-foreground">Pizarra compartida y notas del equipo</p>
        </div>

        {/* Presence + Project selector */}
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : projects.length > 0 ? (
          <div className="flex items-center gap-3 flex-wrap">
            <PresenceBar users={presentUsers} />
            <Select value={activeProject ?? ''} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentProject && (
              <Badge variant="outline" className="text-xs">{currentProject.client}</Badge>
            )}
          </div>
        ) : null}
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-8 text-center space-y-3">
          <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
          <div>
            <p className="font-medium">No se pudieron cargar los proyectos</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as Error)?.message ?? 'Error desconocido'}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="text-sm underline text-muted-foreground hover:text-foreground"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* No projects */}
      {!isLoading && !isError && projects.length === 0 && (
        <div className="rounded-xl border-2 border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            No hay proyectos disponibles. Crea uno desde el modulo de Desarrollo.
          </p>
        </div>
      )}

      {/* Tabs */}
      {activeProject && (
        <Tabs defaultValue="pizarra">
          <TabsList>
            <TabsTrigger value="pizarra" className="gap-2">
              <PenLine className="h-4 w-4" /> Pizarra
            </TabsTrigger>
            <TabsTrigger value="notas" className="gap-2">
              <FileText className="h-4 w-4" /> Notas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pizarra">
            <WhiteBoard projectId={activeProject} />
          </TabsContent>

          <TabsContent value="notas">
            <NotesEditor projectId={activeProject} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
