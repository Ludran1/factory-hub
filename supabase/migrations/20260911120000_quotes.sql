-- =============================================
-- COTIZACIONES / PROPUESTAS  (docs/prd-cotizaciones.md — F1)
--
-- Principio, igual que en prd-hardening: la app es 100% browser con anon key,
-- así que RLS y triggers son la única capa real. Nada económico se calcula
-- ni se asigna desde el cliente:
--   · el correlativo lo pone un trigger
--   · los totales los calcula un trigger desde las líneas
--   · una cotización enviada es inmutable a nivel de DB
--   · el acceso público NO usa policies anon, va por funciones security definer
-- =============================================

create type quote_status     as enum ('borrador','enviada','aceptada','rechazada','vencida');
create type quote_event_type as enum ('creada','enviada','vista','aceptada','rechazada','revisada');

-- =============================================
-- DATOS DEL EMISOR (fila única)
-- =============================================
create table org_settings (
  id boolean primary key default true check (id),   -- el check fuerza una sola fila
  legal_name text not null default '',
  ruc text not null default '',
  address text,
  email text,
  phone text,
  website text,
  logo_base64 text,                                 -- data URI; el proyecto no usa Storage
  default_terms text,
  updated_at timestamptz default now()
);

insert into org_settings (id, legal_name) values (true, 'iurAgency') on conflict do nothing;

alter table org_settings enable row level security;

-- Cualquier autenticado necesita leerla: el documento lleva la cabecera del emisor.
create policy "Authenticated can view org settings" on org_settings
  for select using (auth.uid() is not null);

create policy "Admins can update org settings" on org_settings
  for update using (
    exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
  );
-- Sin policies de insert/delete: la fila nace acá y el check(id) impide una segunda.

-- =============================================
-- CACHÉ DE TIPO DE CAMBIO
-- La escribe solo la Edge Function fx-rate con service role.
-- =============================================
create table fx_rates (
  date date primary key,
  usd_pen numeric not null,
  source text not null default 'BCRP PD04640PD',
  fetched_at timestamptz not null default now()
);

alter table fx_rates enable row level security;

create policy "Authenticated can view fx rates" on fx_rates
  for select using (auth.uid() is not null);
-- Sin policies de escritura a propósito.

-- =============================================
-- COTIZACIONES
-- =============================================
create sequence quote_number_seq;

create table quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  number text unique not null,
  version int not null default 1,
  parent_quote_id uuid references quotes(id) on delete set null,

  -- Snapshot del cliente al emitir. No es un join vivo a leads a propósito:
  -- el documento no puede cambiar retroactivamente.
  client_company text not null,
  client_contact text,
  client_email text,
  client_doc text,
  client_address text,

  title text not null,
  currency text not null default 'PEN' check (currency in ('PEN','USD')),
  fx_rate numeric not null default 1 check (fx_rate > 0),
  issue_date date not null default current_date,
  valid_until date,
  status quote_status not null default 'borrador',

  igv_rate numeric not null default 0 check (igv_rate >= 0),
  subtotal  numeric not null default 0,
  discount  numeric not null default 0,
  igv       numeric not null default 0,
  total     numeric not null default 0,
  total_pen numeric not null default 0,

  terms text,
  owner_id uuid references profiles(id) on delete set null,
  public_token uuid not null unique default gen_random_uuid(),
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index quotes_lead_id_idx on quotes(lead_id);
create index quotes_status_idx on quotes(status);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete cascade not null,
  description text not null,
  detail text,
  qty numeric not null default 1 check (qty > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  discount numeric not null default 0 check (discount >= 0),
  position int not null default 0
);

create index quote_items_quote_id_idx on quote_items(quote_id, position);

create table quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete cascade not null,
  type quote_event_type not null,
  actor_id uuid references profiles(id) on delete set null,  -- null = el cliente desde el link
  meta jsonb,
  created_at timestamptz default now()
);

