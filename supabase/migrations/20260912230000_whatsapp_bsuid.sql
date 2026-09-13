-- =============================================
-- IDENTIDAD DE WHATSAPP SIN TELÉFONO (BSUID)
--
-- Meta está migrando a business-scoped user IDs. Cuando un usuario activa un
-- nombre de usuario en WhatsApp, el webhook puede llegar con
-- conversation.phone_number en null (u omitido) y solo el BSUID. La doc de
-- Kapso es explícita: no descartar el mensaje por falta de teléfono, y cruzar
-- por BSUID primero y por teléfono después.
--
-- Antes de esto handle_whatsapp_inbound exigía teléfono y ese lead se perdía
-- sin aviso — justo el perfil de usuario que llega desde TikTok.
-- =============================================

alter table leads add column whatsapp_bsuid text;
alter table leads add column whatsapp_username text;

comment on column leads.whatsapp_bsuid is
  'business_scoped_user_id de WhatsApp. Identidad primaria para cruzar mensajes entrantes; puede existir sin teléfono.';
comment on column leads.whatsapp_username is
  'Nombre de usuario de WhatsApp. Solo para mostrar: puede cambiar y no sirve para identificar.';

create index leads_whatsapp_bsuid_idx on leads(whatsapp_bsuid) where whatsapp_bsuid is not null;

-- La firma cambia. Se borra la versión anterior en vez de dejar un overload:
-- con dos versiones que tienen parámetros con default, PostgREST no puede
-- elegir cuál llamar y la RPC falla.
drop function if exists public.handle_whatsapp_inbound(text, text, text, text, text, text);

create or replace function public.handle_whatsapp_inbound(
  p_phone text,
  p_contact_name text,
  p_text text,
  p_wamid text,
  p_conversation_id text default null,
  p_product text default 'PeakGym',
  p_bsuid text default null,
  p_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e164 text;
  v_bsuid text;
  v_username text;
  v_lead_id uuid;
  v_created boolean := false;
  v_nombre text;
  v_body text;
begin
  v_e164     := normalize_phone_pe(p_phone);
  v_bsuid    := nullif(btrim(coalesce(p_bsuid, '')), '');
  v_username := nullif(btrim(coalesce(p_username, '')), '');

  if v_e164 is null and v_bsuid is null then
    return jsonb_build_object('ok', false, 'error', 'Sin teléfono interpretable ni BSUID', 'phone', p_phone);
  end if;

  v_nombre := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_body   := nullif(btrim(coalesce(p_text, '')), '');

  -- Orden que recomienda la doc de Kapso: BSUID primero, teléfono después.
  if v_bsuid is not null then
    select id into v_lead_id
    from leads
    where whatsapp_bsuid = v_bsuid
    order by created_at desc
    limit 1;
  end if;

  if v_lead_id is null and v_e164 is not null then
    select id into v_lead_id
    from leads
    where phone_e164 = v_e164
    order by created_at desc
    limit 1;
  end if;

  if v_lead_id is null then
    insert into leads (
      company, contact_name, contact_phone, whatsapp_bsuid, whatsapp_username,
      product, source, stage, notes
    )
    values (
      coalesce(v_nombre, v_username, 'WhatsApp +' || v_e164, 'WhatsApp ' || v_bsuid),
      coalesce(v_nombre, v_username, 'Sin nombre'),
      v_e164,
      v_bsuid,
      v_username,
      p_product,
      'redes_sociales',
      'prospecto',
      'Lead creado automáticamente desde WhatsApp el '
        || to_char(now() at time zone 'America/Lima', 'DD/MM/YYYY HH24:MI') || '.'
        || case when v_e164 is null
             then ' Llegó sin teléfono (el usuario tiene nombre de usuario en WhatsApp): pídeselo antes de enviarle una cotización.'
             else ''
           end
    )
    returning id into v_lead_id;
    v_created := true;
  else
    -- Completar la identidad solo donde falta. Si el mismo payload trae los dos
    -- datos, la relación entre ellos está establecida; pero nunca se pisa un
    -- BSUID o un teléfono que ya existe con otro valor.
    update leads set
      whatsapp_bsuid    = coalesce(whatsapp_bsuid, v_bsuid),
      contact_phone     = coalesce(nullif(btrim(contact_phone), ''), v_e164),
      -- El nombre de usuario puede cambiar con el tiempo: se guarda el último.
      whatsapp_username = coalesce(v_username, whatsapp_username)
    where id = v_lead_id
      and (
           (whatsapp_bsuid is null and v_bsuid is not null)
        or (nullif(btrim(contact_phone), '') is null and v_e164 is not null)
        or (v_username is not null and whatsapp_username is distinct from v_username)
      );
  end if;

  -- on conflict do nothing: el reintento del webhook no duplica el historial.
  insert into lead_activities (lead_id, author_id, type, body, external_id)
  values (v_lead_id, null, 'whatsapp', coalesce(v_body, '(mensaje sin texto)'), p_wamid)
  on conflict (external_id) where external_id is not null do nothing;

  -- Avisar solo del lead nuevo, a quienes trabajan leads según el mismo
  -- criterio que useClosers() en la app.
  if v_created then
    insert into notifications (user_id, type, message, link)
    select p.id, 'whatsapp_lead',
           'Nuevo lead por WhatsApp: ' || coalesce(v_nombre, v_username, '+' || v_e164, 'usuario sin teléfono'),
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
    'bsuid', v_bsuid,
    'conversation_id', p_conversation_id
  );
end;
$$;

-- Solo la llama la Edge Function con service role.
revoke execute on function public.handle_whatsapp_inbound(text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
