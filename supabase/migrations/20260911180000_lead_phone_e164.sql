-- =============================================
-- TELÉFONO NORMALIZADO EN LEADS  (paso 1 de la integración de WhatsApp)
--
-- Para cruzar un mensaje entrante de WhatsApp contra un lead hace falta el
-- número en un formato único. Hoy `contact_phone` es texto libre: los 11 leads
-- existentes están como "918 635 438" y uno con doble espacio.
--
-- En el repo de PeakGym ya conviven TRES dialectos de normalización
-- (whatsapp-send limpia el 0 inicial y el 051, lead-intake no, y
-- whatsapp-webhook matchea con `ilike %últimos9`). Este es el cuarto y el
-- último: se define UNA vez en la DB, como columna generada. No hay forma de
-- que la app y la base queden desalineadas porque la app no la escribe.
-- =============================================

create or replace function public.normalize_phone_pe(p_phone text)
returns text
language sql
immutable
set search_path = public
as $$
  with d as (
    -- Solo dígitos
    select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as v
  ),
  sin_prefijo as (
    select case
      -- 0051 999888777 / 051 999888777 → 51999888777
      when v like '00%'  then substring(v from 3)
      when v like '051%' then substring(v from 2)
      -- 0999888777 (0 de larga distancia nacional)
      when v like '0%' and length(v) = 10 then substring(v from 2)
      else v
    end as v
    from d
  )
  select case
    -- Celular peruano suelto: 9 dígitos empezando en 9
    when length(v) = 9  and v like '9%'  then '51' || v
    -- Ya viene con código de país
    when length(v) = 11 and v like '519%' then v
    -- Otro internacional razonable se deja como está. Un 0 acá significa que
    -- el prefijo no se pudo interpretar (ej. "(01) 918 635 438", que mezcla
    -- código de Lima con celular): mejor null que un número equivocado, porque
    -- un número equivocado matchea el lead ajeno o le escribe a un desconocido.
    when length(v) between 10 and 15 and v not like '0%' then v
    else null
  end
  from sin_prefijo;
$$;

comment on function public.normalize_phone_pe(text) is
  'E.164 sin +. Única fuente de verdad para normalizar teléfonos; ver migración 20260911180000.';

-- Columna generada: imposible que se desincronice de contact_phone, porque la
-- app no la escribe nunca.
--
-- OJO si algún día cambias normalize_phone_pe: los valores ya guardados NO se
-- recalculan solos (una columna STORED se computa al escribir). Toca forzar
-- la reescritura de las filas afectadas y verificar con:
--   select count(*) from leads
--   where phone_e164 is distinct from normalize_phone_pe(contact_phone);
alter table leads add column phone_e164 text
  generated always as (public.normalize_phone_pe(contact_phone)) stored;

-- Índice NO único a propósito: la misma persona puede tener dos negocios y por
-- lo tanto dos leads con el mismo celular. Un unique acá bloquearía un caso
-- legítimo. La desambiguación es del lado del webhook: se toma el lead más
-- reciente que coincida.
create index leads_phone_e164_idx on leads(phone_e164) where phone_e164 is not null;

-- Las conversaciones de WhatsApp se registran en lead_activities como un tipo
-- más, junto a llamada/reunion/email/nota. No hace falta tabla nueva: el
-- timeline del lead ya es el lugar donde se mira la relación con el cliente.
-- (Se aplicó en una migración aparte: ALTER TYPE ... ADD VALUE no puede
-- ejecutarse en la misma transacción donde se usa el valor nuevo.)
alter type activity_type add value if not exists 'whatsapp';
