import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft, Send, Copy, Printer, Trash2, Loader2, RefreshCw,
  FileText, Eye, CheckCircle2, XCircle, Clock, PenLine, Files, MessageCircle,
} from 'lucide-react'
import {
  useQuote, useUpdateQuote, useSendQuote, useDeleteQuote, useDuplicateQuote, useSendQuoteWhatsApp,
} from '@/hooks/useQuotes'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useFxRate } from '@/hooks/useFxRate'
import { useAuth } from '@/hooks/useAuth'
import QuoteItemsEditor from '@/components/marketing/QuoteItemsEditor'
import QuoteDocument from '@/components/marketing/QuoteDocument'
import {
  formatMoney, effectiveStatus, QUOTE_STATUS_CONFIG, publicQuoteUrl, computeTotals,
} from '@/lib/quotes'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Currency, QuoteEmitter, QuoteEvent, QuoteItem } from '@/types/database'

const eventConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  creada:    { label: 'Creada',    icon: <FileText className="h-3.5 w-3.5" /> },
  revisada:  { label: 'Nueva versión', icon: <Files className="h-3.5 w-3.5" /> },
  enviada:   { label: 'Enviada',   icon: <Send className="h-3.5 w-3.5" /> },
  vista:     { label: 'Vista por el cliente', icon: <Eye className="h-3.5 w-3.5" /> },
  aceptada:  { label: 'Aceptada',  icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> },
  rechazada: { label: 'Rechazada', icon: <XCircle className="h-3.5 w-3.5 text-red-500" /> },
}

const EMPTY_FORM = {
  title: '', client_company: '', client_contact: '', client_email: '',
  client_phone: '', client_doc: '', client_address: '', valid_until: '', terms: '',
}

function formFromQuote(q: {
  title: string; client_company: string; client_contact: string | null
  client_email: string | null; client_phone: string | null; client_doc: string | null
  client_address: string | null; valid_until: string | null; terms: string | null
}): typeof EMPTY_FORM {
  return {
    title: q.title,
    client_company: q.client_company,
    client_contact: q.client_contact ?? '',
    client_email: q.client_email ?? '',
    client_phone: q.client_phone ?? '',
    client_doc: q.client_doc ?? '',
    client_address: q.client_address ?? '',
    valid_until: q.valid_until ?? '',
    terms: q.terms ?? '',
  }
}

