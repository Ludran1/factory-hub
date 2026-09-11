import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, Loader2, ChevronRight } from 'lucide-react'
import { useQuotesByLead, useCreateQuote } from '@/hooks/useQuotes'
import { formatMoney, effectiveStatus, QUOTE_STATUS_CONFIG } from '@/lib/quotes'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Currency } from '@/types/database'

interface Props {
  lead: {
    id: string
    company: string
    contact_name: string | null
    contact_email: string | null
    owner_id: string | null
    product?: string | null
  }
  canEdit: boolean
}

/**
 * Entrada principal al módulo: las cotizaciones viven donde vive el deal.
 * Mismo patrón que las secciones de Actividad y Tareas del panel.
 */
export default function QuoteSection({ lead, canEdit }: Props) {
  const navigate = useNavigate()
  const { data: quotes = [], isLoading } = useQuotesByLead(lead.id)
  const createQuote = useCreateQuote()

  const handleCreate = async () => {
    try {
      const quote = await createQuote.mutateAsync({ lead })
      navigate(`/marketing/cotizacion/${quote.id}`)
    } catch {
      toast.error('No se pudo crear la cotización')
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Cotizaciones
        </p>
        {canEdit && (
          <Button
            variant="ghost" size="sm" className="h-7 text-xs"
            onClick={handleCreate}
            disabled={createQuote.isPending}
          >
            {createQuote.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Plus className="h-3.5 w-3.5" />}
            Nueva
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : quotes.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Sin cotizaciones. El valor del lead sigue siendo una estimación a mano.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {quotes.map(q => {
            const status = effectiveStatus(q)
            return (
              <li key={q.id}>
                <button
                  onClick={() => navigate(`/marketing/cotizacion/${q.id}`)}
                  className="w-full flex items-center gap-2.5 rounded-md border border-border px-2.5 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium tabular-nums">{q.number}</span>
                      {q.version > 1 && (
                        <span className="text-[10px] text-muted-foreground">v{q.version}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {format(parseISO(q.created_at), 'd MMM yyyy', { locale: es })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold tabular-nums">
                      {formatMoney(q.total, q.currency as Currency)}
                    </p>
                    <Badge className={cn('text-[10px] mt-0.5', QUOTE_STATUS_CONFIG[status].class)}>
                      {QUOTE_STATUS_CONFIG[status].label}
                    </Badge>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
