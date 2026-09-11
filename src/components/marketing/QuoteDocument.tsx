import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatMoney, effectiveStatus, QUOTE_STATUS_CONFIG } from '@/lib/quotes'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Currency, QuoteEmitter, QuoteItem, QuoteStatus } from '@/types/database'

/**
 * El documento. Lo usan la vista previa interna y la pública `/p/:token`:
 * un solo renderer para que el cliente vea exactamente lo mismo que el closer
 * revisó antes de enviar.
 */
export interface QuoteDocumentData {
  number: string
  version: number
  title: string
  status: QuoteStatus
  client_company: string
  client_contact: string | null
  client_email: string | null
  client_doc: string | null
  client_address: string | null
  issue_date: string
  valid_until: string | null
  currency: Currency
  igv_rate: number
  subtotal: number
  discount: number
  igv: number
  total: number
  terms: string | null
}

interface Props {
  quote: QuoteDocumentData
  items: QuoteItem[]
  emitter: QuoteEmitter
  showStatus?: boolean
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: es })
}

export default function QuoteDocument({ quote, items, emitter, showStatus = true }: Props) {
  const status = effectiveStatus(quote)
  const sorted = [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  const hasIgv = quote.igv_rate > 0

  return (
    <article className="bg-card text-foreground rounded-lg border border-border p-6 sm:p-10 print:border-0 print:p-0 print:bg-white print:text-black">
      {/* Cabecera: emisor + número */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-border print:border-black/20">
        <div className="flex items-start gap-4">
          {emitter.logo_base64 && (
            <img
              src={emitter.logo_base64}
              alt={emitter.legal_name}
              className="h-14 w-auto max-w-[180px] object-contain"
            />
          )}
          <div className="space-y-0.5">
            <p className="font-bold text-base leading-tight">{emitter.legal_name || 'Sin razón social'}</p>
            {emitter.ruc && <p className="text-xs text-muted-foreground print:text-black/60">RUC {emitter.ruc}</p>}
            {emitter.address && <p className="text-xs text-muted-foreground print:text-black/60">{emitter.address}</p>}
            <p className="text-xs text-muted-foreground print:text-black/60">
              {[emitter.email, emitter.phone, emitter.website].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <div className="sm:text-right space-y-1 shrink-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground print:text-black/60">Cotización</p>
          <p className="text-xl font-bold tabular-nums">{quote.number}</p>
          {quote.version > 1 && (
            <p className="text-xs text-muted-foreground print:text-black/60">Versión {quote.version}</p>
          )}
          {showStatus && (
            <Badge className={cn('text-xs print:hidden', QUOTE_STATUS_CONFIG[status].class)}>
              {QUOTE_STATUS_CONFIG[status].label}
            </Badge>
          )}
        </div>
      </header>

      {/* Cliente y fechas */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6">
        <div className="space-y-0.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground print:text-black/60">Para</p>
          <p className="font-semibold">{quote.client_company}</p>
          {quote.client_contact && <p className="text-sm">{quote.client_contact}</p>}
          {quote.client_doc && <p className="text-xs text-muted-foreground print:text-black/60">RUC/DNI {quote.client_doc}</p>}
          {quote.client_address && <p className="text-xs text-muted-foreground print:text-black/60">{quote.client_address}</p>}
          {quote.client_email && <p className="text-xs text-muted-foreground print:text-black/60">{quote.client_email}</p>}
        </div>

        <div className="sm:text-right space-y-1 text-sm">
          <p><span className="text-muted-foreground print:text-black/60">Emitida: </span>{fmtDate(quote.issue_date)}</p>
          {quote.valid_until && (
            <p><span className="text-muted-foreground print:text-black/60">Válida hasta: </span>{fmtDate(quote.valid_until)}</p>
          )}
        </div>
      </section>

      <h1 className="text-lg font-bold pb-4">{quote.title}</h1>

      {/* Líneas */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border print:border-black/20 text-left">
              <th className="py-2 pr-3 font-medium text-[11px] uppercase tracking-wider text-muted-foreground print:text-black/60">Concepto</th>
              <th className="py-2 px-3 font-medium text-[11px] uppercase tracking-wider text-muted-foreground print:text-black/60 text-right w-16">Cant.</th>
              <th className="py-2 px-3 font-medium text-[11px] uppercase tracking-wider text-muted-foreground print:text-black/60 text-right w-28">P. unit.</th>
              <th className="py-2 pl-3 font-medium text-[11px] uppercase tracking-wider text-muted-foreground print:text-black/60 text-right w-32">Importe</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(item => (
              <tr key={item.id} className="border-b border-border/60 print:border-black/10 align-top">
                <td className="py-3 pr-3">
                  <p className="font-medium">{item.description}</p>
                  {item.detail && (
                    <p className="text-xs text-muted-foreground print:text-black/60 mt-0.5 whitespace-pre-line">{item.detail}</p>
                  )}
                  {item.discount > 0 && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Descuento {formatMoney(item.discount, quote.currency)}
                    </p>
                  )}
                </td>
                <td className="py-3 px-3 text-right tabular-nums">{item.qty}</td>
                <td className="py-3 px-3 text-right tabular-nums">{formatMoney(item.unit_price, quote.currency)}</td>
                <td className="py-3 pl-3 text-right tabular-nums font-medium">
                  {formatMoney(item.qty * item.unit_price - item.discount, quote.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="flex justify-end pt-5">
        <dl className="w-full sm:w-72 space-y-1.5 text-sm">
          {(quote.discount > 0 || hasIgv) && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground print:text-black/60">Subtotal</dt>
              <dd className="tabular-nums">{formatMoney(quote.subtotal, quote.currency)}</dd>
            </div>
          )}
          {quote.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground print:text-black/60">Descuento</dt>
              <dd className="tabular-nums text-emerald-600">− {formatMoney(quote.discount, quote.currency)}</dd>
            </div>
          )}
          {/* Con igv_rate en 0 (precio final) esta línea no existe */}
          {hasIgv && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground print:text-black/60">IGV ({quote.igv_rate}%)</dt>
              <dd className="tabular-nums">{formatMoney(quote.igv, quote.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-border print:border-black/20 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(quote.total, quote.currency)}</dd>
          </div>
        </dl>
      </div>

      {quote.terms && (
        <section className="pt-8 mt-6 border-t border-border print:border-black/20">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground print:text-black/60 pb-2">
            Términos y condiciones
          </p>
          <p className="text-xs text-muted-foreground print:text-black/70 whitespace-pre-line leading-relaxed">
            {quote.terms}
          </p>
        </section>
      )}
    </article>
  )
}
