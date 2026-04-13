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
create type activity_type as enum ('llamada', 'reunion', 'email', 'nota');
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
