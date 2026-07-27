import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const { data: caller, error: callerError } = await admin.auth.getUser(jwt)
    if (callerError || !caller.user) return json({ error: 'No autenticado' }, 401)

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('user_id', caller.user.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Solo un admin puede eliminar usuarios' }, 403)
    }

    const { user_id } = await req.json()
    if (!user_id || typeof user_id !== 'string') return json({ error: 'Falta user_id' }, 400)

    if (user_id === caller.user.id) {
      return json({ error: 'No puedes eliminar tu propia cuenta' }, 400)
    }

    const { data: targetProfile, error: targetError } = await admin
      .from('profiles')
      .select('role, name')
      .eq('user_id', user_id)
      .single()
    if (targetError || !targetProfile) return json({ error: 'Usuario no encontrado' }, 404)

    if (targetProfile.role === 'admin') {
      const { count } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
      if ((count ?? 0) <= 1) {
        return json({ error: 'No se puede eliminar al último admin' }, 400)
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user_id)
    if (deleteError) return json({ error: deleteError.message }, 400)

    return json({ ok: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
