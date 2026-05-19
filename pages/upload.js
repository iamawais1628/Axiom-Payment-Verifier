import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const METHODS = ['CashApp','Chime','Zelle','TapTap','Venmo','PayPal','Other']
const METHOD_COLORS = { CashApp:'#00D64F', Chime:'#1EC677', Zelle:'#6D1ED4', TapTap:'#FF4E00', Venmo:'#3D95CE', PayPal:'#003087', Other:'#64748B' }
const STEPS = ['Uploading image...','Running AI extraction...','Checking for duplicates...','Finalizing result...']

function MethodIcon({ method }) {
  const color = METHOD_COLORS[method] || '#64748B'
  const letters = { CashApp:'$', Chime:'C', Zelle:'Z', TapTap:'T', Venmo:'V', PayPal:'P', Other:'?' }
  return (
    <svg viewBox="0 0 40 40" width="28" height="28">
      <rect width="40" height="40" rx="10" fill={color}/>
      <text x="20" y="27" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white" fontFamily="Arial">{letters[method]}</text>
    </svg>
  )
}

function DetailRow({ label, value }) {
  if (!value || value==='UNKNOWN'||value==='N/A') return null
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:'16px', padding:'8px 0', borderBottom:'1px solid #f0f0f0' }}>
      <span style={{ color:'#999', fontSize:'12px', textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap', fontWeight:500 }}>{label}</span>
      <span style={{ color:'#222', fontSize:'13px', fontWeight:'600', textAlign:'right' }}>{value}</span>
    </div>
  )
}