create index quote_events_quote_id_idx on quote_events(quote_id, created_at desc);

-- =============================================
-- CORRELATIVO
-- El cliente nunca elige el número: el trigger lo pisa siempre.
-- =============================================
create or replace function public.assign_quote_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.number := 'COT-'
    || to_char(coalesce(new.issue_date, current_date), 'YYYY')
    || '-'
    || lpad(nextval('quote_number_seq')::text, 4, '0');
  return new;
end;
$$;

revoke execute on function public.assign_quote_number() from public, anon, authenticated;

create trigger trg_assign_quote_number
  before insert on quotes
  for each row execute function public.assign_quote_number();

-- =============================================
-- TOTALES
-- Fuente de verdad. Lo que mande el cliente en subtotal/total se pisa.
-- =============================================
create or replace function public.recalc_quote_totals(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub numeric; v_disc numeric; v_rate numeric; v_fx numeric;
  v_igv numeric; v_total numeric; v_found boolean;
begin
  select true, igv_rate, fx_rate into v_found, v_rate, v_fx
  from quotes where id = p_quote_id;
  if not coalesce(v_found, false) then return; end if;

  select coalesce(sum(round(qty * unit_price, 2)), 0), coalesce(sum(discount), 0)
    into v_sub, v_disc
  from quote_items where quote_id = p_quote_id;

  v_igv   := round((v_sub - v_disc) * v_rate / 100, 2);
  v_total := round(v_sub - v_disc + v_igv, 2);

  update quotes set
    subtotal  = v_sub,
    discount  = v_disc,
    igv       = v_igv,
    total     = v_total,
    total_pen = round(v_total * v_fx, 2),
    updated_at = now()
  where id = p_quote_id;
end;
$$;

revoke execute on function public.recalc_quote_totals(uuid) from public, anon, authenticated;

create or replace function public.trg_recalc_from_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_quote_totals(coalesce(new.quote_id, old.quote_id));
  return coalesce(new, old);
end;
$$;

revoke execute on function public.trg_recalc_from_items() from public, anon, authenticated;

create trigger trg_quote_items_recalc
  after insert or update or delete on quote_items
  for each row execute function public.trg_recalc_from_items();

create or replace function public.trg_recalc_from_quote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_quote_totals(new.id);
  return new;
end;
$$;

revoke execute on function public.trg_recalc_from_quote() from public, anon, authenticated;

-- Solo cuando cambia algo que afecta los totales. El recalc vuelve a disparar
-- este trigger pero la condición ya es falsa, así que no hay recursión.
create trigger trg_quotes_recalc
  after update of igv_rate, fx_rate on quotes
  for each row
  when (old.igv_rate is distinct from new.igv_rate or old.fx_rate is distinct from new.fx_rate)
  execute function public.trg_recalc_from_quote();

-- =============================================
-- INMUTABILIDAD
-- Una cotización enviada solo admite cambios de estado. Todo lo demás es
-- una versión nueva. Esto vive en la DB, no en la UI: con anon key la UI no
-- es una barrera.
-- =============================================
create or replace function public.lock_sent_quote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'borrador' then
    if (to_jsonb(new) - 'status' - 'sent_at' - 'accepted_at' - 'updated_at')
       is distinct from
       (to_jsonb(old) - 'status' - 'sent_at' - 'accepted_at' - 'updated_at') then
      raise exception 'La cotización % ya fue enviada y no se puede editar. Crea una nueva versión.', old.number
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.lock_sent_quote() from public, anon, authenticated;

create trigger trg_lock_sent_quote
  before update on quotes
  for each row execute function public.lock_sent_quote();

create or replace function public.lock_sent_quote_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status quote_status;
  v_number text;
begin
  select status, number into v_status, v_number
  from quotes where id = coalesce(new.quote_id, old.quote_id);

  if v_status is not null and v_status <> 'borrador' then
    raise exception 'La cotización % ya fue enviada: sus líneas no se pueden modificar.', v_number
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.lock_sent_quote_items() from public, anon, authenticated;

create trigger trg_lock_sent_quote_items
  before insert or update or delete on quote_items
  for each row execute function public.lock_sent_quote_items();

-- =============================================
-- EVENTOS
-- Los inserta solo el servidor. quote_events no tiene policy de insert.
-- =============================================
create or replace function public.log_quote_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  select id into v_actor from profiles where user_id = auth.uid();

  if tg_op = 'INSERT' then
    insert into quote_events (quote_id, type, actor_id)
    values (new.id, case when new.version > 1 then 'revisada'::quote_event_type else 'creada'::quote_event_type end, v_actor);
  elsif old.status is distinct from new.status and new.status = 'enviada' then
    insert into quote_events (quote_id, type, actor_id)
    values (new.id, 'enviada', v_actor);
  end if;
  -- aceptada/rechazada las registra respond_quote, que sí conoce el nombre
  -- de quien respondió. Si se logearan acá también saldrían duplicadas.

  return new;
end;
$$;

revoke execute on function public.log_quote_event() from public, anon, authenticated;

create trigger trg_log_quote_event
  after insert or update of status on quotes
  for each row execute function public.log_quote_event();

-- =============================================
-- RLS — espejo exacto de las policies de leads
-- =============================================
alter table quotes enable row level security;

create policy "Closers manage quotes of own leads" on quotes
  for all using (
    exists (
      select 1 from profiles p
      join leads l on l.owner_id = p.id
      where p.user_id = auth.uid() and p.role = 'closer' and l.id = quotes.lead_id
    )
  );

create policy "Admins and marketing can view all quotes" on quotes
  for select using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin','marketing'))
  );

