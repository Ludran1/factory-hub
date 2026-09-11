// Tipo de cambio USD→PEN desde el BCRP, cacheado en fx_rates.
//
// Por qué no va directo desde el browser:
//   1. No hay garantía de CORS desde estadisticas.bcrp.gob.pe.
//   2. Cada closer que abre el editor pegaría al BCRP; con caché es una
//      llamada al día para todo el equipo.
//
// Detalle del BCRP: NO publica el valor del día en curso. Consultando un
// martes, el martes vuelve como "n.d." y el último real es el lunes. Por eso
// se piden varios días hacia atrás y se descartan los "n.d.".
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// TC Sistema bancario SBS (S/ por US$) - Venta
const BCRP_SERIES = 'PD04640PD'
const DAYS_BACK = 12

interface BcrpResponse {
  periods?: { name: string; values: string[] }[]
}

const MONTHS: Record<string, string> = {
  Ene: '01', Feb: '02', Mar: '03', Abr: '04', May: '05', Jun: '06',
  Jul: '07', Ago: '08', Set: '09', Sep: '09', Oct: '10', Nov: '11', Dic: '12',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** El BCRP devuelve "09.Sep.26"; lo pasamos a "2026-09-09". */
function parseBcrpDate(name: string): string | null {
  const parts = name.split('.')
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  const mm = MONTHS[month]
  if (!mm) return null
  return `20${year.padStart(2, '0')}-${mm}-${day.padStart(2, '0')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const today = isoDate(new Date())

  try {
    // 1. ¿Ya está cacheado hoy? Entonces ni tocamos al BCRP.
    const { data: cached } = await admin
      .from('fx_rates')
      .select('date, usd_pen, source')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached && cached.date === today) {
      return json({ date: cached.date, usd_pen: Number(cached.usd_pen), source: cached.source, stale: false })
    }

    // 2. Traer la ventana reciente del BCRP.
    const from = new Date()
    from.setDate(from.getDate() - DAYS_BACK)
    const url = `https://estadisticas.bcrp.gob.pe/estadisticas/series/api/${BCRP_SERIES}/json/${isoDate(from)}/${today}/ing`

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`BCRP respondió ${res.status}`)

    const body = (await res.json()) as BcrpResponse
    const rows = (body.periods ?? [])
      .map((p) => ({ date: parseBcrpDate(p.name), raw: p.values?.[0] }))
      .filter((r): r is { date: string; raw: string } => !!r.date && !!r.raw && r.raw !== 'n.d.')
      .map((r) => ({ date: r.date, usd_pen: Number(r.raw), source: `BCRP ${BCRP_SERIES}` }))
      .filter((r) => Number.isFinite(r.usd_pen) && r.usd_pen > 0)

    if (rows.length === 0) throw new Error('El BCRP no devolvió ningún valor publicado')

    await admin.from('fx_rates').upsert(rows, { onConflict: 'date' })

    const latest = rows.reduce((a, b) => (a.date > b.date ? a : b))
    return json({ ...latest, stale: latest.date !== today })
  } catch (e) {
    // Fallo blando: con el último valor cacheado se puede seguir cotizando.
    // Solo si nunca hubo un fetch exitoso devolvemos error.
    const { data: fallback } = await admin
      .from('fx_rates')
      .select('date, usd_pen, source')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fallback) {
      return json({
        date: fallback.date,
        usd_pen: Number(fallback.usd_pen),
        source: fallback.source,
        stale: true,
        warning: e instanceof Error ? e.message : String(e),
      })
    }

    return json({ error: e instanceof Error ? e.message : String(e) }, 502)
  }
})
