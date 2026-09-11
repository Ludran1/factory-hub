import type { Currency, Quote, QuoteStatus } from '@/types/database'

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  PEN: 'S/',
  USD: '$',
}

/**
 * Importe con su símbolo. El pipeline se suma en `value_pen`/`total_pen`;
 * acá solo se muestra cada documento en su propia moneda.
 */
export function formatMoney(amount: number, currency: Currency = 'PEN') {
  // Number() explícito: las columnas numeric pueden llegar como string según
  // cómo serialice PostgREST, y un `"1440".toLocaleString()` revienta.
  const n = Number(amount) || 0
  return `${CURRENCY_SYMBOL[currency]} ${n.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** Versión compacta para tarjetas de métricas: S/ 12.4k */
export function formatMoneyShort(amount: number, currency: Currency = 'PEN') {
  const symbol = CURRENCY_SYMBOL[currency]
  const n = Number(amount) || 0
  if (Math.abs(n) >= 1000) {
    return `${symbol} ${(n / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 })}k`
  }
  return `${symbol} ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
}

/**
 * `vencida` no se guarda en la DB: se calcula al leer. Un cron solo para
 * mover estados sería infraestructura para nada.
 */
export function effectiveStatus(quote: Pick<Quote, 'status' | 'valid_until'>): QuoteStatus {
  if (quote.status === 'enviada' && quote.valid_until && quote.valid_until < todayISO()) {
    return 'vencida'
  }
  return quote.status
}

export function todayISO() {
  const d = new Date()
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10)
}

export const QUOTE_STATUS_CONFIG: Record<QuoteStatus, { label: string; class: string }> = {
  borrador:  { label: 'Borrador',  class: 'bg-slate-500/10 text-slate-500 border-slate-500/30' },
  enviada:   { label: 'Enviada',   class: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  aceptada:  { label: 'Aceptada',  class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
  rechazada: { label: 'Rechazada', class: 'bg-red-500/10 text-red-500 border-red-500/30' },
  vencida:   { label: 'Vencida',   class: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
}

/** Totales en vivo mientras se edita. La DB recalcula igual al guardar. */
export function computeTotals(
  items: { qty: number; unit_price: number; discount: number }[],
  igvRate = 0,
  fxRate = 1,
) {
  const round2 = (n: number) => Math.round(n * 100) / 100
  // Number() en cada campo: sin esto un `s + i.discount` con strings concatena
  // en vez de sumar y el total sale absurdo.
  const subtotal = round2(items.reduce((s, i) => s + round2(Number(i.qty) * Number(i.unit_price)), 0))
  const discount = round2(items.reduce((s, i) => s + Number(i.discount), 0))
  const igv = round2(((subtotal - discount) * Number(igvRate)) / 100)
  const total = round2(subtotal - discount + igv)
  return { subtotal, discount, igv, total, total_pen: round2(total * Number(fxRate)) }
}

export function publicQuoteUrl(token: string) {
  return `${window.location.origin}/p/${token}`
}

/** ~100 KB en base64. El logo viaja en cada carga del documento. */
export const MAX_LOGO_BYTES = 100_000
const LOGO_MAX_WIDTH = 400

/**
 * Redimensiona el logo antes de guardarlo como data URI. El proyecto no usa
 * Storage (las imágenes de tareas y pizarras también van en base64), así que
 * el tamaño se controla acá y no con un bucket.
 */
export async function resizeLogo(file: File): Promise<string> {
  const dataURL = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen'))
    img.src = dataURL
  })

  if (img.width <= LOGO_MAX_WIDTH && dataURL.length <= MAX_LOGO_BYTES) return dataURL

  const scale = Math.min(1, LOGO_MAX_WIDTH / img.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataURL
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  // png preserva transparencia, que es lo normal en un logo
  const out = canvas.toDataURL('image/png')
  return out.length < dataURL.length ? out : dataURL
}