create policy "Admins can manage all quotes" on quotes
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
  );

alter table quote_items enable row level security;

create policy "Closers manage items of own quotes" on quote_items
  for all using (
    exists (
      select 1 from quotes q
      join leads l on l.id = q.lead_id
      join profiles p on p.id = l.owner_id
      where q.id = quote_items.quote_id and p.user_id = auth.uid() and p.role = 'closer'
    )
  );

create policy "Admins and marketing can view all quote items" on quote_items
  for select using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin','marketing'))
  );

create policy "Admins can manage all quote items" on quote_items
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
  );

alter table quote_events enable row level security;

create policy "Closers can view events of own quotes" on quote_events
  for select using (
    exists (
      select 1 from quotes q
      join leads l on l.id = q.lead_id
      join profiles p on p.id = l.owner_id
      where q.id = quote_events.quote_id and p.user_id = auth.uid() and p.role = 'closer'
    )
  );

create policy "Admins and marketing can view all quote events" on quote_events
  for select using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin','marketing'))
  );

-- =============================================
-- LEADS: moneda y valor normalizado
-- Sin esto "Pipeline total" sumaría soles con dólares.
-- Confirmado con el dueño: todos los values existentes son soles.
-- =============================================
alter table leads add column currency text not null default 'PEN' check (currency in ('PEN','USD'));
alter table leads add column value_pen numeric not null default 0;

update leads set value_pen = value where value_pen = 0;

