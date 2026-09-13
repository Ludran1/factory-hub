// Webhook de WhatsApp entrante (Kapso) → lead en Factory Hub.
//
// Acá solo se verifica la firma y se traduce el payload. El find-or-create vive
// en handle_whatsapp_inbound (DB): es atómico, usa la misma normalize_phone_pe
// que la columna generada y deduplica por wamid.
//
// Contrastado contra la doc de Kapso y contra el agente de Render de PeakGym,
// que recibe webhooks reales en producción:
//   · el tipo de evento viene en el header X-Webhook-Event, no en el body
//   · con buffering el body es { batch: true, data: [...] }, y un lote que falla
//     se reentrega mensaje por mensaje: hay que aceptar las dos formas
//   · un audio trae la transcripción en message.kapso.transcript.text;
//     message.kapso.content es la descripción del adjunto con la URL del archivo
//   · con nombres de usuario de WhatsApp el teléfono puede venir null u omitido y
//     solo llega el business_scoped_user_id: no se descarta, se cruza por BSUID
//
// verify_jwt: FALSE a propósito — lo llama Kapso, no un usuario logueado. La
// autorización es la firma HMAC del body crudo.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('KAPSO_WEBHOOK_SECRET')
/** Qué se vende por este número. Va al campo `product` del lead. */
const PRODUCT = Deno.env.get('WHATSAPP_LEAD_PRODUCT') ?? 'PeakGym'

/** No son una persona escribiendo: reacciones a mensajes anteriores y lo que
 *  Meta manda por encuestas, llamadas perdidas o avisos de sistema. */
const IGNORADOS = new Set(['reaction', 'unsupported', 'system'])

interface KapsoItem {
  phone_number_id?: string
  message?: {
    id?: string
    type?: string
    from?: string
    from_user_id?: string
    business_scoped_user_id?: string
    username?: string
    text?: { body?: string }
    kapso?: {
      direction?: string
      transcript?: { text?: string }
      business_scoped_user_id?: string
      username?: string
    }
  }
  conversation?: {
    id?: string
    phone_number?: string | null
    business_scoped_user_id?: string | null
    username?: string | null
    kapso?: { contact_name?: string }
  }
}

interface KapsoEnvelope extends KapsoItem {
  type?: string
  batch?: boolean
  data?: KapsoItem[]
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

/** HMAC-SHA256 del body crudo, en hex, en X-Webhook-Signature. Es el único
 *  formato que documenta Kapso (overview, security, legacy y guías de migración). */
async function firmaValida(req: Request, rawBody: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) {
    console.error('KAPSO_WEBHOOK_SECRET sin configurar: se rechaza todo.')
    return false
  }
  const recibida = (req.headers.get('x-webhook-signature') ?? '').trim().toLowerCase()
  if (!recibida) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const esperada = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))
  return safeEqual(recibida, esperada)
}

/** Mismo criterio que el agente de producción: el texto, la transcripción si es
 *  audio, o un marcador del tipo. Nunca kapso.content, que para un adjunto trae
 *  la descripción del archivo con su URL. */
function textoDe(msg: NonNullable<KapsoItem['message']>): string {
  if (msg.type === 'text') return msg.text?.body?.trim() || '[texto vacío]'
  const transcripcion = msg.kapso?.transcript?.text?.trim()
  return transcripcion || `[${msg.type ?? 'mensaje'}]`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const rawBody = await req.text()

    if (!(await firmaValida(req, rawBody))) {
      console.warn('Webhook rechazado: firma inválida')
      return new Response('Unauthorized', { status: 401 })
    }

    const event = req.headers.get('x-webhook-event')
    const body = JSON.parse(rawBody) as KapsoEnvelope
    const esBatch =
      (req.headers.get('x-webhook-batch') === 'true' || body.batch === true) &&
      Array.isArray(body.data)

    // El webhook se suscribe solo a message.received, pero si en el dashboard se
    // agregan más eventos, se descartan acá en vez de crear leads.
    if (!esBatch && event !== 'whatsapp.message.received') {
      return Response.json({ ok: true, ignored: event ?? 'sin-evento' })
    }

    const items = esBatch ? body.data! : [body]
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const resultados: unknown[] = []
    let fallo = false

    for (const it of items) {
      const msg = it?.message
      if (!msg?.id) continue
      // Los ecos de nuestros propios mensajes no son un lead.
      if (msg.kapso?.direction === 'outbound') continue
      if (IGNORADOS.has(msg.type ?? '')) continue

      const phone = it.conversation?.phone_number ?? msg.from ?? null
      const bsuid =
        it.conversation?.business_scoped_user_id ??
        msg.business_scoped_user_id ??
        msg.kapso?.business_scoped_user_id ??
        msg.from_user_id ??
        null
      const username = it.conversation?.username ?? msg.username ?? msg.kapso?.username ?? null

      if (!phone && !bsuid) {
        console.warn('Mensaje sin teléfono ni BSUID:', msg.id)
        resultados.push({ ok: false, wamid: msg.id, error: 'sin identidad' })
        continue
      }

      const { data, error } = await admin.rpc('handle_whatsapp_inbound', {
        p_phone: phone,
        p_contact_name: it.conversation?.kapso?.contact_name ?? null,
        p_text: textoDe(msg),
        p_wamid: msg.id,
        p_conversation_id: it.conversation?.id ?? null,
        p_product: PRODUCT,
        p_bsuid: bsuid,
        p_username: username,
      })

      if (error) {
        console.error('handle_whatsapp_inbound falló:', msg.id, error.message)
        fallo = true
        continue
      }
      resultados.push(data)
    }

    // 500 → Kapso reintenta la entrega completa. Es seguro: los mensajes que ya
    // entraron se deduplican por wamid en la DB.
    if (fallo) return new Response('Error', { status: 500 })

    console.log('inbound procesado:', JSON.stringify(resultados))
    return Response.json({ ok: true, procesados: resultados.length, resultados })
  } catch (e) {
    console.error('whatsapp-webhook:', e instanceof Error ? e.message : String(e))
    return new Response('Error', { status: 500 })
  }
})
