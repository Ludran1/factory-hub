// Manda una cotización ya emitida por WhatsApp, como plantilla aprobada.
//
// Tiene que ser plantilla y no texto libre: mandar una cotización casi siempre
// cae fuera de la ventana de 24h desde el último mensaje del cliente, y ahí Meta
// solo entrega plantillas.
//
// Autorización: se lee la cotización con el JWT de quien llama, así RLS decide.
// Si un closer no puede ver esa cotización, tampoco puede mandarla. El service
// role se usa solo para escribir el evento después.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const KAPSO_API_KEY = Deno.env.get('KAPSO_API_KEY')
const KAPSO_PHONE_NUMBER_ID = Deno.env.get('KAPSO_PHONE_NUMBER_ID')
const TEMPLATE = Deno.env.get('KAPSO_QUOTE_TEMPLATE') ?? 'cotizacion_enviada'
const TPL_LANG = Deno.env.get('KAPSO_TPL_LANG') ?? 'es'
const META_VERSION = Deno.env.get('META_GRAPH_VERSION') ?? 'v24.0'
/** Base pública de la app. No se toma del request: el link va dentro de un
 *  mensaje de WhatsApp y no puede depender de lo que mande el navegador. */
const PUBLIC_APP_URL = Deno.env.get('PUBLIC_APP_URL')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function money(total: number, currency: string) {
  const symbol = currency === 'USD' ? '$' : 'S/'
  return `${symbol} ${Number(total).toLocaleString('es-PE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`
}

/**
 * Meta rechaza valores de variable con saltos de línea, tabs o varios espacios
 * seguidos. Los nombres de empresa se tipean a mano ("URBAN  FORCE"), así que se
 * limpian antes de mandar en vez de descubrirlo con un error.
 */
function param(v: string): string {
  return v.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim()
}

/** Código de error de Meta, venga como JSON del proxy de Kapso o como texto. */
function codigoMeta(raw: string): number | null {
  try {
    const j = JSON.parse(raw)
    const c = Number(j?.error?.code ?? j?.code)
    if (Number.isFinite(c) && c > 0) return c
  } catch {
    // no era JSON
  }
  const m = raw.match(/\b(13\d{4})\b/)
  return m ? Number(m[1]) : null
}

/** Traducidos a qué hacer, según la tabla oficial de códigos de error de Meta. */
function explicarError(code: number | null, raw: string, status: number): string {
  switch (code) {
    case 132001:
      return `La plantilla "${TEMPLATE}" no existe en el idioma "${TPL_LANG}" o todavía no está aprobada por Meta.`
    case 132000:
      return `La cantidad de variables no coincide con la plantilla "${TEMPLATE}" registrada en Meta.`
    case 132012:
      return `Los valores de las variables no tienen el formato que espera la plantilla "${TEMPLATE}".`
    case 132015:
      return `La plantilla "${TEMPLATE}" está pausada por baja calidad: hay que editarla en Meta.`
    case 132016:
      return `La plantilla "${TEMPLATE}" quedó deshabilitada por baja calidad: hay que crear una nueva.`
    case 131026:
      return 'Ese número no puede recibir el mensaje: no tiene WhatsApp o su app está desactualizada.'
    case 131042:
      return 'Hay un problema con el pago de los mensajes a Meta: revisa el saldo de créditos en Kapso.'
    default:
      return `Kapso ${status}: ${raw.slice(0, 300)}`
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    if (!KAPSO_API_KEY || !KAPSO_PHONE_NUMBER_ID) {
      return json({ error: 'WhatsApp no está configurado todavía (falta KAPSO_API_KEY o KAPSO_PHONE_NUMBER_ID)' }, 503)
    }
    if (!PUBLIC_APP_URL) {
      return json({ error: 'Falta PUBLIC_APP_URL: sin eso el link de la cotización sale roto' }, 503)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'No autenticado' }, 401)

    const { quote_id } = await req.json()
    if (!quote_id) return json({ error: 'Falta quote_id' }, 400)

    // Con el JWT del llamador: RLS decide si puede ver esta cotización.
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: quote, error: readError } = await asCaller
      .from('quotes')
      .select('id, number, status, total, currency, client_contact, client_company, client_phone_e164, public_token, lead_id')
      .eq('id', quote_id)
      .single()

    if (readError || !quote) return json({ error: 'Cotización no encontrada o sin acceso' }, 404)

    if (quote.status === 'borrador') {
      return json({ error: 'Envía la cotización primero: en borrador todavía se puede editar' }, 400)
    }
    if (!quote.client_phone_e164) {
      return json({ error: 'La cotización no tiene un teléfono válido para WhatsApp' }, 400)
    }

    const link = `${PUBLIC_APP_URL.replace(/\/+$/, '')}/p/${quote.public_token}`

    const res = await fetch(
      `https://api.kapso.ai/meta/whatsapp/${META_VERSION}/${KAPSO_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': KAPSO_API_KEY },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: quote.client_phone_e164,
          type: 'template',
          template: {
            name: TEMPLATE,
            language: { code: TPL_LANG },
            components: [{
              type: 'body',
              parameters: [
                { type: 'text', parameter_name: 'contacto', text: param(quote.client_contact || quote.client_company) },
                { type: 'text', parameter_name: 'numero',   text: param(quote.number) },
                { type: 'text', parameter_name: 'total',    text: param(money(quote.total, quote.currency)) },
                { type: 'text', parameter_name: 'link',     text: link },
              ],
            }],
          },
        }),
      },
    )

    if (!res.ok) {
      const raw = await res.text().catch(() => '')
      console.error('Kapso rechazó el envío:', raw)
      return json({ error: explicarError(codigoMeta(raw), raw, res.status) }, 502)
    }

    // El registro va con service role: quote_events no tiene policy de insert
    // a propósito, solo lo escribe el servidor.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    await admin.from('quote_events').insert({
      quote_id: quote.id,
      type: 'enviada',
      actor_id: null,
      meta: { channel: 'whatsapp', to: quote.client_phone_e164, template: TEMPLATE },
    })

    // Que también aparezca en el historial del lead: es donde el closer mira la
    // relación con el cliente, no en el detalle de la cotización.
    if (quote.lead_id) {
      await admin.from('lead_activities').insert({
        lead_id: quote.lead_id,
        author_id: null,
        type: 'whatsapp',
        body: `Cotización ${quote.number} enviada por WhatsApp (${money(quote.total, quote.currency)})`,
      })
    }

    return json({ ok: true, to: quote.client_phone_e164 })
  } catch (e) {
    console.error('whatsapp-send-quote:', e instanceof Error ? e.message : String(e))
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
