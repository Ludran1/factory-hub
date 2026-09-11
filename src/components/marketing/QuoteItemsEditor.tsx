import { useState, useEffect } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import {
  useAddQuoteItem, useUpdateQuoteItem, useDeleteQuoteItem, useReorderQuoteItems,
} from '@/hooks/useQuotes'
import { CURRENCY_SYMBOL, formatMoney } from '@/lib/quotes'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Currency, QuoteItem } from '@/types/database'

interface Props {
  quoteId: string
  items: QuoteItem[]
  currency: Currency
  readOnly: boolean
}

interface RowProps {
  item: QuoteItem
  quoteId: string
  currency: Currency
  readOnly: boolean
}

function ItemRow({ item, quoteId, currency, readOnly }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: readOnly,
  })
  const updateItem = useUpdateQuoteItem()
  const deleteItem = useDeleteQuoteItem()

  // Estado local para no mandar una mutación por cada tecla; se persiste al
  // salir del campo.
  const [draft, setDraft] = useState(item)
  useEffect(() => { setDraft(item) }, [item])

  const commit = (patch: Partial<QuoteItem>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    const changed = (Object.keys(patch) as (keyof QuoteItem)[]).some(k => item[k] !== next[k])
    if (!changed) return
    updateItem.mutate({ id: item.id, quote_id: quoteId, ...patch })
  }

  const lineTotal = draft.qty * draft.unit_price - draft.discount

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'grid grid-cols-[auto_1fr_70px_110px_100px_90px_auto] gap-2 items-start py-2 border-b border-border/60 last:border-0',
        isDragging && 'opacity-40',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        disabled={readOnly}
        className="mt-2 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing disabled:opacity-30 disabled:cursor-default"
        aria-label="Reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="space-y-1">
        <Input
          className="h-8"
          placeholder="Concepto"
          value={draft.description}
          disabled={readOnly}
          onChange={e => setDraft({ ...draft, description: e.target.value })}
          onBlur={e => commit({ description: e.target.value })}
        />
        <Input
          className="h-7 text-xs text-muted-foreground"
          placeholder="Detalle / alcance (opcional)"
          value={draft.detail ?? ''}
          disabled={readOnly}
          onChange={e => setDraft({ ...draft, detail: e.target.value })}
          onBlur={e => commit({ detail: e.target.value || null })}
        />
      </div>

      <Input
        className="h-8"
        type="number" min={0.01} step="any"
        value={draft.qty}
        disabled={readOnly}
        onChange={e => setDraft({ ...draft, qty: Number(e.target.value) })}
        onBlur={e => commit({ qty: Math.max(0.01, Number(e.target.value) || 1) })}
      />

      <Input
        className="h-8"
        type="number" min={0} step="0.01"
        value={draft.unit_price}
        disabled={readOnly}
        onChange={e => setDraft({ ...draft, unit_price: Number(e.target.value) })}
        onBlur={e => commit({ unit_price: Math.max(0, Number(e.target.value) || 0) })}
      />

      <Input
        className="h-8"
        type="number" min={0} step="0.01"
        value={draft.discount}
        disabled={readOnly}
        onChange={e => setDraft({ ...draft, discount: Number(e.target.value) })}
        onBlur={e => commit({ discount: Math.max(0, Number(e.target.value) || 0) })}
      />

      <p className="h-8 flex items-center justify-end text-sm font-medium tabular-nums">
        {formatMoney(lineTotal, currency)}
      </p>

      <Button
        variant="ghost" size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        disabled={readOnly || deleteItem.isPending}
        onClick={async () => {
          try {
            await deleteItem.mutateAsync({ id: item.id, quote_id: quoteId })
          } catch {
            toast.error('No se pudo eliminar la línea')
          }
        }}
        aria-label="Eliminar línea"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export default function QuoteItemsEditor({ quoteId, items, currency, readOnly }: Props) {
  const addItem = useAddQuoteItem()
  const reorder = useReorderQuoteItems()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const sorted = [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = sorted.findIndex(i => i.id === active.id)
    const newIndex = sorted.findIndex(i => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const ids = arrayMove(sorted, oldIndex, newIndex).map(i => i.id)
    reorder.mutate({ quote_id: quoteId, ids })
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_1fr_70px_110px_100px_90px_auto] gap-2 text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-0">
        <span className="w-4" />
        <span>Concepto</span>
        <span>Cant.</span>
        <span>P. unitario</span>
        <span>Descuento</span>
        <span className="text-right">Total</span>
        <span className="w-8" />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {sorted.map(item => (
            <ItemRow key={item.id} item={item} quoteId={quoteId} currency={currency} readOnly={readOnly} />
          ))}
        </SortableContext>
      </DndContext>

      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Sin líneas todavía. Agrega la primera para armar el precio.
        </p>
      )}

      {!readOnly && (
        <Button
          variant="outline" size="sm" className="mt-1"
          disabled={addItem.isPending}
          onClick={async () => {
            try {
              await addItem.mutateAsync({ quote_id: quoteId, position: sorted.length })
            } catch {
              toast.error('No se pudo agregar la línea')
            }
          }}
        >
          <Plus className="h-4 w-4" /> Agregar línea
        </Button>
      )}

      <p className="text-[11px] text-muted-foreground pt-1">
        Montos en {CURRENCY_SYMBOL[currency]} · descuento en monto, no en porcentaje
      </p>
    </div>
  )
}
