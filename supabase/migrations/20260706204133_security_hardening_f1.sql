-- ============================================================
-- F1 — Security hardening (PRD docs/prd-hardening.md S1–S4)
-- ============================================================

-- ------------------------------------------------------------
-- 0) Helper functions (SECURITY DEFINER to avoid RLS recursion on profiles)
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.has_role(p_role user_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = p_role
  );
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = p_project_id and p.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = p_project_id
      and pm.role = 'owner'
      and p.user_id = auth.uid()
  );
$$;

revoke execute on function public.is_admin(), public.has_role(user_role),
  public.is_project_member(uuid), public.is_project_owner(uuid)
from public, anon;
grant execute on function public.is_admin(), public.has_role(user_role),
  public.is_project_member(uuid), public.is_project_owner(uuid)
to authenticated;

-- ------------------------------------------------------------
-- S1) profiles: block self-escalation of role / allowed_modules
-- ------------------------------------------------------------
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins can update any profile" on profiles;
create policy "Admins can update any profile" on profiles
  for update
  using ((select is_admin()))
  with check ((select is_admin()));

-- Column-level guard: only admins may change role / allowed_modules / user_id.
-- auth.uid() is null for service_role / dashboard sessions, which stay unaffected.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.allowed_modules is distinct from old.allowed_modules
      or new.user_id is distinct from old.user_id)
     and auth.uid() is not null
     and not is_admin() then
    raise exception 'Solo un admin puede cambiar role, allowed_modules o user_id';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on profiles;
create trigger protect_profile_privileges
  before update on profiles
  for each row execute function protect_profile_privileges();

-- ------------------------------------------------------------
-- S2) signup trigger: keep hardened behavior, also persist email,
--     and remove its REST/RPC exposure
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (user_id, name, email, role, allowed_modules)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'developer',
    array['dashboard', 'desarrollo', 'colaboracion', 'marketing', 'soporte']
  );
  return new;
exception when others then
  raise warning 'handle_new_user failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ------------------------------------------------------------
-- S3) notifications: remove unrestricted insert (app does not insert;
--     future notification writes should go through a SECURITY DEFINER fn)
-- ------------------------------------------------------------
drop policy if exists "System can insert notifications" on notifications;

-- ------------------------------------------------------------
-- S4) project-scoped authorization for projects / objectives / tasks / members
-- ------------------------------------------------------------

-- Backfill BEFORE tightening: projects with no explicit members keep working
-- for current developers (added as contributors).
insert into project_members (project_id, profile_id, role)
select p.id, pr.id, 'contributor'
from projects p
cross join profiles pr
where pr.role = 'developer'
  and not exists (
    select 1 from project_members pm where pm.project_id = p.id
  );

-- projects
drop policy if exists "Admins and developers can manage projects" on projects;

create policy "projects_insert_admin_or_dev" on projects
  for insert
  with check ((select is_admin()) or (select has_role('developer')));

create policy "projects_update_admin_or_member_dev" on projects
  for update
  using ((select is_admin()) or (has_role('developer') and is_project_member(id)))
  with check ((select is_admin()) or (has_role('developer') and is_project_member(id)));

create policy "projects_delete_admin_or_member_dev" on projects
  for delete
  using ((select is_admin()) or (has_role('developer') and is_project_member(id)));

-- Creator becomes owner automatically (runs as definer, bypasses member RLS).
create or replace function public.add_project_creator_as_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into project_members (project_id, profile_id, role)
    select new.id, p.id, 'owner'
    from profiles p
    where p.user_id = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists on_project_created on projects;
create trigger on_project_created
  after insert on projects
  for each row execute function add_project_creator_as_owner();

-- objectives
drop policy if exists "Admins and developers can manage objectives" on objectives;
create policy "objectives_manage_admin_or_member_dev" on objectives
  for all
  using ((select is_admin()) or (has_role('developer') and is_project_member(project_id)))
  with check ((select is_admin()) or (has_role('developer') and is_project_member(project_id)));

-- tasks (project via parent objective)
drop policy if exists "Admins and developers can manage tasks" on tasks;
create policy "tasks_manage_admin_or_member_dev" on tasks
  for all
  using (
    (select is_admin())
    or (has_role('developer') and is_project_member(
      (select o.project_id from objectives o where o.id = tasks.objective_id)))
  )
  with check (
    (select is_admin())
    or (has_role('developer') and is_project_member(
      (select o.project_id from objectives o where o.id = tasks.objective_id)))
  );

-- project_members: only admins and project owners manage membership
drop policy if exists "Admins and developers can manage project members" on project_members;
create policy "project_members_manage_admin_or_owner" on project_members
  for all
  using ((select is_admin()) or is_project_owner(project_id))
  with check ((select is_admin()) or is_project_owner(project_id));

-- ------------------------------------------------------------
-- Advisor cleanups: pin search_path on trigger functions
-- ------------------------------------------------------------
alter function public.update_updated_at() set search_path = public;
alter function public.update_memberships_updated_at() set search_path = public;
alter function public.update_membership_accounts_updated_at() set search_path = public;
alter function public.update_membership_plans_updated_at() set search_path = public;
