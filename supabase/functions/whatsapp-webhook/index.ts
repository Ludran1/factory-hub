// Webhook de WhatsApp entrante (Kapso) → lead en Factory Hub.
//
// Lo único que hace acá es verificar la firma y traducir el payload. El
// find-or-create vive en handle_whatsapp_inbound (migración 20260911190000)
// porque ahí es atómico y usa la misma normalize_phone_pe que la columna
// generada: un solo dialecto de teléfono en todo el sistema.
//
// verify_jwt: FALSE a propósito — lo llama Kapso, no un usuario logueado.
// La autorización es la firma HMAC del body crudo.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('KAPSO_WEBHOOK_SECRET')
/** Qué se está vendiendo por este número. Va al campo `product` del lead. */
const PRODUCT = Deno.env.get('WHATSAPP_LEAD_PRODUCT') ?? 'PeakGym'

interface KapsoWebhook {
  event?: string
  phone_number_id?: string
  is_new_conversation?: boolean
  message?: {
    id?: string
    type?: string
    text?: { body?: string }
    kapso?: { direction?: string; content?: string; transcript?: string }
  }
  conversation?: {
    id?: string
    phone_number?: string
    kapso?: { contact_name?: string }
  }
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Comparación en tiempo constante: un `===` filtra el secreto por timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * La doc actual de Kapso especifica `X-Webhook-Signature` con hex plano, pero
 * el webhook de PeakGym compara contra `sha256=<hex>` en `x-kapso-signature` y
 * está en producción. Hasta confirmar cuál manda de verdad, se aceptan ambos y
 * se loguea el que matcheó — así el log dice cuál formato está vivo y después
 * se puede cerrar al que corresponda.
 */
async function firmaValida(req: Request, rawBody: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) {
    console.error('KAPSO_WEBHOOK_SECRET sin configurar: se rechaza todo.')
    return false
  }

  const recibida =
    req.headers.get('x-webhook-signature') ??
    req.headers.get('x-kapso-signature') ??
    ''
  if (!recibida) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const esperada = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))

  if (safeEqual(recibida, esperada)) {
    console.log('firma ok (hex plano)')
    return true
  }
  if (safeEqual(recibida, `sha256=${esperada}`)) {
    console.log('firma ok (prefijo sha256=)')
    return true
  }
  return false
}

/** El texto según el tipo de mensaje. Audio trae transcript, no body. */
function textoDe(msg: KapsoWebhook['message']): string | null {
  return (
    msg?.text?.body ??
    msg?.kapso?.content ??
    msg?.kapso?.transcript ??
    null
  )
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const rawBody = await req.text()

    if (!(await firmaValida(req, rawBody))) {
      console.warn('Webhook rechazado: firma inválida')
      return new Response('Unauthorized', { status: 401 })
    }

    const body = JSON.parse(rawBody) as KapsoWebhook

    // Se suscribe solo a message.received, pero si la config del webhook manda
    // de más, acá se descarta en vez de crear leads fantasma con los ecos de
    // nuestros propios mensajes salientes.
    const esEntrante =
      (body.event === undefined || body.event === 'whatsapp.message.received') &&
      body.message?.kapso?.direction !== 'outbound'

    if (!esEntrante) {
      return Response.json({ ok: true, ignored: body.event ?? 'no-event' })
    }

    const phone = body.conversation?.phone_number
    const wamid = body.message?.id
    if (!phone || !wamid) {
      console.warn('Payload sin phone_number o message.id', rawBody.slice(0, 300))
      // 200 igual: reintentar no va a arreglar un payload incompleto.
      return Response.json({ ok: false, error: 'Payload incompleto' })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    const { data, error } = await admin.rpc('handle_whatsapp_inbound', {
      p_phone: phone,
      p_contact_name: body.conversation?.kapso?.contact_name ?? null,
      p_text: textoDe(body.message),
      p_wamid: wamid,
      p_conversation_id: body.conversation?.id ?? null,
      p_product: PRODUCT,
    })

    if (error) {
      console.error('handle_whatsapp_inbound falló:', error.message)
      // 500 → Kapso reintenta. El wamid hace que el reintento sea seguro.
      return new Response('Error', { status: 500 })
    }

    console.log('inbound procesado:', JSON.stringify(data))
    return Response.json(data)
  } catch (e) {
    console.error('whatsapp-webhook:', e instanceof Error ? e.message : String(e))
    return new Response('Error', { status: 500 })
  }
})
