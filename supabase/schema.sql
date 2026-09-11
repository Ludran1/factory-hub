-- =============================================
-- FACTORY HUB — Schema completo
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- ENUMS
create type user_role as enum ('admin', 'developer', 'support', 'closer', 'marketing');
create type task_priority as enum ('urgente', 'alta', 'media', 'baja');
create type task_status as enum ('todo', 'in_progress', 'code_review', 'done');
create type ticket_priority as enum ('urgente', 'alta', 'media', 'baja');
create type ticket_status as enum ('Abierto', 'En Revisión', 'Resuelto');
create type lead_stage as enum ('prospecto', 'demo', 'negociacion', 'cerrado');
create type lead_source as enum ('referido', 'cold_outreach', 'sitio_web', 'evento', 'redes_sociales', 'otro');
create type activity_type as enum ('llamada', 'reunion', 'email', 'nota', 'whatsapp');
create type project_status as enum ('activo', 'pausado', 'completado');
create type objective_status as enum ('pendiente', 'en_progreso', 'completado');

-- =============================================
-- PROFILES
-- =============================================
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  name text not null,
  avatar_url text,
  role user_role not null default 'developer',
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view all profiles" on profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = user_id);

create policy "Admins can update any profile" on profiles
  for update using (
    exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
  );

-- Auto-create profile on signup
create function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (user_id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 'developer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================
-- PROJECTS
-- =============================================
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text not null,
  color text not null default '#6366f1',
  status project_status not null default 'activo',
  created_at timestamptz default now()
);

alter table projects enable row level security;

create policy "Authenticated users can view projects" on projects
  for select using (auth.role() = 'authenticated');

create policy "Admins and developers can manage projects" on projects
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin', 'developer'))
  );

-- =============================================
-- OBJECTIVES
-- =============================================
create table objectives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null,
  color text not null default '#6366f1',
  start_date date not null,
  end_date date not null,
  status objective_status not null default 'pendiente',
  created_at timestamptz default now()
);

alter table objectives enable row level security;

create policy "Authenticated users can view objectives" on objectives
  for select using (auth.role() = 'authenticated');

create policy "Admins and developers can manage objectives" on objectives
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin', 'developer'))
  );

-- =============================================
-- TASKS
-- =============================================
create table tasks (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid references objectives(id) on delete cascade not null,
  title text not null,
  priority task_priority not null default 'media',
  status task_status not null default 'todo',
  assignee_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tasks enable row level security;

create policy "Authenticated users can view tasks" on tasks
  for select using (auth.role() = 'authenticated');

create policy "Admins and developers can manage tasks" on tasks
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin', 'developer'))
  );

-- =============================================
-- TICKETS
-- =============================================
create table tickets (
  id text primary key default 'TKT-' || upper(substring(gen_random_uuid()::text, 1, 6)),
  client text not null,
  system text not null,
  subject text not null,
  description text,
  priority ticket_priority not null default 'media',
  status ticket_status not null default 'Abierto',
  assigned_to uuid references profiles(id) on delete set null,
  escalated_task_id uuid references tasks(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tickets enable row level security;

create policy "Support and admins can view all tickets" on tickets
  for select using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin', 'support'))
  );

create policy "Developers can view escalated tickets" on tickets
  for select using (
    exists (
      select 1 from profiles p
      join tasks t on t.assignee_id = p.id
      where p.user_id = auth.uid() and t.id = tickets.escalated_task_id
    )
  );

create policy "Support and admins can manage tickets" on tickets
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin', 'support'))
  );

-- =============================================
-- TICKET COMMENTS
-- =============================================
create table ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id text references tickets(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  body text not null,
  is_internal boolean not null default true,
  created_at timestamptz default now()
);

alter table ticket_comments enable row level security;

create policy "Support and admins can manage comments" on ticket_comments
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin', 'support'))
  );

