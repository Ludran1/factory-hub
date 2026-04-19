import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users2, FolderKanban, Crown, Loader2 } from 'lucide-react'
import { useProjectTeams } from '@/hooks/useProjectTeams'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getFirstName(name: string) {
  return name.trim().split(' ')[0]
}

const MAX_VISIBLE_MEMBERS = 5

export default function ProjectTeams() {
  const { data: projects = [], isLoading } = useProjectTeams()

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            Equipos por proyecto
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            Equipos por proyecto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay proyectos todavía
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FolderKanban className="h-4 w-4" />
          Equipos por proyecto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 gap-3">
          {projects.map(p => {
            const visible = p.members.slice(0, MAX_VISIBLE_MEMBERS)
            const extra = p.members.length - MAX_VISIBLE_MEMBERS

            return (
              <div
                key={p.id}
                className="rounded-lg border p-3 space-y-2.5 hover:shadow-sm transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 mt-1.5"
                    style={{ background: p.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.client}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {p.status}
                  </Badge>
                </div>

                {/* Progreso */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {p.doneTasks}/{p.totalTasks} tareas
                    </span>
                    <span className="font-medium tabular-nums">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-1.5" />
                </div>

                {/* Equipo */}
                <div className="flex items-start justify-between gap-2 pt-1">
                  {p.members.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground italic">
                      Sin miembros asignados
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                      {visible.map(m => (
                        <div
                          key={m.id}
                          className={`inline-flex items-center gap-1.5 rounded-full border pl-0.5 pr-2 py-0.5 ${
                            m.role === 'owner'
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : m.explicit
                              ? 'bg-muted/60 border-transparent'
                              : 'bg-muted/20 border-dashed border-muted-foreground/30'
                          }`}
                          title={[
                            m.name,
                            m.role === 'owner'
                              ? '(owner)'
                              : m.role === 'contributor'
                              ? '(contributor)'
                              : '(derivado de tareas)',
                            `${m.taskCount} tarea${m.taskCount !== 1 ? 's' : ''}`,
                          ].join(' · ')}
                        >
                          <div className="relative">
                            <Avatar className="h-5 w-5">
                              {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                              <AvatarFallback className="text-[9px]">
                                {getInitials(m.name)}
                              </AvatarFallback>
                            </Avatar>
                            {m.role === 'owner' && (
                              <Crown className="h-2.5 w-2.5 text-amber-500 absolute -top-1 -right-1 drop-shadow" />
                            )}
                          </div>
                          <span className="text-[11px] font-medium truncate max-w-[80px]">
                            {getFirstName(m.name)}
                          </span>
                        </div>
                      ))}
                      {extra > 0 && (
                        <div className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          +{extra}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 pt-0.5">
                    <Users2 className="h-3 w-3" />
                    {p.members.length}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-3 pt-3 border-t flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Crown className="h-3 w-3 text-amber-500" /> Owner
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-6 rounded-full bg-muted/60" /> Asignado explícito
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-6 rounded-full border border-dashed border-muted-foreground/40" /> Derivado de tareas
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
