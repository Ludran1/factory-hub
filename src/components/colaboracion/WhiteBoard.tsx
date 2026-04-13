import { useEffect, useRef, useState, useCallback } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types'
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useBoards, useCreateBoard, useSaveBoard } from '@/hooks/useCollab'
import { useAuth } from '@/hooks/useAuth'
import { Plus, Save, Loader2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
}

export default function WhiteBoard({ projectId }: Props) {
  const { profile } = useAuth()
  const { data: boards = [], isLoading } = useBoards(projectId)
  const createBoard = useCreateBoard()
  const saveBoard = useSaveBoard()

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [showNewBoard, setShowNewBoard] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showBoardList, setShowBoardList] = useState(false)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentDataRef = useRef<{ elements: readonly ExcalidrawElement[]; appState: AppState; files: BinaryFiles } | null>(null)

  const selectedBoard = boards.find(b => b.id === selectedBoardId) ?? boards[0] ?? null

  useEffect(() => {
    if (boards.length > 0 && !selectedBoardId) {
      setSelectedBoardId(boards[0].id)
    }
  }, [boards])

  const handleChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    currentDataRef.current = { elements, appState, files }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      if (!selectedBoard || !profile) return
      setSaving(true)
      try {
        await saveBoard.mutateAsync({
          id: selectedBoard.id,
          project_id: projectId,
          updated_by: profile.id,
          excalidraw_data: {
            elements: elements as object[],
            appState: { viewBackgroundColor: appState.viewBackgroundColor },
          },
        })
      } catch {
        // silent auto-save failure
      } finally {
        setSaving(false)
      }
    }, 2000)
  }, [selectedBoard, profile, projectId])

  const handleManualSave = async () => {
    if (!selectedBoard || !profile || !currentDataRef.current) return
    setSaving(true)
    try {
      const { elements, appState } = currentDataRef.current
      await saveBoard.mutateAsync({
        id: selectedBoard.id,
        project_id: projectId,
        updated_by: profile.id,
        excalidraw_data: {
          elements: elements as object[],
          appState: { viewBackgroundColor: appState.viewBackgroundColor },
        },
      })
      toast.success('Pizarra guardada')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return
    try {
      const board = await createBoard.mutateAsync({ project_id: projectId, name: newBoardName.trim() })
      setSelectedBoardId(board.id)
      setNewBoardName('')
      setShowNewBoard(false)
      toast.success('Pizarra creada')
    } catch {
      toast.error('Error al crear pizarra')
    }
  }

  const initialData = selectedBoard?.excalidraw_data
    ? {
        elements: (selectedBoard.excalidraw_data as { elements: ExcalidrawElement[] }).elements ?? [],
        appState: { viewBackgroundColor: '#ffffff' },
      }
    : undefined

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Board selector */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowBoardList(v => !v)}
          >
            {selectedBoard?.name ?? 'Seleccionar pizarra'}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {showBoardList && boards.length > 0 && (
            <div className="absolute z-10 top-full mt-1 left-0 bg-card border rounded-lg shadow-lg py-1 min-w-40">
              {boards.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setSelectedBoardId(b.id); setShowBoardList(false) }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors',
                    b.id === selectedBoardId && 'text-primary font-medium'
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* New board */}
        {showNewBoard ? (
          <div className="flex items-center gap-2">
            <Input
              value={newBoardName}
              onChange={e => setNewBoardName(e.target.value)}
              placeholder="Nombre de la pizarra"
              className="h-9 w-44 text-sm"
              onKeyDown={e => { if (e.key === 'Enter') handleCreateBoard(); if (e.key === 'Escape') setShowNewBoard(false) }}
              autoFocus
            />
            <Button size="sm" onClick={handleCreateBoard} disabled={createBoard.isPending}>Crear</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNewBoard(false)}>Cancelar</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowNewBoard(true)}>
            <Plus className="h-4 w-4" /> Nueva pizarra
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {saving && (
            <Badge variant="outline" className="text-xs gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Guardando...
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={handleManualSave} disabled={saving || !selectedBoard}>
            <Save className="h-4 w-4" /> Guardar
          </Button>
        </div>
      </div>

      {/* Canvas */}
      {selectedBoard ? (
        <div className="h-[600px] rounded-xl border overflow-hidden">
          <Excalidraw
            key={selectedBoard.id}
            initialData={initialData}
            onChange={handleChange}
            theme="light"
          />
        </div>
      ) : (
        <div className="h-96 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <p className="text-sm">No hay pizarras en este proyecto</p>
          <Button size="sm" variant="outline" onClick={() => setShowNewBoard(true)}>
            <Plus className="h-4 w-4" /> Crear primera pizarra
          </Button>
        </div>
      )}
    </div>
  )
}