-- =============================================
-- ACCESO PÚBLICO
-- Sin policies anon sobre las tablas: la anon key va en el bundle, así que
-- una policy anon expondría todas las cotizaciones enviadas. Solo estas tres
-- funciones, y todas exigen el token.
-- =============================================
create or replace function public.get_public_quote(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes;
  v_org org_settings;
begin
  select * into v_quote from quotes
  where public_token = p_token and status <> 'borrador';

  if v_quote.id is null then
    return null;
  end if;

  select * into v_org from org_settings where id = true;

  return jsonb_build_object(
    'quote',
      to_jsonb(v_quote)
        - 'public_token' - 'owner_id' - 'lead_id' - 'parent_quote_id' - 'total_pen',
    'items',
      coalesce((
        select jsonb_agg(to_jsonb(i) order by i.position, i.id)
        from quote_items i where i.quote_id = v_quote.id
      ), '[]'::jsonb),
    'emitter',
      jsonb_build_object(
        'legal_name', v_org.legal_name,
        'ruc',        v_org.ruc,
        'address',    v_org.address,
        'email',      v_org.email,
        'phone',      v_org.phone,
        'website',    v_org.website,
        'logo_base64', v_org.logo_base64
      ),
    'expired',
      (v_quote.valid_until is not null and v_quote.valid_until < current_date)
  );
end;
$$;

grant execute on function public.get_public_quote(uuid) to anon, authenticated;

-- Deduplicado a una vista por hora: sin esto un refresh del cliente ensucia
-- el historial y el closer deja de confiar en él.
create or replace function public.log_quote_view(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
begin
  select id into v_quote_id from quotes
  where public_token = p_token and status <> 'borrador';
  if v_quote_id is null then return; end if;

  if exists (
    select 1 from quote_events
    where quote_id = v_quote_id and type = 'vista' and actor_id is null
      and created_at > now() - interval '1 hour'
  ) then
    return;
  end if;

  insert into quote_events (quote_id, type, actor_id) values (v_quote_id, 'vista', null);
end;
$$;

grant execute on function public.log_quote_view(uuid) to anon, authenticated;

-- Aceptar / rechazar desde el link. Cierra el círculo con el lead (Q8) y
-- avisa al closer (Q15).
create or replace function public.respond_quote(p_token uuid, p_accept boolean, p_signer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes;
  v_signer text := nullif(btrim(coalesce(p_signer, '')), '');
begin
  if v_signer is null then
    return jsonb_build_object('ok', false, 'error', 'Falta el nombre de quien responde');
  end if;

  select * into v_quote from quotes where public_token = p_token;

  if v_quote.id is null then
    return jsonb_build_object('ok', false, 'error', 'Cotización no encontrada');
  end if;
  if v_quote.status <> 'enviada' then
    return jsonb_build_object('ok', false, 'error', 'Esta cotización ya fue respondida');
  end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    return jsonb_build_object('ok', false, 'error', 'Esta cotización venció');
  end if;

  update quotes set
    status = case when p_accept then 'aceptada'::quote_status else 'rechazada'::quote_status end,
    accepted_at = case when p_accept then now() else null end
  where id = v_quote.id;

  -- log_quote_event no registra estos dos estados: acá sí se conoce el nombre
  -- de quien respondió y el evento queda completo de una sola vez.
  insert into quote_events (quote_id, type, actor_id, meta)
  values (
    v_quote.id,
    case when p_accept then 'aceptada'::quote_event_type else 'rechazada'::quote_event_type end,
    null,
    jsonb_build_object('signer', v_signer)
  );

  -- Q8: el valor del lead deja de ser a dedo.
  if p_accept and v_quote.lead_id is not null then
    update leads set
      value     = v_quote.total,
      currency  = v_quote.currency,
      value_pen = v_quote.total_pen,
      stage     = 'cerrado',
      updated_at = now()
    where id = v_quote.lead_id;
  end if;

  -- Q15
  if v_quote.owner_id is not null then
    insert into notifications (user_id, type, message, link)
    values (
      v_quote.owner_id,
      case when p_accept then 'quote_accepted' else 'quote_rejected' end,
      case when p_accept
        then v_signer || ' aceptó la cotización ' || v_quote.number
        else v_signer || ' rechazó la cotización ' || v_quote.number
      end,
      '/marketing/cotizacion/' || v_quote.id
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.respond_quote(uuid, boolean, text) to anon, authenticated;

-- Consistencia con el resto del esquema (leads, notes ya lo tienen).
-- lock_sent_quote excluye updated_at de su comparación, así que no interfiere.
create trigger quotes_updated_at before update on quotes
  for each row execute function update_updated_at();