export default function QuotePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role } = useAuth()

  const { data: quote, isLoading } = useQuote(id ?? null)
  const { data: org } = useOrgSettings()
  const updateQuote = useUpdateQuote()
  const sendQuote = useSendQuote()
  const deleteQuote = useDeleteQuote()
  const duplicateQuote = useDuplicateQuote()
  const sendWhatsApp = useSendQuoteWhatsApp()

  const [form, setForm] = useState(EMPTY_FORM)
  const [formQuoteId, setFormQuoteId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const currency = (quote?.currency ?? 'PEN') as Currency
  const { data: fx, isFetching: fxLoading, refetch: refetchFx } = useFxRate(currency === 'USD')

  // Sembrar el formulario al llegar la cotización. En render y no en un
  // efecto: setState dentro de useEffect dispara un render en cascada y es
  // justo lo que la regla react-hooks/set-state-in-effect señala.
  if (quote && quote.id !== formQuoteId) {
    setFormQuoteId(quote.id)
    setForm(formFromQuote(quote))
  }

  // Precargar el TC es tocar un sistema externo (la DB), no sincronizar
  // estado: acá el efecto sí corresponde.
  const quoteId = quote?.id
  const quoteStatus = quote?.status
  const quoteFxRate = quote?.fx_rate
  useEffect(() => {
    if (!quoteId || quoteStatus !== 'borrador') return
    if (currency !== 'USD' || !fx?.usd_pen) return
    if (Number(quoteFxRate) !== 1) return
    updateQuote.mutate({ id: quoteId, fx_rate: fx.usd_pen })
    // updateQuote es estable entre renders (useMutation); incluirlo re-dispararía
    // el efecto en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx?.usd_pen, currency, quoteId, quoteStatus, quoteFxRate])

  if (isLoading || !quote) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const items = (quote.quote_items ?? []) as QuoteItem[]
  const events = ((quote.quote_events ?? []) as (QuoteEvent & { actor?: { name: string } | null })[])
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const status = effectiveStatus(quote)
  const isDraft = quote.status === 'borrador'
  const canDelete = isDraft && (role === 'admin' || role === 'closer')

  const emitter: QuoteEmitter = org ?? {
    legal_name: '', ruc: '', address: null, email: null,
    phone: null, website: null, logo_base64: null,
  }

  // Totales en vivo mientras se edita; la DB recalcula igual al guardar.
  const live = computeTotals(items, Number(quote.igv_rate), Number(quote.fx_rate))

  // title y client_company son NOT NULL en la DB: vaciarlos no puede mandar
  // null o el update revienta con una violación de constraint.
  const REQUIRED_FIELDS: (keyof typeof form)[] = ['title', 'client_company']

  const saveField = (patch: Partial<typeof form>) => {
    const key = Object.keys(patch)[0] as keyof typeof form
    const value = (patch[key] ?? '').trim()
    const current = (quote[key as keyof typeof quote] ?? '') as string
    if (current === value) return
    if (REQUIRED_FIELDS.includes(key) && !value) {
      setForm(f => ({ ...f, [key]: current }))
      toast.error(key === 'title' ? 'El título no puede quedar vacío' : 'La empresa no puede quedar vacía')
      return
    }
    updateQuote.mutate({ id: quote.id, [key]: value || null })
  }

  const handleSend = async () => {
    if (items.length === 0) {
      toast.error('Agrega al menos una línea antes de enviar')
      return
    }
    try {
      await sendQuote.mutateAsync(quote.id)
      await navigator.clipboard.writeText(publicQuoteUrl(quote.public_token)).catch(() => {})
      toast.success('Cotización enviada · link copiado al portapapeles')
    } catch {
      toast.error('No se pudo enviar la cotización')
    }
  }

  const handleSendWhatsApp = async () => {
    try {
      await sendWhatsApp.mutateAsync(quote.id)
      toast.success('Cotización enviada por WhatsApp')
    } catch (e) {
      // El motivo real importa: "la plantilla no está aprobada" y "el número es
      // inválido" se arreglan de formas muy distintas.
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar por WhatsApp')
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicQuoteUrl(quote.public_token))
      toast.success('Link copiado')
    } catch {
      toast.error('No se pudo copiar el link')
    }
  }

  const handleDuplicate = async () => {
    try {
      const copy = await duplicateQuote.mutateAsync(quote.id)
      toast.success(`Creada la versión ${copy.version}`)
      navigate(`/marketing/cotizacion/${copy.id}`)
    } catch {
      toast.error('No se pudo crear la nueva versión')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteQuote.mutateAsync(quote.id)
      toast.success('Cotización eliminada')
      navigate('/marketing')
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Barra de acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link to="/marketing" aria-label="Volver a Marketing"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight tabular-nums">{quote.number}</h1>
              <Badge className={cn('text-xs', QUOTE_STATUS_CONFIG[status].class)}>
                {QUOTE_STATUS_CONFIG[status].label}
              </Badge>
              {quote.version > 1 && (
                <Badge variant="outline" className="text-xs">v{quote.version}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">{quote.client_company}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <Button size="sm" onClick={handleSend} disabled={sendQuote.isPending}>
              <Send className="h-4 w-4" /> Enviar
            </Button>
          )}
          {!isDraft && (
            <>
              <Button
                size="sm"
                onClick={handleSendWhatsApp}
                disabled={sendWhatsApp.isPending || !quote.client_phone_e164}
                title={quote.client_phone_e164
                  ? `Enviar a +${quote.client_phone_e164}`
                  : 'La cotización no tiene un teléfono válido'}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={handleCopyLink}>
                <Copy className="h-4 w-4" /> Copiar link
              </Button>
              <Button size="sm" variant="outline" onClick={handleDuplicate} disabled={duplicateQuote.isPending}>
                <Files className="h-4 w-4" /> Nueva versión
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          {canDelete && (
            confirmDelete ? (
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteQuote.isPending}>
                Confirmar
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )
          )}
        </div>
      </div>

      {!isDraft && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm print:hidden">
          <PenLine className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-muted-foreground">
            Esta cotización ya fue enviada y quedó congelada. Para cambiar algo, crea una nueva versión —
            así el cliente y tú siguen viendo el mismo documento que se envió.
          </p>
        </div>
      )}

      <Tabs defaultValue={isDraft ? 'editar' : 'documento'}>
        <TabsList className="print:hidden">
          <TabsTrigger value="editar" disabled={!isDraft}>Editar</TabsTrigger>
          <TabsTrigger value="documento">Documento</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        {/* ---------- Editar ---------- */}
        <TabsContent value="editar" className="print:hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
            <div className="space-y-5">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Título de la propuesta</Label>
                    <Input
                      value={form.title}
                      disabled={!isDraft}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      onBlur={e => saveField({ title: e.target.value })}
                      placeholder="Ej: Desarrollo de plataforma web"
                    />
                  </div>

                  <Separator />

                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Cliente</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Empresa</Label>
                      <Input
                        value={form.client_company}
                        disabled={!isDraft}
                        onChange={e => setForm({ ...form, client_company: e.target.value })}
                        onBlur={e => saveField({ client_company: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Contacto</Label>
                      <Input
                        value={form.client_contact}
                        disabled={!isDraft}
                        onChange={e => setForm({ ...form, client_contact: e.target.value })}
                        onBlur={e => saveField({ client_contact: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>RUC / DNI</Label>
                      <Input
                        value={form.client_doc}
                        disabled={!isDraft}
                        onChange={e => setForm({ ...form, client_doc: e.target.value })}
                        onBlur={e => saveField({ client_doc: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.client_email}
                        disabled={!isDraft}
                        onChange={e => setForm({ ...form, client_email: e.target.value })}
                        onBlur={e => saveField({ client_email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>WhatsApp</Label>
                      <Input
                        value={form.client_phone}
                        disabled={!isDraft}
                        placeholder="999 888 777"
                        onChange={e => setForm({ ...form, client_phone: e.target.value })}
                        onBlur={e => saveField({ client_phone: e.target.value })}
                      />
                      {/* client_phone_e164 es columna generada: si sale null, el
                          número no se pudo interpretar y el envío va a fallar. */}
                      {form.client_phone && !quote.client_phone_e164 && (
                        <p className="text-xs text-amber-500">
                          No se entiende como número: no se va a poder enviar por WhatsApp.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Dirección</Label>
                      <Input
                        value={form.client_address}
                        disabled={!isDraft}
                        onChange={e => setForm({ ...form, client_address: e.target.value })}
                        onBlur={e => saveField({ client_address: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <QuoteItemsEditor
                    quoteId={quote.id}
                    items={items}
                    currency={currency}
                    readOnly={!isDraft}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-1.5">
                  <Label>Términos y condiciones</Label>
                  <Textarea
                    rows={4}
                    value={form.terms}
                    disabled={!isDraft}
                    placeholder="Forma de pago, plazos de entrega, qué incluye y qué no..."
                    onChange={e => setForm({ ...form, terms: e.target.value })}
                    onBlur={e => saveField({ terms: e.target.value })}
                  />
                  {isDraft && org?.default_terms && !form.terms && (
                    <Button
                      variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => {
                        setForm({ ...form, terms: org.default_terms! })
                        updateQuote.mutate({ id: quote.id, terms: org.default_terms })
                      }}
                    >
                      Usar los términos por defecto
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Panel lateral */}
            <div className="space-y-4 lg:sticky lg:top-4 self-start">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label>Moneda</Label>
                    <Select
                      value={currency}
                      disabled={!isDraft}
                      onValueChange={v => updateQuote.mutate({ id: quote.id, currency: v as Currency, ...(v === 'PEN' ? { fx_rate: 1 } : {}) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PEN">S/ Soles</SelectItem>
                        <SelectItem value="USD">$ Dólares</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {currency === 'USD' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Tipo de cambio</Label>
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6"
                          disabled={!isDraft || fxLoading}
                          onClick={() => refetchFx()}
                          aria-label="Actualizar tipo de cambio"
                        >
                          <RefreshCw className={cn('h-3 w-3', fxLoading && 'animate-spin')} />
                        </Button>
                      </div>
                      <Input
                        type="number" step="0.001" min={0.001}
                        defaultValue={quote.fx_rate}
                        disabled={!isDraft}
                        onBlur={e => {
                          const v = Number(e.target.value)
                          if (v > 0 && v !== Number(quote.fx_rate)) {
                            updateQuote.mutate({ id: quote.id, fx_rate: v })
                          }
                        }}
                      />
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {fx
                          ? `TC ${fx.source.startsWith('BCRP') ? 'BCRP' : fx.source} del ${format(parseISO(fx.date), 'd MMM', { locale: es })}: ${fx.usd_pen}${fx.stale ? ' (aún no publican el de hoy)' : ''}`
                          : 'Sin referencia del BCRP: escríbelo a mano.'}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Válida hasta</Label>
                    <DatePicker
                      value={form.valid_until}
                      onChange={v => {
                        setForm({ ...form, valid_until: v ?? '' })
                        updateQuote.mutate({ id: quote.id, valid_until: v || null })
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatMoney(live.subtotal, currency)}</span>
                  </div>
                  {live.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="tabular-nums text-emerald-600">− {formatMoney(live.discount, currency)}</span>
                    </div>
                  )}
                  {Number(quote.igv_rate) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IGV ({quote.igv_rate}%)</span>
                      <span className="tabular-nums">{formatMoney(live.igv, currency)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span className="tabular-nums">{formatMoney(live.total, currency)}</span>
                  </div>
                  {currency === 'USD' && (
                    <p className="text-[11px] text-muted-foreground text-right">
                      ≈ {formatMoney(live.total_pen, 'PEN')} al TC {quote.fx_rate}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ---------- Documento ---------- */}
        <TabsContent value="documento">
          <QuoteDocument quote={quote} items={items} emitter={emitter} />
        </TabsContent>

        {/* ---------- Historial ---------- */}
        <TabsContent value="historial" className="print:hidden">
          <Card>
            <CardContent className="p-4">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sin actividad todavía.</p>
              ) : (
                <ol className="space-y-3">
                  {events.map(ev => {
                    const cfg = eventConfig[ev.type] ?? { label: ev.type, icon: <Clock className="h-3.5 w-3.5" /> }
                    const signer = (ev.meta as { signer?: string } | null)?.signer
                    return (
                      <li key={ev.id} className="flex items-start gap-3">
                        <span className="mt-0.5 h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                          {cfg.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{cfg.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(ev.created_at), "d MMM yyyy · HH:mm", { locale: es })}
                            {signer && ` · ${signer}`}
                            {ev.actor?.name && ` · ${ev.actor.name}`}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
