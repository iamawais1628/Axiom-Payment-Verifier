import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    // Delete profile first
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    // Delete auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) throw new Error(error.message)
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
