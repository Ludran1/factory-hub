-- Trigger functions never need direct EXECUTE (trigger firing bypasses it)
revoke execute on function public.protect_profile_privileges() from public, anon, authenticated;
revoke execute on function public.add_project_creator_as_owner() from public, anon, authenticated;
