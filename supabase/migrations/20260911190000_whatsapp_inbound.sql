-- =============================================
-- WHATSAPP ENTRANTE  (paso 2)
--
-- El find-or-create vive en la DB, no en la Edge Function, por tres razones:
--   1. Una sola normalización de teléfono (normalize_phone_pe), no un cuarto dialecto.
--   2. Atomicidad: dos mensajes seguidos del mismo número no pueden crear dos leads.
--   3. Idempotencia: Kapso reintenta los webhooks, y el wamid deduplica.
-- La Edge Function queda para lo suyo: verificar la firma y parsear el payload.
-- =============================================

-- Una actividad puede venir del cliente, que no tiene profile.
-- Mismo criterio que quote_events.actor_id: null = no fue un miembro del equipo.
alter table lead_activities alter column author_id drop not null;

comment on column lead_activities.author_id is
  'null = lo registró el cliente o una automatización, no un miembro del equipo.';

-- Idempotencia de webhooks. Kapso reintenta ante timeout o 5xx; sin esto el
-- mismo mensaje entra dos veces al timeline.
alter table lead_activities add column external_id text;
create unique index lead_activities_external_id_idx
  on lead_activities(external_id) where external_id is not null;

create or replace function public.handle_whatsapp_inbound(
  p_phone text,
  p_contact_name text,
  p_text text,
  p_wamid text,
  p_conversation_id text default null,
  p_product text default 'PeakGym'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e164 text;
  v_lead_id uuid;
  v_created boolean := false;
  v_nombre text;
  v_body text;
begin
  v_e164 := normalize_phone_pe(p_phone);
  if v_e164 is null then
    -- Mejor descartar que adivinar: un número mal normalizado escribe en el
    -- lead de otra persona.
    return jsonb_build_object('ok', false, 'error', 'Teléfono no interpretable', 'phone', p_phone);
  end if;

  v_nombre := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_body   := nullif(btrim(coalesce(p_text, '')), '');

  -- Lead más reciente con ese número. El índice no es único a propósito: la
  -- misma persona puede tener dos negocios.
  select id into v_lead_id
  from leads
  where phone_e164 = v_e164
  order by created_at desc
  limit 1;

  if v_lead_id is null then
    insert into leads (company, contact_name, contact_phone, product, source, stage, notes)
    values (
      coalesce(v_nombre, 'WhatsApp +' || v_e164),
      coalesce(v_nombre, 'Sin nombre'),
      v_e164,
      p_product,
      'redes_sociales',
      'prospecto',
      'Lead creado automáticamente desde WhatsApp el ' || to_char(now() at time zone 'America/Lima', 'DD/MM/YYYY HH24:MI') || '.'
    )
    returning id into v_lead_id;
    v_created := true;
  end if;

  -- on conflict do nothing: el reintento del webhook no duplica el timeline.
  insert into lead_activities (lead_id, author_id, type, body, external_id)
  values (
    v_lead_id,
    null,
    'whatsapp',
    coalesce(v_body, '(mensaje sin texto)'),
    p_wamid
  )
  on conflict (external_id) where external_id is not null do nothing;

  -- Avisar solo del lead nuevo. Notificar cada mensaje convertiría la campanita
  -- en ruido y dejaría de mirarse.
  --
  -- El criterio de "quién trabaja leads" es el mismo que usa useClosers() en la
  -- app: rol comercial o acceso explícito al módulo marketing. Si acá fuera
  -- distinto, habría gente que ve el lead en el CRM pero nunca se entera de que
  -- entró.
  if v_created then
    insert into notifications (user_id, type, message, link)
    select p.id, 'whatsapp_lead',
           'Nuevo lead por WhatsApp: ' || coalesce(v_nombre, '+' || v_e164),
           '/marketing'
    from profiles p
    where p.role in ('admin', 'closer', 'marketing')
       or (p.allowed_modules is not null and 'marketing' = any(p.allowed_modules));
  end if;

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'created', v_created,
    'phone_e164', v_e164,
    'conversation_id', p_conversation_id
  );
end;
$$;

-- Solo la llama la Edge Function con service role. Nadie más.
revoke execute on function public.handle_whatsapp_inbound(text, text, text, text, text, text)
  from public, anon, authenticated;
