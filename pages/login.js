import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

  // Redirect based on role
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', data.user.id)
  .maybeSingle()

console.log('USER ID:', data.user.id)
console.log('PROFILE DATA:', profile)
console.log('PROFILE ERROR:', profileError)

const role = profile?.role || 'agent'
console.log('FINAL ROLE:', role)

if (role === 'finance') router.push('/finance')
else if (role === 'admin') router.push('/dashboard')
else router.push('/upload')
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing:border-box; }
        .left { width:420px; background:#1e2d5a; display:flex; flex-direction:column; justify-content:space-between; padding:48px 44px; flex-shrink:0; }
        @media(max-width:720px){.left{display:none}}
        .right { flex:1; background:#f5f7ff; display:flex; align-items:center; justify-content:center; padding:40px 24px; }
        .logo { font-size:22px; font-weight:700; color:#fff; display:flex; align-items:center; gap:10px; }
        .hero h2 { font-size:30px; font-weight:700; color:#fff; line-height:1.25; margin-bottom:14px; letter-spacing:-0.5px; }
        .hero p { color:#8fa8d8; font-size:14px; line-height:1.7; }
        .feats { list-style:none; margin-top:28px; }
        .feats li { display:flex; align-items:center; gap:12px; color:#8fa8d8; font-size:13px; padding:8px 0; border-bottom:1px solid #2a3f70; }
        .feats li:last-child { border-bottom:none; }
        .feat-icon { width:32px; height:32px; background:#2a3f70; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
        .card { background:#fff; border-radius:20px; box-shadow:0 4px 40px rgba(0,0,0,0.08); padding:44px 40px; width:100%; max-width:400px; }
        .card-logo { font-size:18px; font-weight:700; color:#1e2d5a; display:flex; align-items:center; gap:8px; margin-bottom:32px; }
        .card-title { font-size:22px; font-weight:700; color:#111; margin-bottom:6px; }
        .card-sub { font-size:13px; color:#888; margin-bottom:28px; }
        .field { margin-bottom:16px; }
        .field label { display:block; font-size:12px; font-weight:600; color:#555; letter-spacing:0.5px; margin-bottom:7px; }
        .field input { width:100%; background:#f5f7ff; border:1.5px solid #e8ecf8; border-radius:10px; padding:13px 16px; color:#111; font-size:14px; font-family:'Inter',sans-serif; outline:none; transition:border-color 0.2s; }
        .field input:focus { border-color:#3b6be8; background:#fff; }
        .field input::placeholder { color:#bbb; }
        .err { background:#fff5f5; border:1.5px solid #fecaca; border-radius:10px; padding:11px 14px; color:#dc2626; font-size:13px; margin-bottom:16px; }
        .btn { width:100%; background:#2563eb; border:none; border-radius:10px; padding:14px; color:#fff; font-size:15px; font-weight:600; font-family:'Inter',sans-serif; cursor:pointer; transition:all 0.2s; }
        .btn:hover:not(:disabled) { background:#1d4ed8; transform:translateY(-1px); }
        .btn:disabled { opacity:0.5; cursor:not-allowed; }
        .foot { text-align:center; font-size:12px; color:#bbb; margin-top:20px; }
        .left-foot { color:#4a6090; font-size:12px; }
        .role-badges { display:flex; gap:8px; margin-top:20px; flex-wrap:wrap; }
        .role-badge { background:#2a3f70; color:#8fa8d8; font-size:11px; padding:4px 10px; border-radius:20px; }
      `}</style>

      <div className="left">
        <div className="logo">🛡️ Payment Verifier</div>
        <div className="hero">
          <h2>Stop Fake Payments Before They Cost You</h2>
          <p>AI-powered screenshot analysis catches duplicates, crops, and forgeries in seconds.</p>
          <ul className="feats">
            <li><span className="feat-icon">🔍</span> AI vision extracts payment data automatically</li>
            <li><span className="feat-icon">🧬</span> Visual fingerprinting catches cropped screenshots</li>
            <li><span className="feat-icon">⚡</span> Results in under 3 seconds</li>
            <li><span className="feat-icon">💬</span> Finance team approval workflow built-in</li>
            <li><span className="feat-icon">🏷️</span> Payment tag directory for your team</li>
          </ul>
          <div className="role-badges">
            <span className="role-badge">👤 Agent — Upload & track payments</span>
            <span className="role-badge">💼 Finance — Review & approve</span>
            <span className="role-badge">⚙️ Admin — Full access</span>
          </div>
        </div>
        <div className="left-foot">© 2025 Payment Verifier. All rights reserved.</div>
      </div>

      <div className="right">
        <div className="card">
          <div className="card-logo">🛡️ Payment Verifier</div>
          <div className="card-title">Welcome back</div>
          <div className="card-sub">You will be redirected based on your role after login</div>
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email Address</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {error && <div className="err">⚠️ {error}</div>}
            <button type="submit" className="btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign In →'}</button>
          </form>
          <div className="foot">Contact your admin to get access</div>
        </div>
      </div>
    </div>
  )
}