-- =============================================
-- TICKET ACTIVITY
-- =============================================
create table ticket_activity (
  id uuid primary key default gen_random_uuid(),
  ticket_id text references tickets(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  action text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table ticket_activity enable row level security;

create policy "Support and admins can view activity" on ticket_activity
  for select using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin', 'support'))
  );

create policy "Support and admins can insert activity" on ticket_activity
  for insert with check (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin', 'support'))
  );

-- =============================================
-- LEADS
-- =============================================
create table leads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text not null,
  contact_email text,
  contact_phone text,
  product text not null,
  value numeric not null default 0,
  stage lead_stage not null default 'prospecto',
  source lead_source not null default 'otro',
  owner_id uuid references profiles(id) on delete set null,
  expected_close_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table leads enable row level security;

create policy "Closers can view own leads" on leads
  for select using (
    exists (select 1 from profiles where user_id = auth.uid() and role = 'closer' and id = leads.owner_id)
  );

create policy "Marketing and admins can view all leads" on leads
  for select using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin', 'marketing'))
  );

create policy "Closers can manage own leads" on leads
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and role = 'closer' and id = leads.owner_id)
  );

create policy "Admins can manage all leads" on leads
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
  );

-- =============================================
-- LEAD ACTIVITIES
-- =============================================
create table lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  type activity_type not null,
  body text not null,
  created_at timestamptz default now()
);

alter table lead_activities enable row level security;

create policy "Closers can manage activities on own leads" on lead_activities
  for all using (
    exists (
      select 1 from profiles p
      join leads l on l.owner_id = p.id
      where p.user_id = auth.uid() and l.id = lead_activities.lead_id
    )
  );

create policy "Admins and marketing can view all activities" on lead_activities
  for select using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin', 'marketing'))
  );

-- =============================================
-- LEAD TASKS
-- =============================================
create table lead_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade not null,
  assigned_to uuid references profiles(id) on delete set null,
  title text not null,
  due_date date,
  completed boolean not null default false,
  created_at timestamptz default now()
);

alter table lead_tasks enable row level security;

create policy "Closers and admins can manage lead tasks" on lead_tasks
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and role in ('admin', 'closer'))
  );

-- =============================================
-- COLLAB BOARDS
-- =============================================
create table collab_boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null,
  excalidraw_data jsonb,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz default now()
);

alter table collab_boards enable row level security;

create policy "Authenticated users can view and edit boards" on collab_boards
  for all using (auth.role() = 'authenticated');

-- =============================================
-- NOTES
-- =============================================
create table notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  author_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  content jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table notes enable row level security;

create policy "Authenticated users can manage notes" on notes
  for all using (auth.role() = 'authenticated');

-- =============================================
-- NOTIFICATIONS
-- =============================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz default now()
);

alter table notifications enable row level security;

create policy "Users can view own notifications" on notifications
  for select using (
    exists (select 1 from profiles where user_id = auth.uid() and id = notifications.user_id)
  );

create policy "Users can update own notifications" on notifications
  for update using (
    exists (select 1 from profiles where user_id = auth.uid() and id = notifications.user_id)
  );

create policy "System can insert notifications" on notifications
  for insert with check (true);

-- =============================================
-- UPDATED_AT triggers
-- =============================================
create function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at before update on tasks
  for each row execute function update_updated_at();

create trigger tickets_updated_at before update on tickets
  for each row execute function update_updated_at();

create trigger leads_updated_at before update on leads
  for each row execute function update_updated_at();

create trigger notes_updated_at before update on notes
  for each row execute function update_updated_at();

-- =============================================
-- COTIZACIONES / PROPUESTAS
-- Snapshot de la migración 20260911120000_quotes.sql — ver ese archivo para
-- los comentarios de diseño (docs/prd-cotizaciones.md).
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

create trigger quotes_updated_at before update on quotes
  for each row execute function update_updated_at();

-- =============================================
-- TELÉFONO NORMALIZADO EN LEADS
-- Snapshot de 20260911180000_lead_phone_e164.sql.
-- =============================================
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

-- Las conversaciones de WhatsApp se registran en lead_activities usando el
-- valor 'whatsapp' del enum activity_type (declarado arriba). No hace falta
-- tabla nueva: el timeline del lead ya es donde se mira la relación.

-- =============================================
-- WHATSAPP ENTRANTE
-- Snapshot de 20260911190000_whatsapp_inbound.sql.
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
