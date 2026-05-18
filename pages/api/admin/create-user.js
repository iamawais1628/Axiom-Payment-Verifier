
import { createClient } from '@supabase/supabase-js'

// Uses service role key to bypass RLS and create users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, full_name, role, payment_methods } = req.body

  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  try {
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (authError) throw new Error(authError.message)

    // Create profile
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: authData.user.id,
      email,
      full_name: full_name || '',
      role: role || 'agent',
      payment_methods: payment_methods || [],
    })

    if (profileError) throw new Error(profileError.message)

    return res.json({ success: true, userId: authData.user.id })
  } catch (err) {
    console.error('Create user error:', err)
    return res.status(500).json({ error: err.message })
  }
}
