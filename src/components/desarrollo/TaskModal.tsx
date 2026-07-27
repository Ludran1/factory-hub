import { useEffect, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import Image from '@tiptap/extension-image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { useCreateTask, useUpdateTask, useDeleteTask, useDevelopers } from '@/hooks/useTasks'
import { toast } from 'sonner'
import { Trash2, ListChecks, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_IMAGE_BYTES = 1_500_000

// Image con ancho persistente (para poder achicar/agrandar en el editor)
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.width || null,
        renderHTML: (attrs: { width?: string | null }) =>
          attrs.width ? { style: `width: ${attrs.width}` } : {},
      },
    }
  },
})

const schema = z.object({
  title: z.string().min(1, 'Requerido'),
  priority: z.enum(['urgente', 'importante', 'alta', 'media', 'baja', 'delegar']),
  objective_id: z.string().min(1, 'Requerido'),
  assignee_id: z.string().optional(),
  due_date: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  objectives: Array<{ id: string; name: string; color: string }>
  task?: {
    id: string
    title: string
    priority: string
    objective_id: string
    assignee_id: string | null
    due_date: string | null
    description?: unknown
  } | null
}

const priorityColors: Record<string, string> = {
  urgente: 'text-red-500',
  importante: 'text-pink-500',
  alta: 'text-orange-500',
  media: 'text-yellow-500',
  baja: 'text-slate-400',
  delegar: 'text-sky-500',
}

export default function TaskModal({ open, onClose, objectives, task }: Props) {
  const isEdit = !!task
  const { data: developers = [] } = useDevelopers()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const imageInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, watch, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'media', objective_id: objectives[0]?.id ?? '' },
  })

  const insertImageFile = (file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Imagen muy pesada (máx ~1.5 MB). Usa una captura más chica.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      editor?.chain().focus().setImage({ src: reader.result as string }).run()
    }
    reader.readAsDataURL(file)
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Descripción, checklist, imágenes (pegar captura funciona)...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ResizableImage.configure({ allowBase64: true }),
    ],
    content: '',
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[110px] max-h-[240px] overflow-y-auto rounded-md border border-input px-3 py-2',
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) {
              insertImageFile(file)
              return true
            }
          }
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        priority: task.priority as FormData['priority'],
        objective_id: task.objective_id,
        assignee_id: task.assignee_id ?? undefined,
        due_date: task.due_date ?? undefined,
      })
      editor?.commands.setContent((task.description as object) ?? '')
    } else {
      reset({ priority: 'media', objective_id: objectives[0]?.id ?? '' })
      editor?.commands.setContent('')
    }
  }, [task, open, editor])

  const onSubmit = async (data: FormData) => {
    try {
      const description = editor && !editor.isEmpty ? editor.getJSON() : null
      if (isEdit && task) {
        await updateTask.mutateAsync({ id: task.id, ...data, assignee_id: data.assignee_id || null, due_date: data.due_date || null, description })
        toast.success('Tarea actualizada')
      } else {
        await createTask.mutateAsync({ ...data, assignee_id: data.assignee_id || null, due_date: data.due_date || null, description })
        toast.success('Tarea creada')
      }
      onClose()
    } catch {
      toast.error('Error al guardar la tarea')
    }
  }

  const handleDelete = async () => {
    if (!task) return
    if (!window.confirm(`¿Borrar la tarea "${task.title}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteTask.mutateAsync(task.id)
      toast.success('Tarea eliminada')
      onClose()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titulo</Label>
            <Input placeholder="Descripcion de la tarea..." {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Objetivo</Label>
            <Select value={watch('objective_id')} onValueChange={(v) => setValue('objective_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {objectives.map(obj => (
                  <SelectItem key={obj.id} value={obj.id}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: obj.color }} />
                      <span className="truncate">{obj.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.objective_id && <p className="text-xs text-destructive">{errors.objective_id.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Prioridad</Label>
            <Select value={watch('priority')} onValueChange={(v) => setValue('priority', v as FormData['priority'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['urgente', 'importante', 'alta', 'media', 'baja', 'delegar'] as const).map(p => (
                  <SelectItem key={p} value={p}>
                    <span className={priorityColors[p]}>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Descripcion</Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn('h-6 w-6', editor?.isActive('taskList') && 'bg-accent')}
                  title="Checklist"
                  onClick={() => editor?.chain().focus().toggleTaskList().run()}
                >
                  <ListChecks className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Insertar imagen"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </Button>
                {editor?.isActive('image') && (
                  <>
                    {([['S', '25%'], ['M', '50%'], ['L', '100%']] as const).map(([label, width]) => (
                      <Button
                        key={label}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-6 px-1.5 text-[11px]',
                          editor?.getAttributes('image').width === width && 'bg-accent'
                        )}
                        title={`Imagen al ${width}`}
                        onClick={() => editor?.chain().focus().updateAttributes('image', { width }).run()}
                      >
                        {label}
                      </Button>
                    ))}
                  </>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) insertImageFile(file)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
            <EditorContent editor={editor} />
          </div>

          <div className="space-y-1.5">
            <Label>Fecha estimada de finalizacion</Label>
            <Controller
              name="due_date"
              control={control}
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Asignar a</Label>
            <Select value={watch('assignee_id') ?? 'none'} onValueChange={(v) => setValue('assignee_id', v === 'none' ? undefined : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {developers.map(dev => (
                  <SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between pt-2">
            {isEdit && (
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={createTask.isPending || updateTask.isPending}>
                {isEdit ? 'Guardar' : 'Crear tarea'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
