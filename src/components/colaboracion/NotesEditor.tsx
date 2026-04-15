import { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useNotes, useCreateNote, useSaveNote, useDeleteNote } from '@/hooks/useCollab'
import { useAuth } from '@/hooks/useAuth'
import {
  Plus, Trash2, Loader2, Save, FileText,
  Bold, Italic, List, ListOrdered, Heading2, Code
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  projectId: string
}

export default function NotesEditor({ projectId }: Props) {
  const { profile } = useAuth()
  const { data: notes = [], isLoading } = useNotes(projectId)
  const createNote = useCreateNote()
  const saveNote = useSaveNote()
  const deleteNote = useDeleteNote()

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [showNewNote, setShowNewNote] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')

  const selectedNote = notes.find(n => n.id === selectedNoteId) ?? null

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Escribe aqui...' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-1',
      },
    },
  })

  // Load note content when selected note changes
  useEffect(() => {
    if (!editor) return
    if (selectedNote) {
      setTitle(selectedNote.title)
      editor.commands.setContent(selectedNote.content ?? '')
    } else {
      setTitle('')
      editor.commands.setContent('')
    }
  }, [selectedNoteId, editor])

  // Auto-select first note
  useEffect(() => {
    if (notes.length > 0 && !selectedNoteId) {
      setSelectedNoteId(notes[0].id)
    }
  }, [notes])

  const handleSave = useCallback(async () => {
    if (!selectedNote || !editor) return
    setSaving(true)
    try {
      await saveNote.mutateAsync({
        id: selectedNote.id,
        project_id: projectId,
        title: title.trim() || 'Sin titulo',
        content: editor.getJSON(),
      })
      toast.success('Nota guardada')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [selectedNote, editor, title, projectId])

  const handleCreateNote = async () => {
    if (!profile || !newNoteTitle.trim()) return
    try {
      const note = await createNote.mutateAsync({
        project_id: projectId,
        author_id: profile.id,
        title: newNoteTitle.trim(),
      })
      setSelectedNoteId(note.id)
      setNewNoteTitle('')
      setShowNewNote(false)
    } catch {
      toast.error('Error al crear nota')
    }
  }

  const handleDelete = async () => {
    if (!selectedNote) return
    try {
      await deleteNote.mutateAsync({ id: selectedNote.id, project_id: projectId })
      setSelectedNoteId(null)
      toast.success('Nota eliminada')
    } catch {
      toast.error('Error al eliminar')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-[640px]">
      {/* Sidebar — note list */}
      <div className="w-56 shrink-0 flex flex-col gap-1 border rounded-xl p-2 overflow-y-auto">
        <div className="flex items-center justify-between px-1 py-1 mb-1">
          <span className="text-xs font-semibold text-muted-foreground">NOTAS</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewNote(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {showNewNote && (
          <div className="px-1 pb-2 space-y-1">
            <Input
              value={newNoteTitle}
              onChange={e => setNewNoteTitle(e.target.value)}
              placeholder="Titulo de la nota"
              className="h-7 text-xs"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateNote()
                if (e.key === 'Escape') setShowNewNote(false)
              }}
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-xs flex-1" onClick={handleCreateNote} disabled={createNote.isPending}>
                Crear
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowNewNote(false)}>
                ✕
              </Button>
            </div>
          </div>
        )}

        {notes.length === 0 && !showNewNote && (
          <div className="flex flex-col items-center justify-center flex-1 text-center px-2">
            <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Sin notas</p>
          </div>
        )}

        {notes.map(note => (
          <button
            key={note.id}
            onClick={() => setSelectedNoteId(note.id)}
            className={cn(
              'w-full text-left px-2 py-2 rounded-lg transition-colors text-sm',
              note.id === selectedNoteId
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted text-foreground'
            )}
          >
            <p className="font-medium truncate text-xs">{note.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {format(new Date(note.updated_at), 'dd MMM', { locale: es })}
              {' · '}{(note.author as { name: string } | null)?.name}
            </p>
          </button>
        ))}
      </div>

      {/* Editor area */}
      {selectedNote ? (
        <div className="flex-1 flex flex-col border rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={cn('h-7 w-7', editor?.isActive('bold') && 'bg-accent')}
            >
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={cn('h-7 w-7', editor?.isActive('italic') && 'bg-accent')}
              size="icon"
            >
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={cn('h-7 w-7', editor?.isActive('heading', { level: 2 }) && 'bg-accent')}
              size="icon"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={cn('h-7 w-7', editor?.isActive('bulletList') && 'bg-accent')}
              size="icon"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={cn('h-7 w-7', editor?.isActive('orderedList') && 'bg-accent')}
              size="icon"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => editor?.chain().focus().toggleCode().run()}
              className={cn('h-7 w-7', editor?.isActive('code') && 'bg-accent')}
              size="icon"
            >
              <Code className="h-3.5 w-3.5" />
            </Button>

            <Separator orientation="vertical" className="h-5 mx-1" />

            <div className="flex-1" />

            {saving && (
              <Badge variant="outline" className="text-xs gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Guardando...
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> Guardar
            </Button>
          </div>

          {/* Title */}
          <div className="px-6 pt-4 pb-2">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titulo de la nota"
              className="border-none shadow-none text-xl font-bold px-0 focus-visible:ring-0 bg-transparent h-auto"
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <EditorContent editor={editor} />
          </div>
        </div>
      ) : (
        <div className="flex-1 border rounded-xl flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">Selecciona o crea una nota</p>
          <Button size="sm" variant="outline" onClick={() => setShowNewNote(true)}>
            <Plus className="h-4 w-4" /> Nueva nota
          </Button>
        </div>
      )}
    </div>
  )
}
