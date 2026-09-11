import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, CheckCircle2, XCircle, Printer, FileQuestion, Clock } from 'lucide-react'
import QuoteDocument from '@/components/marketing/QuoteDocument'
import { toast } from 'sonner'
import type { PublicQuotePayload } from '@/types/database'

/**
 * Vista del cliente. Va fuera de ProtectedRoute: quien la abre no tiene cuenta.
 * No consulta las tablas directamente — todo pasa por las funciones
 * security definer que exigen el token (ver docs/prd-cotizaciones.md §7.2).
 */
export default function PublicQuotePage() {
  const { token } = useParams<{ token: string }>()
  const [signer, setSigner] = useState('')
  const [done, setDone] = useState<'aceptada' | 'rechazada' | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['public-quote', token],
    enabled: !!token,
    retry: false,
    queryFn: async (): Promise<PublicQuotePayload | null> => {
      const { data, error } = await supabase.rpc('get_public_quote', { p_token: token! })
      if (error) throw error
      return data as PublicQuotePayload | null
    },
  })

  // Registro de visto. Deduplicado del lado del servidor a 1 por hora.
  const loaded = !!data
  useEffect(() => {
    if (!token || !loaded) return
    supabase.rpc('log_quote_view', { p_token: token }).then(() => {})
  }, [token, loaded])

  const respond = useMutation({
    mutationFn: async (accept: boolean) => {
      const { data: res, error } = await supabase.rpc('respond_quote', {
        p_token: token!,
        p_accept: accept,
        p_signer: signer,
      })
      if (error) throw error
      const parsed = res as { ok: boolean; error?: string }
      if (!parsed.ok) throw new Error(parsed.error ?? 'No se pudo registrar la respuesta')
      return accept
    },
    onSuccess: (accept) => {
      setDone(accept ? 'aceptada' : 'rechazada')
      refetch()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo registrar la respuesta'),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Token inválido, inexistente o cotización aún en borrador: la misma
  // respuesta para los tres, sin filtrar si existe o no.
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3 max-w-sm">
          <FileQuestion className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-bold">Cotización no disponible</h1>
          <p className="text-sm text-muted-foreground">
            Este enlace no es válido o ya no está activo. Pídele a tu contacto que te envíe uno nuevo.
          </p>
        </div>
      </div>
    )
  }

  const { quote, items, emitter, expired } = data
  const answered = quote.status === 'aceptada' || quote.status === 'rechazada'
  const canRespond = quote.status === 'enviada' && !expired && !done

  return (
    <div className="min-h-screen bg-background py-8 px-4 print:p-0 print:bg-white">
      <div className="max-w-3xl mx-auto space-y-5">
        <QuoteDocument quote={quote} items={items} emitter={emitter} showStatus={false} />

        {/* Respuesta del cliente */}
        <div className="print:hidden">
          {(done || answered) && (
            <Card>
              <CardContent className="p-5 flex items-start gap-3">
                {(done ?? quote.status) === 'aceptada' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="font-medium">
                    {(done ?? quote.status) === 'aceptada'
                      ? 'Cotización aceptada'
                      : 'Cotización rechazada'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(done ?? quote.status) === 'aceptada'
                      ? 'Gracias. Tu contacto ya fue notificado y se pondrá en contacto contigo.'
                      : 'Registramos tu respuesta y tu contacto ya fue notificado.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {expired && !answered && !done && (
            <Card>
              <CardContent className="p-5 flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Esta cotización venció</p>
                  <p className="text-sm text-muted-foreground">
                    Su validez terminó el {quote.valid_until}. Escríbele a tu contacto para pedir una actualizada.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {canRespond && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label>Tu nombre</Label>
                  <Input
                    placeholder="Nombre de quien responde"
                    value={signer}
                    onChange={e => setSigner(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => respond.mutate(true)}
                    disabled={!signer.trim() || respond.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Aceptar cotización
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => respond.mutate(false)}
                    disabled={!signer.trim() || respond.isPending}
                  >
                    <XCircle className="h-4 w-4" /> Rechazar
                  </Button>
                  <Button variant="ghost" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Descargar PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!canRespond && (
            <div className="flex justify-center pt-2">
              <Button variant="ghost" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Descargar PDF
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground print:hidden">
          {emitter.legal_name}
        </p>
      </div>
    </div>
  )
}
