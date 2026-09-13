-- =============================================
-- BANDEJA DE WHATSAPP INCRUSTADA (pestaña Chat de Marketing/CRM)
--
-- Kapso devuelve el embed_url de su inbox UNA sola vez, y ese URL lleva un token
-- que da acceso a todas las conversaciones con datos de clientes. No puede vivir
-- en el código del navegador ni en una tabla legible por la app.
--
-- Tabla sin policies: con RLS activo y ninguna policy, nadie la lee por la API.
-- Solo la Edge Function kapso-inbox-embed, con service role, después de validar
-- que quien pide la bandeja trabaja leads. Mismo patrón que PeakGym.
-- =============================================

create table kapso_inbox_embeds (
  phone_number_id text primary key,
  kapso_embed_id text,
  embed_url text not null,
  allowed_origins text[] not null,
  created_at timestamptz default now()
);

alter table kapso_inbox_embeds enable row level security;
-- Sin policies a propósito.
