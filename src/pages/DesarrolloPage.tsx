import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, FolderOpen, Loader2 } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { useObjectives } from '@/hooks/useObjectives'
import { useTasks } from '@/hooks/useTasks'
import KanbanBoard from '@/components/desarrollo/KanbanBoard'
import GanttChart from '@/components/desarrollo/GanttChart'
import TaskModal from '@/components/desarrollo/TaskModal'
import ObjectiveModal from '@/components/desarrollo/ObjectiveModal'
import ProjectModal from '@/components/desarrollo/ProjectModal'

export default function DesarrolloPage() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [objectiveModalOpen, setObjectiveModalOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Parameters<typeof TaskModal>[0]['task']>(null)

  const { data: projects = [], isLoading: loadingProjects } = useProjects()
  const activeProject = selectedProject ?? projects[0]?.id ?? null

  const { data: objectives = [], isLoading: loadingObjectives } = useObjectives(activeProject)
  const { data: tasks = [], isLoading: loadingTasks } = useTasks(activeProject)

  const currentProject = projects.find(p => p.id === activeProject)

  const handleTaskClick = (task: Parameters<typeof TaskModal>[0]['task']) => {
    setEditingTask(task)
    setTaskModalOpen(true)
  }

  const handleNewTask = () => {
    setEditingTask(null)
    setTaskModalOpen(true)
  }

  const isLoading = loadingProjects || loadingObjectives || loadingTasks

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Desarrollo</h1>
          <p className="text-sm text-muted-foreground">Gestion de sprints y cronogramas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setProjectModalOpen(true)}>
            <FolderOpen className="h-4 w-4" />
            Nuevo proyecto
          </Button>
          {activeProject && (
            <>
              <Button variant="outline" size="sm" onClick={() => setObjectiveModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Nuevo objetivo
              </Button>
              <Button size="sm" onClick={handleNewTask}>
                <Plus className="h-4 w-4" />
                Nueva tarea
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Project selector */}
      {loadingProjects ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando proyectos...
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No hay proyectos aun.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setProjectModalOpen(true)}>
            <Plus className="h-4 w-4" /> Crear primer proyecto
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Select
            value={activeProject ?? ''}
            onValueChange={setSelectedProject}
          >
            <SelectTrigger className="w-56">
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
            <Badge variant="outline" className="text-xs">
              {currentProject.client}
            </Badge>
          )}
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {/* Tabs */}
      {activeProject && (
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="gantt">Gantt</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban">
            {loadingTasks ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <KanbanBoard
                tasks={tasks as Parameters<typeof KanbanBoard>[0]['tasks']}
                onTaskClick={handleTaskClick}
                onNewTask={handleNewTask}
              />
            )}
          </TabsContent>

          <TabsContent value="gantt">
            {loadingObjectives ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <GanttChart
                objectives={objectives as Parameters<typeof GanttChart>[0]['objectives']}
                onNewObjective={() => setObjectiveModalOpen(true)}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Modals */}
      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
      />

      {activeProject && (
        <>
          <ObjectiveModal
            open={objectiveModalOpen}
            onClose={() => setObjectiveModalOpen(false)}
            projectId={activeProject}
          />
          <TaskModal
            open={taskModalOpen}
            onClose={() => { setTaskModalOpen(false); setEditingTask(null) }}
            objectives={objectives}
            task={editingTask}
          />
        </>
      )}
    </div>
  )
}