export default function Upload() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [method, setMethod] = useState('CashApp')
  const [uploaderName, setUploaderName] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [note, setNote] = useState('')
  const fileRef = useRef(null)
  const router = useRouter()

  useEffect(() => { init() }, [])
  useEffect(() => {
    const paste = (e) => {
      for (const item of e.clipboardData?.items||[]) {
        if (item.type.startsWith('image/')) { handleFile(item.getAsFile()); break }
      }
    }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  }, [])
  useEffect(() => {
    let t
    if (loading) { setStep(0); t = setInterval(() => setStep(s => s < STEPS.length-1 ? s+1 : s), 1800) }
    return () => clearInterval(t)
  }, [loading])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUploaderName(user.email)
    // Finance users should not be on this page
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (prof?.role === 'finance') { router.push('/finance'); return }
  }

  const handleFile = (f) => {
    if (!f||!f.type.startsWith('image/')) return
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!file) return
    setLoading(true); setResult(null)
    const fd = new FormData()
    fd.append('file', file); fd.append('paymentMethod', method); fd.append('uploaderName', uploaderName); fd.append('note', note)
    try {
      const r = await fetch('/api/verify', { method:'POST', body:fd })
      setResult(await r.json())
    } catch { setResult({ status:'error', message:'Connection failed. Please try again.' }) }
    setLoading(false)
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }
  const reset = (presetMethod) => { setFile(null); setPreview(null); setResult(null); setNote(''); if(presetMethod) setMethod(presetMethod) }

  const statusMeta = {
    verified:   { icon:'✅', label:'VERIFIED',          accent:'#16a34a', lightBg:'#f0fdf4', border:'#bbf7d0', badgeBg:'#dcfce7', badgeText:'#15803d' },
    duplicate:  { icon:'❌', label:'DUPLICATE DETECTED', accent:'#dc2626', lightBg:'#fff5f5', border:'#fecaca', badgeBg:'#fee2e2', badgeText:'#dc2626' },
    suspicious: { icon:'⚠️', label:'NEEDS REVIEW',       accent:'#d97706', lightBg:'#fffbeb', border:'#fde68a', badgeBg:'#fef9c3', badgeText:'#b45309' },
    error:      { icon:'🚫', label:'ERROR',              accent:'#6b7280', lightBg:'#f9fafb', border:'#e5e7eb', badgeBg:'#f3f4f6', badgeText:'#374151' },
  }
  const meta = statusMeta[result?.status] || statusMeta.error

  return (
    <div style={{ minHeight:'100vh', background:'#f5f7ff', fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing:border-box; }
        .nav { background:#1e2d5a; height:58px; padding:0 28px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:10; }
        .nav-logo { color:#fff; font-size:17px; font-weight:700; display:flex; align-items:center; gap:8px; cursor:pointer; }
        .nav-right { display:flex; align-items:center; gap:8px; }
        .nav-link { background:none; border:none; color:#8fa8d8; font-size:13px; font-family:'Inter',sans-serif; cursor:pointer; padding:6px 12px; border-radius:7px; transition:all 0.15s; }
        .nav-link:hover { background:#2a3f70; color:#fff; }
        .nav-link.danger:hover { background:#3d1a1a; color:#f87171; }
        .page { max-width:620px; margin:0 auto; padding:32px 20px; }
        .card { background:#fff; border-radius:18px; box-shadow:0 2px 20px rgba(0,0,0,0.07); padding:32px; }
        .card-title { font-size:19px; font-weight:700; color:#111; margin-bottom:4px; }
        .card-sub { font-size:13px; color:#999; margin-bottom:26px; }
        .drop-zone { border:2px dashed #d1d9f0; border-radius:14px; padding:36px 20px; text-align:center; cursor:pointer; transition:all 0.2s; background:#f8f9ff; position:relative; margin-bottom:22px; }
        .drop-zone.over { border-color:#3b6be8; background:#eef2ff; }
        .drop-zone:hover { border-color:#a5b4fc; }
        .drop-icon { font-size:34px; margin-bottom:8px; }
        .drop-text { color:#374151; font-size:14px; font-weight:500; }
        .drop-text span { color:#3b6be8; }
        .drop-hint { color:#bbb; font-size:12px; margin-top:5px; }
        .preview-img { max-height:240px; border-radius:10px; border:1px solid #e5e7eb; }
        .change-btn { position:absolute; top:10px; right:10px; background:#fff; border:1px solid #e5e7eb; border-radius:6px; color:#555; font-size:11px; padding:5px 11px; cursor:pointer; font-family:'Inter',sans-serif; font-weight:500; }
        .change-btn:hover { border-color:#3b6be8; color:#3b6be8; }
        .field-label { font-size:12px; font-weight:600; color:#555; letter-spacing:0.4px; margin-bottom:9px; display:block; }
        .method-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:20px; }
        @media(max-width:480px){.method-grid{grid-template-columns:repeat(2,1fr)}}
        .m-btn { background:#f8f9ff; border:1.5px solid #e8ecf8; border-radius:10px; padding:10px 6px; text-align:center; cursor:pointer; transition:all 0.15s; font-family:'Inter',sans-serif; }
        .m-btn:hover { border-color:#a5b4fc; background:#f0f4ff; }
        .m-btn.sel { border-color:#3b6be8; background:#eef2ff; }
        .m-icon { display:flex; align-items:center; justify-content:center; margin-bottom:6px; }
        .m-label { font-size:11px; color:#888; font-weight:500; }
        .m-btn.sel .m-label { color:#3b6be8; }
        .txt-input { width:100%; background:#f8f9ff; border:1.5px solid #e8ecf8; border-radius:10px; padding:12px 15px; color:#111; font-size:14px; font-family:'Inter',sans-serif; outline:none; transition:border-color 0.2s; margin-bottom:20px; }
        .txt-input:focus { border-color:#3b6be8; background:#fff; }
        .submit-btn { width:100%; background:#2563eb; border:none; border-radius:11px; padding:14px; color:#fff; font-size:15px; font-weight:600; font-family:'Inter',sans-serif; cursor:pointer; transition:all 0.2s; }
        .submit-btn:hover:not(:disabled) { background:#1d4ed8; transform:translateY(-1px); box-shadow:0 4px 14px rgba(37,99,235,0.3); }
        .submit-btn:disabled { opacity:0.45; cursor:not-allowed; transform:none; box-shadow:none; }
        .loading-card { background:#fff; border-radius:18px; box-shadow:0 2px 20px rgba(0,0,0,0.07); padding:60px 36px; text-align:center; }
        .spinner { width:44px; height:44px; border:3px solid #e8ecf8; border-top-color:#2563eb; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 22px; }
        @keyframes spin{to{transform:rotate(360deg)}}
        .loading-label { font-size:15px; color:#555; font-weight:500; margin-bottom:6px; }
        .step-track { display:flex; justify-content:center; gap:6px; margin-top:18px; }
        .step-dot { width:7px; height:7px; border-radius:50%; background:#e8ecf8; transition:background 0.3s; }
        .step-dot.done { background:#2563eb; }
        .result-header { border-radius:14px 14px 0 0; padding:28px 28px 22px; text-align:center; }
        .result-icon { font-size:48px; margin-bottom:10px; }
        .result-title { font-size:22px; font-weight:700; margin-bottom:8px; }
        .result-pill { display:inline-block; padding:8px 16px; border-radius:30px; font-size:13px; font-weight:500; margin-top:4px; }
        .result-body { background:#fff; border-radius:0 0 18px 18px; box-shadow:0 2px 20px rgba(0,0,0,0.09); padding:24px 28px 28px; }
        .section-label { font-size:10px; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; margin-top:18px; }
        .section-label:first-child { margin-top:0; }
        .detail-box { background:#f8f9ff; border:1.5px solid #e8ecf8; border-radius:12px; padding:14px 16px; }
        .orig-box { border-radius:12px; padding:14px 16px; }
        .orig-link { display:inline-flex; align-items:center; gap:5px; color:#2563eb; font-size:13px; text-decoration:none; margin-top:10px; font-weight:500; }
        .orig-link:hover { text-decoration:underline; }
        .reset-btn { width:100%; background:#f5f7ff; border:1.5px solid #e8ecf8; border-radius:11px; padding:13px; color:#555; font-size:14px; font-weight:600; font-family:'Inter',sans-serif; cursor:pointer; transition:all 0.2s; margin-top:20px; }
        .reset-btn:hover { background:#eef2ff; border-color:#a5b4fc; color:#2563eb; }
        .sim-note { font-size:12px; color:#aaa; margin-top:6px; }
        @media(max-width:640px){
          .nav { padding:0 16px; }
          .nav-logo { font-size:15px; }
          .nav-link { padding:4px 8px; font-size:12px; }
          .page { padding:16px 12px; }
          .card { padding:20px 16px; }
          .card-title { font-size:17px; }
          .drop-zone { padding:24px 14px; }
          .submit-btn { padding:13px; font-size:14px; }
          .result-header { padding:20px 18px 16px; }
          .result-title { font-size:18px; }
          .result-body { padding:16px 18px 20px; }
        }
        .note-textarea { width:100%; background:#f8f9ff; border:1.5px solid #e8ecf8; border-radius:10px; padding:12px 15px; color:#111; font-size:13px; font-family:'Inter',sans-serif; outline:none; transition:border-color 0.2s; margin-bottom:20px; resize:none; }
        .note-textarea:focus { border-color:#3b6be8; background:#fff; }
        .reupload-btn { width:100%; background:#2563eb; border:none; border-radius:11px; padding:14px; color:#fff; font-size:15px; font-weight:600; font-family:'Inter',sans-serif; cursor:pointer; transition:all 0.2s; margin-top:10px; }
        .reupload-btn:hover { background:#1d4ed8; transform:translateY(-1px); }
        .reject-banner { background:#fff5f5; border:1.5px solid #fecaca; border-radius:12px; padding:16px 18px; margin-bottom:16px; }
        .reject-banner-label { font-size:11px; font-weight:700; color:#dc2626; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; }
        .reject-banner-text { font-size:14px; color:#333; }
      `}</style>

      <nav className="nav">
        <div className="nav-logo" onClick={() => router.push('/upload')}>🛡️ Payment Verifier</div>
        <div className="nav-right">
          <span style={{color:'#4a6090',fontSize:'11px',padding:'3px 8px',background:'#2a3f70',borderRadius:'20px'}}>👤 Agent</span>
          <button className="nav-link" onClick={() => router.push('/tags')}>🏷️ Tags</button>
          <button className="nav-link" onClick={() => router.push('/my-payments')}>My Payments</button>
          <button className="nav-link danger" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="page">
        {!loading && !result && (
          <div className="card">
            <div className="card-title">Verify Payment Screenshot</div>
            <div className="card-sub">Upload, drag & drop, or paste (Ctrl+V) a screenshot to check for fraud</div>
            <form onSubmit={handleSubmit}>
              <div className={`drop-zone${dragOver?' over':''}`}
                onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0])}}
                onClick={()=>!preview&&fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept="image/*" onChange={e=>handleFile(e.target.files[0])} style={{display:'none'}}/>
                {preview ? (
                  <>
                    <img src={preview} alt="Preview" className="preview-img"/>
                    <button type="button" className="change-btn" onClick={e=>{e.stopPropagation();fileRef.current?.click()}}>Change</button>
                  </>
                ) : (
                  <>
                    <div className="drop-icon">📸</div>
                    <div className="drop-text"><span>Click to upload</span> or drag & drop</div>
                    <div className="drop-hint">Ctrl+V to paste · PNG, JPG up to 10MB</div>
                  </>
                )}
              </div>

              <label className="field-label">Payment Method</label>
              <div className="method-grid">
                {METHODS.map(m => (
                  <button key={m} type="button" className={`m-btn${method===m?' sel':''}`} onClick={()=>setMethod(m)}>
                    <div className="m-icon"><MethodIcon method={m}/></div>
                    <div className="m-label">{m}</div>
                  </button>
                ))}
              </div>

              <label className="field-label">Uploaded By</label>
              <input type="text" className="txt-input" value={uploaderName} onChange={e=>setUploaderName(e.target.value)} required/>
              <label className="field-label">Note for Finance <span style={{color:'#bbb',fontWeight:400}}>(optional)</span></label>
              <textarea className="note-textarea" rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. This is for order #445, client John Smith..."/>
              <button type="submit" className="submit-btn" disabled={!file||loading}>Verify Payment →</button>
            </form>
          </div>
        )}

        {loading && (
          <div className="loading-card">
            <div className="spinner"/>
            <div className="loading-label">{STEPS[step]}</div>
            <div className="step-track">{STEPS.map((_,i)=><div key={i} className={`step-dot${i<=step?' done':''}`}/>)}</div>
          </div>
        )}

        {result && !loading && (
          <div style={{ borderRadius:'18px', boxShadow:'0 2px 20px rgba(0,0,0,0.09)', overflow:'hidden', border:`1.5px solid ${meta.border}` }}>
            <div className="result-header" style={{ background:meta.lightBg }}>
              <div className="result-icon">{meta.icon}</div>
              <div className="result-title" style={{ color:meta.accent }}>{meta.label}</div>
              {result.message && <div className="result-pill" style={{ background:meta.badgeBg, color:meta.badgeText }}>{result.message}</div>}
              {result.similarity!=null && <div className="sim-note">{result.similarity}% visual similarity</div>}
            </div>
            <div className="result-body">
              {result.details && (
                <>
                  <div className="section-label">{result.status==='verified'?'Payment Details':'Submitted Screenshot'}</div>
                  <div className="detail-box">
                    <DetailRow label="Amount" value={result.details.amount}/>
                    <DetailRow label="Sender" value={result.details.sender_name}/>
                    <DetailRow label="Transaction ID" value={result.details.transaction_id}/>
                    <DetailRow label="Memo" value={result.details.memo}/>
                    <DetailRow label="Date / Time" value={result.details.date_time}/>
                    <DetailRow label="App" value={result.details.payment_app}/>
                  </div>
                </>
              )}
              {result.original && (
                <>
                  <div className="section-label">Already on Record</div>
                  <div className="orig-box" style={{ background:meta.lightBg, border:`1.5px solid ${meta.border}` }}>
                    <DetailRow label="Amount" value={result.original.amount}/>
                    <DetailRow label="Sender" value={result.original.sender_name}/>
                    <DetailRow label="Memo" value={result.original.memo}/>
                    <DetailRow label="Date / Time" value={result.original.date_time}/>
                    <DetailRow label="Method" value={result.original.payment_method}/>
                    <DetailRow label="Uploaded By" value={result.original.uploaded_by}/>
                    <DetailRow label="Uploaded On" value={result.original.created_at ? new Date(result.original.created_at).toLocaleString() : null}/>
                    {result.original.screenshot_url && <a href={result.original.screenshot_url} target="_blank" rel="noopener noreferrer" className="orig-link">🖼️ View original screenshot ↗</a>}
                  </div>
                </>
              )}
              {result.status === 'duplicate' || result.status === 'suspicious' ? (
                <>
                  {result.original?.rejection_reason && (
                    <div className="reject-banner">
                      <div className="reject-banner-label">Rejection Reason</div>
                      <div className="reject-banner-text">{result.original.rejection_reason}</div>
                    </div>
                  )}
                  <button className="reupload-btn" onClick={() => reset(result.details?.payment_app)}>↑ Re-upload Corrected Screenshot</button>
                  <button className="reset-btn" onClick={reset} style={{marginTop:'8px'}}>+ Upload Different Payment</button>
                </>
              ) : (
                <button className="reset-btn" onClick={reset}>+ Verify Another Payment</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
