// kapso-inbox-embed — la bandeja de WhatsApp de Kapso, incrustada en Marketing/CRM.
//
// Devuelve el embed_url del inbox de Kapso limitado al número de ventas. Ese URL
// lleva un token que da acceso a todas las conversaciones con datos de clientes:
// por eso no va en el código del navegador. Se guarda en una tabla sin policies
// (solo la lee el service role) y se entrega solo a quien trabaja leads.
//
// Mismo patrón que kapso-inbox-embed de PeakGym, sin multi-tenancy.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// trim(): un espacio o salto de línea pegado en el dashboard de Supabase hace que
// Kapso no encuentre el número y el error no dice por qué.
const KAPSO_API_KEY = Deno.env.get('KAPSO_API_KEY')?.trim()
const KAPSO_PHONE_NUMBER_ID = Deno.env.get('KAPSO_PHONE_NUMBER_ID')?.trim()
const PUBLIC_APP_URL = Deno.env.get('PUBLIC_APP_URL')?.trim()
const KAPSO_PLATFORM_API = 'https://api.kapso.ai/platform/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** Sitios que pueden mostrar la bandeja en un iframe: producción y el dev server de
 *  Vite. Sin comodines, a propósito. */
function origenesPermitidos(): string[] {
  const origenes = new Set<string>(['http://localhost:5173'])
  if (PUBLIC_APP_URL) origenes.add(new URL(PUBLIC_APP_URL).origin)
  return [...origenes]
}

/**
 * Qué números de WhatsApp puede ver la API key configurada. Solo se usa para
 * explicar un 404: "Phone number not found" casi siempre significa que la key es
 * de otro proyecto de Kapso (el de los gimnasios, por ejemplo) y no del que tiene
 * el número de ventas. Devuelve ids y números visibles, nada secreto.
 */
async function numerosVisiblesPorLaKey(): Promise<{ id: string; numero: string }[] | null> {
  try {
    const res = await fetch(`${KAPSO_PLATFORM_API}/whatsapp/phone_numbers?per_page=50`, {
      headers: { 'X-API-Key': KAPSO_API_KEY! },
    })
    if (!res.ok) return null
    const body = await res.json() as { data?: { phone_number_id?: string; display_phone_number?: string | null; name?: string | null }[] }
    return (body.data ?? []).map(n => ({
      id: String(n.phone_number_id ?? ''),
      numero: n.display_phone_number || n.name || 'sin número visible',
    }))
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    if (!KAPSO_API_KEY || !KAPSO_PHONE_NUMBER_ID) {
      return json({ error: 'WhatsApp no está configurado (falta KAPSO_API_KEY o KAPSO_PHONE_NUMBER_ID)' }, 503)
    }

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'No autenticado' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    const { data: usuario, error: authError } = await admin.auth.getUser(token)
    if (authError || !usuario?.user) return json({ error: 'No autenticado' }, 401)

    const { data: perfil } = await admin
      .from('profiles')
      .select('role, allowed_modules')
      .eq('user_id', usuario.user.id)
      .maybeSingle()

    // Mismo criterio que useClosers() y que las notificaciones de leads de WhatsApp.
    // La función corre con service role: esta validación es la única barrera.
    const puede = !!perfil && (
      ['admin', 'closer', 'marketing'].includes(perfil.role) ||
      (Array.isArray(perfil.allowed_modules) && perfil.allowed_modules.includes('marketing'))
    )
    if (!puede) return json({ error: 'Tu usuario no tiene acceso a Marketing' }, 403)

    // Rastro de quién abrió la bandeja: expone datos de clientes.
    console.log(JSON.stringify({ fn: 'kapso-inbox-embed', action: 'embed_requested', user_id: usuario.user.id }))

    const { data: existente } = await admin
      .from('kapso_inbox_embeds')
      .select('embed_url')
      .eq('phone_number_id', KAPSO_PHONE_NUMBER_ID)
      .maybeSingle()
    if (existente?.embed_url) return json({ embed_url: existente.embed_url })

    const origenes = origenesPermitidos()
    const res = await fetch(`${KAPSO_PLATFORM_API}/inbox_embeds`, {
      method: 'POST',
      headers: { 'X-API-Key': KAPSO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inbox_embed: {
          name: 'Factory Hub - ventas',
          scope_type: 'phone_number',
          scope_id: KAPSO_PHONE_NUMBER_ID,
          allowed_origins: origenes,
          default_mode: 'system',
          language: 'es',
        },
      }),
    })
    const raw = await res.text()
    let body: { data?: { id?: string; embed_url?: string } } = {}
    try { body = raw ? JSON.parse(raw) : {} } catch { /* no era JSON */ }
    const embedUrl = body?.data?.embed_url
    const embedId = body?.data?.id

    if (res.status === 404) {
      const visibles = await numerosVisiblesPorLaKey()
      const loVe = visibles?.some(n => n.id === KAPSO_PHONE_NUMBER_ID)
      console.error('Kapso 404 al crear la bandeja', JSON.stringify({ configurado: KAPSO_PHONE_NUMBER_ID, visibles }))
      if (visibles && !loVe) {
        const lista = visibles.length
          ? visibles.map(n => `${n.numero} (${n.id})`).join(', ')
          : 'ningún número'
        return json({
          error: `La KAPSO_API_KEY es de un proyecto de Kapso que no tiene el número ${KAPSO_PHONE_NUMBER_ID}. ` +
            `Esa key ve: ${lista}. Crea una API key en el proyecto Peakgym (Integrations → API keys) ` +
            'y reemplaza KAPSO_API_KEY en Supabase.',
        }, 502)
      }
    }

    if (!res.ok || !embedUrl) {
      console.error('Kapso no creó la bandeja:', res.status, raw.slice(0, 500))
      return json({ error: `Kapso no pudo crear la bandeja (${res.status}): ${raw.slice(0, 200)}` }, 502)
    }

    // Kapso devuelve el embed_url una sola vez: si no se guarda, se pierde.
    const { error: saveError } = await admin.from('kapso_inbox_embeds').insert({
      phone_number_id: KAPSO_PHONE_NUMBER_ID,
      kapso_embed_id: embedId ?? null,
      embed_url: embedUrl,
      allowed_origins: origenes,
    })

    if (saveError) {
      // Lo más probable es una carrera: otro usuario abrió el chat al mismo tiempo
      // y ya guardó su bandeja. Se usa esa y se borra la recién creada, para no
      // dejar tokens con acceso a los clientes sueltos en Kapso.
      if (embedId) {
        await fetch(`${KAPSO_PLATFORM_API}/inbox_embeds/${embedId}`, {
          method: 'DELETE',
          headers: { 'X-API-Key': KAPSO_API_KEY },
        }).catch(() => {})
      }
      const { data: ganadora } = await admin
        .from('kapso_inbox_embeds')
        .select('embed_url')
        .eq('phone_number_id', KAPSO_PHONE_NUMBER_ID)
        .maybeSingle()
      if (ganadora?.embed_url) return json({ embed_url: ganadora.embed_url })
      console.error('No se pudo guardar la bandeja:', saveError.message)
      return json({ error: 'No se pudo guardar la bandeja' }, 500)
    }

    return json({ embed_url: embedUrl })
  } catch (e) {
    console.error('kapso-inbox-embed:', e instanceof Error ? e.message : String(e))
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
