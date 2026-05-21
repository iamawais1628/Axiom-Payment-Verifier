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
    const { data:prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    const role = prof?.role || 'agent'
    if (role==='finance') router.push('/finance')
    else if (role==='admin') router.push('/dashboard')
    else router.push('/upload')
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .left { width:440px; background:#0f172a; display:flex; flex-direction:column; justify-content:space-between; padding:48px 44px; flex-shrink:0; }
        @media(max-width:768px){ .left{display:none} }
        .right { flex:1; background:#f0f2fa; display:flex; align-items:center; justify-content:center; padding:40px 24px; }
        .brand { display:flex; align-items:center; gap:12px; }
        .brand-icon { width:40px; height:40px; background:linear-gradient(135deg,#3b82f6,#6366f1); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; }
        .brand-name { font-size:20px; font-weight:800; color:#fff; letter-spacing:-0.5px; }
        .brand-tag { font-size:11px; color:#475569; letter-spacing:1px; text-transform:uppercase; margin-top:1px; }
        .hero-section { flex:1; display:flex; flex-direction:column; justify-content:center; }
        .hero-heading { font-size:32px; font-weight:800; color:#fff; line-height:1.2; letter-spacing:-0.8px; margin-bottom:14px; }
        .hero-heading span { color:#3b82f6; }
        .hero-desc { color:#64748b; font-size:14px; line-height:1.7; margin-bottom:32px; }
        .feat-list { list-style:none; }
        .feat-item { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #1e293b; }
        .feat-item:last-child { border-bottom:none; }
        .feat-icon-wrap { width:34px; height:34px; border-radius:10px; background:#1e293b; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
        .feat-text { font-size:13px; color:#94a3b8; font-weight:500; }
        .role-pills { display:flex; gap:8px; flex-wrap:wrap; }
        .role-pill { background:#1e293b; color:#64748b; font-size:11px; font-weight:600; padding:5px 12px; border-radius:20px; letter-spacing:0.3px; }
        .left-footer { color:#334155; font-size:12px; }
        .form-card { background:#fff; border-radius:24px; box-shadow:0 4px 40px rgba(0,0,0,0.08); padding:44px 40px; width:100%; max-width:400px; }
        .form-brand { display:flex; align-items:center; gap:10px; margin-bottom:32px; }
        .form-brand-icon { width:36px; height:36px; background:linear-gradient(135deg,#3b82f6,#6366f1); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; }
        .form-brand-name { font-size:17px; font-weight:800; color:#0f172a; letter-spacing:-0.3px; }
        .form-title { font-size:24px; font-weight:800; color:#0f172a; letter-spacing:-0.5px; margin-bottom:6px; }
        .form-sub { font-size:13px; color:#94a3b8; margin-bottom:28px; }
        .field { margin-bottom:16px; }
        .field label { display:block; font-size:11px; font-weight:700; color:#475569; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:8px; }
        .field input { width:100%; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; padding:14px 16px; color:#0f172a; font-size:14px; font-family:'Inter',sans-serif; outline:none; transition:all 0.2s; }
        .field input:focus { border-color:#3b82f6; background:#fff; box-shadow:0 0 0 3px rgba(59,130,246,0.1); }
        .field input::placeholder { color:#cbd5e1; }
        .err-box { background:#fff5f5; border:1.5px solid #fecaca; border-radius:12px; padding:12px 16px; color:#dc2626; font-size:13px; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
        .submit-btn { width:100%; background:linear-gradient(135deg,#2563eb,#4f46e5); border:none; border-radius:12px; padding:15px; color:#fff; font-size:15px; font-weight:700; font-family:'Inter',sans-serif; cursor:pointer; transition:all 0.2s; letter-spacing:0.2px; }
        .submit-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(37,99,235,0.35); }
        .submit-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; box-shadow:none; }
        .form-footer { text-align:center; font-size:12px; color:#cbd5e1; margin-top:20px; }
        .divider { display:flex; align-items:center; gap:12px; margin:20px 0; }
        .divider-line { flex:1; height:1px; background:#f1f5f9; }
        .divider-text { font-size:11px; color:#cbd5e1; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
        .roles-info { display:flex; flex-direction:column; gap:6px; }
        .role-info-item { display:flex; align-items:center; gap:8px; background:#f8fafc; border-radius:8px; padding:8px 12px; }
        .role-info-badge { font-size:10px; font-weight:800; padding:2px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:0.3px; }
        .role-info-desc { font-size:12px; color:#64748b; }
      `}</style>

      {/* Left panel */}
      <div className="left">
        <div className="brand">
          <div className="brand-icon">🛡️</div>
          <div>
            <div className="brand-name">PayVerify</div>
            <div className="brand-tag">Payment Intelligence</div>
          </div>
        </div>

        <div className="hero-section">
          <h1 className="hero-heading">Stop <span>Fake Payments</span> Before They Cost You</h1>
          <p className="hero-desc">AI-powered screenshot analysis with team workflow, finance approval, and real-time notifications — all in one place.</p>
          <ul className="feat-list">
            {[
              {icon:'🤖', text:'AI vision extracts payment data automatically'},
              {icon:'🧬', text:'Visual fingerprinting catches cropped screenshots'},
              {icon:'⚡', text:'Duplicate detection in under 3 seconds'},
              {icon:'✅', text:'Finance team approval workflow built-in'},
              {icon:'🏷️', text:'Payment tag directory for your whole team'},
              {icon:'📊', text:'Full audit trail and activity logging'},
            ].map(f => (
              <li key={f.text} className="feat-item">
                <div className="feat-icon-wrap">{f.icon}</div>
                <span className="feat-text">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div style={{fontSize:'11px',color:'#475569',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px',fontWeight:'700'}}>Team Roles</div>
          <div className="role-pills">
            <span className="role-pill">👤 Agent — Upload & track</span>
            <span className="role-pill">💼 Finance — Review & approve</span>
            <span className="role-pill">⚙️ Admin — Full access</span>
          </div>
          <div className="left-footer" style={{marginTop:'20px'}}>© 2025 PayVerify. All rights reserved.</div>
        </div>
      </div>

      {/* Right panel */}
      <div className="right">
        <div className="form-card">
          <div className="form-brand">
            <div className="form-brand-icon">🛡️</div>
            <div className="form-brand-name">PayVerify</div>
          </div>

          <div className="form-title">Welcome back</div>
          <div className="form-sub">You'll be redirected to your dashboard based on your role</div>

          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email Address</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required/>
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/>
            </div>
            {error && <div className="err-box">⚠️ {error}</div>}
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div className="divider">
            <div className="divider-line"/>
            <div className="divider-text">Role Access</div>
            <div className="divider-line"/>
          </div>

          <div className="roles-info">
            {[
              {badge:'Agent', badgeBg:'#eff6ff', badgeColor:'#1d4ed8', desc:'Upload & track payments'},
              {badge:'Finance', badgeBg:'#fef9c3', badgeColor:'#b45309', desc:'Review & approve submissions'},
              {badge:'Admin', badgeBg:'#f5f3ff', badgeColor:'#6d28d9', desc:'Full system access'},
            ].map(r => (
              <div key={r.badge} className="role-info-item">
                <span className="role-info-badge" style={{background:r.badgeBg,color:r.badgeColor}}>{r.badge}</span>
                <span className="role-info-desc">{r.desc}</span>
              </div>
            ))}
          </div>

          <div className="form-footer">Contact your admin to get access</div>
        </div>
      </div>
    </div>
  )
}
