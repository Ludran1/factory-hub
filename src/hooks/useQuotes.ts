import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Currency, QuoteItem, QuoteStatus, QuoteUpdate } from '@/types/database'

const QUOTE_SELECT = '*, owner:profiles!quotes_owner_id_fkey(id, name, avatar_url)'

export function useQuotes(filters?: { status?: string; search?: string; ownerId?: string }) {
  return useQuery({
    queryKey: ['quotes', filters],
    queryFn: async () => {
      let query = supabase
        .from('quotes')
        .select(QUOTE_SELECT)
        .order('created_at', { ascending: false })

      if (filters?.status && filters.status !== 'all')
        query = query.eq('status', filters.status as QuoteStatus)
      if (filters?.ownerId)
        query = query.eq('owner_id', filters.ownerId)
      if (filters?.search)
        query = query.or(`client_company.ilike.%${filters.search}%,number.ilike.%${filters.search}%,title.ilike.%${filters.search}%`)

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useQuotesByLead(leadId: string | null) {
  return useQuery({
    queryKey: ['quotes', 'lead', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useQuote(id: string | null) {
  return useQuery({
    queryKey: ['quote', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          ${QUOTE_SELECT},
          quote_items(*),
          quote_events(*, actor:profiles(id, name, avatar_url))
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })
}

interface LeadSnapshot {
  id: string
  company: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  owner_id: string | null
  product?: string | null
}

/**
 * Los datos del cliente se copian del lead a la cotización a propósito: el
 * documento no puede cambiar retroactivamente si luego se corrige el lead.
 */
export function useCreateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ lead, title, currency, fxRate }: {
      lead: LeadSnapshot
      title?: string
      currency?: Currency
      fxRate?: number
    }) => {
      const { data, error } = await supabase
        .from('quotes')
        .insert({
          lead_id: lead.id,
          client_company: lead.company,
          client_contact: lead.contact_name,
          client_email: lead.contact_email,
          client_phone: lead.contact_phone,
          client_doc: null,
          client_address: null,
          title: title || `Propuesta ${lead.product ?? ''}`.trim(),
          owner_id: lead.owner_id,
          currency: currency ?? 'PEN',
          fx_rate: fxRate ?? 1,
          valid_until: null,
          terms: null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (quote) => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['quotes', 'lead', quote.lead_id] })
    },
  })
}

export function useUpdateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & QuoteUpdate) => {
      const { data, error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['quote', vars.id] })
    },
  })
}

export function useDeleteQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })
}

/** Enviar congela el documento: de acá en adelante la DB rechaza cambios. */
export function useSendQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('quotes')
        .update({ status: 'enviada', sent_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['quote', id] })
    },
  })
}

/** Nueva versión de una enviada: la original queda intacta. */
export function useDuplicateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data: source, error: readError } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', sourceId)
        .single()
      if (readError) throw readError

      const items = (source.quote_items ?? []) as QuoteItem[]

      const { data: copy, error: insertError } = await supabase
        .from('quotes')
        .insert({
          lead_id: source.lead_id,
          parent_quote_id: source.id,
          version: source.version + 1,
          client_company: source.client_company,
          client_contact: source.client_contact,
          client_email: source.client_email,
          client_phone: source.client_phone,
          client_doc: source.client_doc,
          client_address: source.client_address,
          title: source.title,
          currency: source.currency,
          fx_rate: source.fx_rate,
          igv_rate: source.igv_rate,
          valid_until: source.valid_until,
          terms: source.terms,
          owner_id: source.owner_id,
        })
        .select()
        .single()
      if (insertError) throw insertError

      if (items.length > 0) {
        const { error: itemsError } = await supabase.from('quote_items').insert(
          items.map(i => ({
            quote_id: copy.id,
            description: i.description,
            detail: i.detail,
            qty: i.qty,
            unit_price: i.unit_price,
            discount: i.discount,
            position: i.position,
          })),
        )
        if (itemsError) throw itemsError
      }

      return copy
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })
}

// ---------- Líneas ----------

export function useAddQuoteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ quote_id, position }: { quote_id: string; position: number }) => {
      const { data, error } = await supabase
        .from('quote_items')
        .insert({ quote_id, description: '', detail: null, qty: 1, unit_price: 0, discount: 0, position })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['quote', vars.quote_id] }),
  })
}

export function useUpdateQuoteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, quote_id, ...updates }: { id: string; quote_id: string } & Partial<QuoteItem>) => {
      const { error } = await supabase.from('quote_items').update(updates).eq('id', id)
      if (error) throw error
      return quote_id
    },
    onSuccess: (quote_id) => qc.invalidateQueries({ queryKey: ['quote', quote_id] }),
  })
}

export function useDeleteQuoteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, quote_id }: { id: string; quote_id: string }) => {
      const { error } = await supabase.from('quote_items').delete().eq('id', id)
      if (error) throw error
      return quote_id
    },
    onSuccess: (quote_id) => qc.invalidateQueries({ queryKey: ['quote', quote_id] }),
  })
}

/**
 * Manda la cotización por WhatsApp como plantilla aprobada. Texto libre no
 * sirve: fuera de la ventana de 24h Meta solo entrega plantillas.
 */
export function useSendQuoteWhatsApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string; to?: string }>(
        'whatsapp-send-quote',
        { body: { quote_id: quoteId } },
      )
      // La función devuelve el motivo real en el body incluso con status de
      // error; el mensaje genérico de FunctionsHttpError no ayuda a nadie.
      if (error) {
        const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(detalle?.error ?? error.message)
      }
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: (_, quoteId) => {
      qc.invalidateQueries({ queryKey: ['quote', quoteId] })
      qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useReorderQuoteItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ quote_id, ids }: { quote_id: string; ids: string[] }) => {
      // Una llamada por línea: son 3–10 filas, no vale la pena un RPC.
      await Promise.all(
        ids.map((id, index) =>
          supabase.from('quote_items').update({ position: index }).eq('id', id),
        ),
      )
      return quote_id
    },
    onSuccess: (quote_id) => qc.invalidateQueries({ queryKey: ['quote', quote_id] }),
  })
}
