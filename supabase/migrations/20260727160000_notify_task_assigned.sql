-- Notificación automática al asignar una tarea.
-- El insert en notifications quedó cerrado a clientes en F1 (sin policy de
-- INSERT): esta función SECURITY DEFINER es la única vía de escritura.
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile_id uuid;
begin
  if new.assignee_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.assignee_id is not distinct from new.assignee_id then
    return new;
  end if;

  -- No notificar si uno se asigna la tarea a sí mismo
  select id into actor_profile_id from profiles where user_id = auth.uid();
  if actor_profile_id is not null and actor_profile_id = new.assignee_id then
    return new;
  end if;

  insert into notifications (user_id, type, message, link)
  values (
    new.assignee_id,
    'task_assigned',
    'Te asignaron la tarea «' || new.title || '»',
    '/desarrollo'
  );
  return new;
end;
$$;

revoke execute on function public.notify_task_assigned() from public, anon, authenticated;

drop trigger if exists trg_notify_task_assigned on public.tasks;
create trigger trg_notify_task_assigned
  after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_task_assigned();

-- Realtime para notifications (los suscriptores solo reciben filas que su RLS permite ver)
alter publication supabase_realtime add table public.notifications;
