import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()

  const handleReset = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else { setDone(true) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f0f2fa', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:"'Inter',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); * { box-sizing:border-box; }`}</style>
      <div style={{ background:'#fff', borderRadius:'20px', padding:'44px 40px', width:'100%', maxWidth:'400px', boxShadow:'0 4px 40px rgba(0,0,0,0.08)' }}>
        {done ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'48px', marginBottom:'16px' }}>✅</div>
            <div style={{ fontSize:'20px', fontWeight:'800', color:'#0f172a', marginBottom:'8px' }}>Password Updated</div>
            <div style={{ fontSize:'13px', color:'#64748b', marginBottom:'24px' }}>Your password has been changed successfully.</div>
            <button onClick={() => router.push('/login')}
              style={{ width:'100%', background:'#1d4ed8', border:'none', borderRadius:'10px', padding:'14px', color:'#fff', fontSize:'14px', fontWeight:'700', fontFamily:'Inter,sans-serif', cursor:'pointer' }}>
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize:'32px', marginBottom:'16px', textAlign:'center' }}>🔑</div>
            <div style={{ fontSize:'20px', fontWeight:'800', color:'#0f172a', marginBottom:'6px', textAlign:'center' }}>Set New Password</div>
            <div style={{ fontSize:'13px', color:'#64748b', marginBottom:'28px', textAlign:'center' }}>Choose a strong password for your account</div>
            <form onSubmit={handleReset}>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#475569', letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:'8px' }}>New Password</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                  style={{ width:'100%', background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:'10px', padding:'13px 15px', color:'#0f172a', fontSize:'14px', fontFamily:'Inter,sans-serif', outline:'none' }}
                  placeholder="Min 6 characters" required/>
              </div>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#475569', letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:'8px' }}>Confirm Password</label>
                <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)}
                  style={{ width:'100%', background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:'10px', padding:'13px 15px', color:'#0f172a', fontSize:'14px', fontFamily:'Inter,sans-serif', outline:'none' }}
                  placeholder="Repeat password" required/>
              </div>
              {error && <div style={{ background:'#fff5f5', border:'1.5px solid #fecaca', borderRadius:'10px', padding:'11px 14px', color:'#dc2626', fontSize:'13px', marginBottom:'16px' }}>⚠️ {error}</div>}
              <button type="submit" disabled={loading}
                style={{ width:'100%', background:'#1d4ed8', border:'none', borderRadius:'10px', padding:'14px', color:'#fff', fontSize:'15px', fontWeight:'700', fontFamily:'Inter,sans-serif', cursor:'pointer', opacity:loading?0.6:1 }}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
