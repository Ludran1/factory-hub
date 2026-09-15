import { useEffect, useRef, useState, useCallback } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useBoards, useBoardData, useCreateBoard, useSaveBoard, useDeleteBoard } from '@/hooks/useCollab'
import { useAuth } from '@/hooks/useAuth'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { Plus, Save, Loader2, Trash2, Presentation, ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
}

// Compresión de imágenes antes de persistir: el JSON de la pizarra viaja completo
// en cada autosave, así que una foto de varios MB haría cada guardado lentísimo.
const COMPRESS_THRESHOLD = 200_000 // ~150KB de binario en base64
const MAX_DIMENSION = 1600

async function compressDataURL(dataURL: string): Promise<string | null> {
  const img = new Image()
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('No se pudo leer la imagen'))
  })
  img.src = dataURL
  await loaded

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  // webp mantiene transparencia; si el browser no soporta encode webp,
  // toDataURL devuelve png (igual redimensionado)
  const out = canvas.toDataURL('image/webp', 0.8)
  return out.length < dataURL.length ? out : null
}

/**
 * Huella barata de lo que se persiste, para no guardar cuando no cambió nada.
 *
 * Excalidraw llama a onChange también al hacer scroll, zoom o seleccionar. Sin
 * este filtro cada uno de esos gestos terminaba en un guardado: 2.337 en dos horas
 * sobre una sola pizarra el 12-sep, casi todo el tráfico del proyecto.
 *
 * Excalidraw incrementa `version` en cada elemento que cambia (su getSceneVersion
 * es esta misma suma) y un borrado también la sube. Los archivos entran con
 * mimeType y largo porque la compresión reemplaza la imagen con el mismo id: sin
 * eso la versión liviana nunca se guardaría.
 */
interface ElementoEscena { version?: number }
interface ArchivoEscena { mimeType?: string; dataURL?: string }

function huellaEscena(
  elements: readonly ElementoEscena[],
  appState: { viewBackgroundColor?: string } | null | undefined,
  files: Record<string, ArchivoEscena> | null | undefined,
): string {
  let versiones = 0
  for (const el of elements) versiones += el?.version ?? 0
  const archivos = Object.entries(files ?? {})
    .map(([id, f]) => `${id}:${f?.mimeType ?? ''}:${f?.dataURL?.length ?? 0}`)
    .sort()
    .join('|')
  return `${elements.length}:${versiones}:${appState?.viewBackgroundColor ?? ''}:${archivos}`
}

