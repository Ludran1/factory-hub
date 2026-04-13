import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, PenLine, FileText } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import WhiteBoard from '@/components/colaboracion/WhiteBoard'
import NotesEditor from '@/components/colaboracion/NotesEditor'

export default function ColaboracionPage() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const { data: projects = [], isLoading } = useProjects()

  const activeProject = selectedProject ?? projects[0]?.id ?? null
  const currentProject = projects.find(p => p.id === activeProject)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Colaboracion</h1>
          <p className="text-sm text-muted-foreground">Pizarra compartida y notas del equipo</p>
        </div>

        {/* Project selector */}
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : projects.length > 0 ? (
          <div className="flex items-center gap-2">
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

      {/* No projects */}
      {!isLoading && projects.length === 0 && (
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
