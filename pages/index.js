import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Home() {
  const router = useRouter()
  useEffect(() => { checkAndRedirect() }, [])

  const checkAndRedirect = async () => {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data:prof } = await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
    const role = prof?.role||'agent'
    if (role==='finance') router.push('/finance')
    else if (role==='admin') router.push('/dashboard')
    else router.push('/upload')
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f0f2fa', fontFamily:'Inter,sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'32px', marginBottom:'12px' }}>🛡️</div>
        <div style={{ fontSize:'14px', color:'#94a3b8', fontWeight:'500' }}>Loading PayVerify...</div>
      </div>
    </div>
  )
}
