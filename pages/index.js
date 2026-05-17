import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    checkRoleAndRedirect()
  }, [])

  const checkRoleAndRedirect = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const role = profile?.role || 'agent'

    if (role === 'finance') router.push('/finance')
    else if (role === 'admin') router.push('/dashboard')
    else router.push('/upload')
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f5f7ff', fontFamily:'Inter,sans-serif', color:'#999', fontSize:'14px' }}>
      Loading...
    </div>
  )
}