export default function WhiteBoard({ projectId }: Props) {
  const { profile } = useAuth()
  const { data: boards = [], isLoading } = useBoards(projectId)
  const createBoard = useCreateBoard()
  const saveBoard = useSaveBoard()
  const deleteBoard = useDeleteBoard()

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [showNewBoard, setShowNewBoard] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [saving, setSaving] = useState(false)

  // En el celular no entran lista y lienzo lado a lado (el lienzo quedaba en
  // 130 px): se ve uno a la vez, como en WhatsApp. Tocar una pizarra la abre y
  // la flecha de la barra vuelve a la lista. En escritorio se ven los dos.
  const esEscritorio = useIsDesktop()
  const [abiertaEnCelular, setAbiertaEnCelular] = useState(false)
  const mostrarLienzo = esEscritorio || abiertaEnCelular

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentDataRef = useRef<{ elements: readonly any[]; appState: any; files: any } | null>(null)
  const excalidrawApiRef = useRef<any>(null)
  const processedFilesRef = useRef<Set<string>>(new Set())
  /** Huella de lo último guardado (o cargado) de cada pizarra abierta. */
  const lastSavedRef = useRef<{ boardId: string; fp: string } | null>(null)

  const selectedBoard = boards.find(b => b.id === selectedBoardId) ?? boards[0] ?? null
  // Solo el dibujo de la pizarra abierta: la lista ya no lo trae. En el celular,
  // mientras se mira la lista, no se descarga ninguna (hay pizarras de 700 kB).
  const { data: boardData, isLoading: loadingBoard } = useBoardData(
    mostrarLienzo ? selectedBoard?.id ?? null : null,
  )
  const savedData = boardData?.excalidraw_data as { elements?: any[]; files?: Record<string, any> } | null | undefined

  useEffect(() => {
    if (boards.length > 0 && !selectedBoardId) {
      setSelectedBoardId(boards[0].id)
    }
  }, [boards])

  // Comprime imágenes recién agregadas y las reemplaza in-place (mismo fileId).
  // addFiles dispara otro onChange, así que el autosave siguiente ya lleva la versión liviana.
  const maybeCompressFiles = useCallback((files: any) => {
    if (!files) return
    for (const [id, file] of Object.entries<any>(files)) {
      if (processedFilesRef.current.has(id)) continue
      processedFilesRef.current.add(id)
      const compressible = ['image/png', 'image/jpeg', 'image/webp'].includes(file?.mimeType)
      if (!compressible || (file?.dataURL?.length ?? 0) < COMPRESS_THRESHOLD) continue
      compressDataURL(file.dataURL)
        .then(compressed => {
          if (!compressed) return
          excalidrawApiRef.current?.addFiles([{ ...file, mimeType: 'image/webp', dataURL: compressed }])
        })
        .catch(() => { /* si falla, queda la original */ })
    }
  }, [])

  const handleChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    currentDataRef.current = { elements, appState, files }
    maybeCompressFiles(files)
    if (!selectedBoard || !profile) return

    // La referencia de "sin cambios" es lo que se cargó de la base, con el mismo
    // fondo que usa initialData. Si Excalidraw normaliza algo al montar, a lo sumo
    // se hace un guardado; nunca se pierde un cambio real.
    let base = lastSavedRef.current
    if (!base || base.boardId !== selectedBoard.id) {
      base = {
        boardId: selectedBoard.id,
        fp: huellaEscena(savedData?.elements ?? [], { viewBackgroundColor: '#ffffff' }, savedData?.files ?? {}),
      }
      lastSavedRef.current = base
    }

    const fp = huellaEscena(elements, appState, files)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    // Scroll, zoom, selección, o un cambio deshecho antes del guardado: nada que
    // persistir.
    if (fp === base.fp) return

    const boardId = selectedBoard.id
    const profileId = profile.id
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await saveBoard.mutateAsync({
          id: boardId,
          project_id: projectId,
          updated_by: profileId,
          excalidraw_data: {
            elements: elements as object[],
            appState: { viewBackgroundColor: appState.viewBackgroundColor },
            files: files ?? {},
          },
        })
        lastSavedRef.current = { boardId, fp }
      } catch (err: any) {
        toast.error(`No se pudo guardar: ${err?.message ?? 'error desconocido'}`)
      } finally {
        setSaving(false)
      }
    }, 2000)
  }, [selectedBoard, profile, projectId, maybeCompressFiles, savedData])

  const handleManualSave = async () => {
    if (!selectedBoard || !profile || !currentDataRef.current) return
    setSaving(true)
    try {
      const { elements, appState, files } = currentDataRef.current
      await saveBoard.mutateAsync({
        id: selectedBoard.id,
        project_id: projectId,
        updated_by: profile.id,
        excalidraw_data: {
          elements: elements as object[],
          appState: { viewBackgroundColor: appState.viewBackgroundColor },
          files: files ?? {},
        },
      })
      lastSavedRef.current = { boardId: selectedBoard.id, fp: huellaEscena(elements, appState, files) }
      toast.success('Pizarra guardada')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBoard = async () => {
    if (!selectedBoard) return
    if (!confirm(`¿Eliminar la pizarra "${selectedBoard.name}"?`)) return
    try {
      await deleteBoard.mutateAsync({ id: selectedBoard.id, project_id: projectId })
      setSelectedBoardId(null)
      setAbiertaEnCelular(false)
      toast.success('Pizarra eliminada')
    } catch {
      toast.error('Error al eliminar pizarra')
    }
  }

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return
    try {
      const board = await createBoard.mutateAsync({ project_id: projectId, name: newBoardName.trim() })
      setSelectedBoardId(board.id)
      setAbiertaEnCelular(true)
      setNewBoardName('')
      setShowNewBoard(false)
      toast.success('Pizarra creada')
    } catch {
      toast.error('Error al crear pizarra')
    }
  }

  const initialData = savedData
    ? {
        elements: savedData.elements ?? [],
        appState: { viewBackgroundColor: '#ffffff' },
        files: savedData.files ?? undefined,
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
    // En el celular el alto es la pantalla menos barra superior (dos filas),
    // pestañas y márgenes, para que el lienzo llegue hasta abajo.
    <div className="flex gap-4 h-[calc(100dvh-12rem)] min-h-[420px] md:h-[calc(100vh-15rem)] md:min-h-[640px]">
      {/* Sidebar — board list */}
      <div
        className={cn(
          'w-full md:w-56 shrink-0 flex-col gap-1 border rounded-xl p-2 overflow-y-auto',
          abiertaEnCelular ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="flex items-center justify-between px-1 py-1 mb-1">
          <span className="text-xs font-semibold text-muted-foreground">PIZARRAS</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewBoard(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {showNewBoard && (
          <div className="px-1 pb-2 space-y-1">
            <Input
              value={newBoardName}
              onChange={e => setNewBoardName(e.target.value)}
              placeholder="Nombre de la pizarra"
              className="h-7 text-xs"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateBoard()
                if (e.key === 'Escape') setShowNewBoard(false)
              }}
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-xs flex-1" onClick={handleCreateBoard} disabled={createBoard.isPending}>
                Crear
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowNewBoard(false)}>
                ✕
              </Button>
            </div>
          </div>
        )}

        {boards.length === 0 && !showNewBoard && (
          <div className="flex flex-col items-center justify-center flex-1 text-center px-2">
            <Presentation className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Sin pizarras</p>
          </div>
        )}

        {boards.map(board => (
          <button
            key={board.id}
            onClick={() => { setSelectedBoardId(board.id); setAbiertaEnCelular(true) }}
            className={cn(
              'w-full text-left px-2 py-2.5 md:py-2 rounded-lg transition-colors text-sm',
              board.id === selectedBoard?.id
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted text-foreground'
            )}
          >
            <p className="font-medium truncate text-sm md:text-xs">{board.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {format(new Date(board.updated_at), 'dd MMM', { locale: es })}
              {(board as { updater?: { name: string } | null }).updater?.name
                ? ` · ${(board as { updater?: { name: string } | null }).updater!.name}`
                : ''}
            </p>
          </button>
        ))}
      </div>

      {/* Canvas area. En el celular no se monta mientras se ve la lista: así
          Excalidraw no arranca en un contenedor oculto de 0 px. */}
      {mostrarLienzo && (selectedBoard ? (
        <div className="flex-1 min-w-0 flex flex-col border rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-2 md:px-3 py-2 border-b bg-muted/30">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 md:hidden"
              onClick={() => setAbiertaEnCelular(false)}
              aria-label="Volver a las pizarras"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium truncate">{selectedBoard.name}</span>
            <div className="flex-1" />
            {saving && (
              <Badge variant="outline" className="text-xs gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Guardando...
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={handleDeleteBoard}
              disabled={deleteBoard.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleManualSave} disabled={saving || loadingBoard}>
              <Save className="h-3.5 w-3.5" /> Guardar
            </Button>
          </div>

          {/* Canvas */}
          <div className="flex-1 min-h-0">
            {/* Excalidraw lee initialData solo al montar: si montara antes de que
                llegue el dibujo, la pizarra abriría vacía. */}
            {loadingBoard ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Excalidraw
                key={selectedBoard.id}
                excalidrawAPI={api => { excalidrawApiRef.current = api }}
                initialData={initialData}
                onChange={handleChange}
                theme="light"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 border rounded-xl flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Presentation className="h-10 w-10 opacity-30" />
          <p className="text-sm">Selecciona o crea una pizarra</p>
          <Button size="sm" variant="outline" onClick={() => setShowNewBoard(true)}>
            <Plus className="h-4 w-4" /> Nueva pizarra
          </Button>
        </div>
      ))}
    </div>
  )
}
