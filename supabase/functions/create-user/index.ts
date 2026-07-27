import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_ROLES = ['admin', 'developer', 'support', 'closer', 'marketing']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!jwt) return json({ error: 'No autenticado' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    // Quién llama y si es admin (los signups públicos están deshabilitados;
    // el alta de usuarios pasa solo por acá)
    const { data: caller, error: callerError } = await admin.auth.getUser(jwt)
    if (callerError || !caller.user) return json({ error: 'No autenticado' }, 401)

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('user_id', caller.user.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Solo un admin puede crear usuarios' }, 403)
    }

    const { email, password, name, role, allowed_modules } = await req.json()
    if (!email || !password || !name || !role) return json({ error: 'Faltan campos' }, 400)
    if (!VALID_ROLES.includes(role)) return json({ error: 'Rol invalido' }, 400)
    if (typeof password !== 'string' || password.length < 6) {
      return json({ error: 'La contrasena debe tener al menos 6 caracteres' }, 400)
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    if (createError) return json({ error: createError.message }, 400)

    // El trigger handle_new_user ya creo el profile como developer;
    // acá se fijan el rol y los módulos reales elegidos por el admin.
    const { error: profileError } = await admin
      .from('profiles')
      .upsert(
        {
          user_id: created.user.id,
          name,
          email,
          role,
          allowed_modules: allowed_modules ?? [],
        },
        { onConflict: 'user_id' }
      )
    if (profileError) return json({ error: `Perfil: ${profileError.message}` }, 500)

    return json({ user_id: created.user.id })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
