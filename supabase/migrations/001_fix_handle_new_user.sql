-- Mejora el trigger handle_new_user para que lea email, role y allowed_modules
-- desde el raw_user_meta_data del signUp. Así un usuario recién creado queda
-- con todos los campos correctos sin depender de un UPDATE posterior.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (user_id, name, email, role, allowed_modules)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'developer'),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data->'allowed_modules')),
      ARRAY['dashboard','desarrollo','colaboracion','marketing','soporte','usuarios']
    )
  );
  RETURN new;
END;
$$;

-- Backfill: sincroniza profiles.email con auth.users.email para usuarios existentes
-- que quedaron sin email por el trigger viejo.
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.email IS NULL OR p.email = '' OR p.email <> u.email);
