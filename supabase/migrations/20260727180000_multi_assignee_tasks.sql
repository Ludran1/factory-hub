-- Tareas con múltiples asignados: task_assignees (N–N tasks ↔ profiles).
-- tasks.assignee_id queda como columna legada (ya no se escribe); el frontend
-- y las notificaciones pasan a usar esta tabla.
create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, profile_id)
);

alter table public.task_assignees enable row level security;

create policy "task_assignees_select_authenticated" on public.task_assignees
  for select using (auth.role() = 'authenticated');

-- Mismo criterio que tasks_manage_admin_or_member_dev: admin, o developer
-- miembro del proyecto al que pertenece la tarea.
create policy "task_assignees_manage_admin_or_member_dev" on public.task_assignees
  for all
  using (
    (select is_admin())
    or (has_role('developer') and is_project_member(
      (select o.project_id from objectives o join tasks t on t.objective_id = o.id
       where t.id = task_assignees.task_id)))
  )
  with check (
    (select is_admin())
    or (has_role('developer') and is_project_member(
      (select o.project_id from objectives o join tasks t on t.objective_id = o.id
       where t.id = task_assignees.task_id)))
  );

-- Backfill ANTES de crear el trigger de notificación (evita notificar tareas viejas)
insert into public.task_assignees (task_id, profile_id)
select id, assignee_id from public.tasks where assignee_id is not null
on conflict do nothing;

-- La notificación ahora se dispara por cada asignado agregado
drop trigger if exists trg_notify_task_assigned on public.tasks;
drop function if exists public.notify_task_assigned();

create or replace function public.notify_task_assignee_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile_id uuid;
  task_title text;
begin
  -- No notificar si uno se asigna la tarea a sí mismo
  select id into actor_profile_id from profiles where user_id = auth.uid();
  if actor_profile_id is not null and actor_profile_id = new.profile_id then
    return new;
  end if;

  select title into task_title from tasks where id = new.task_id;

  insert into notifications (user_id, type, message, link)
  values (
    new.profile_id,
    'task_assigned',
    'Te asignaron la tarea «' || coalesce(task_title, '') || '»',
    '/desarrollo'
  );
  return new;
end;
$$;

revoke execute on function public.notify_task_assignee_added() from public, anon, authenticated;

create trigger trg_notify_task_assignee_added
  after insert on public.task_assignees
  for each row execute function public.notify_task_assignee_added();
