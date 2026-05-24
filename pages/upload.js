import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const METHODS = ['CashApp','Chime','Zelle','TapTap','Venmo','PayPal','Other']
const METHOD_COLORS = { CashApp:'#00D64F', Chime:'#1EC677', Zelle:'#6D1ED4', TapTap:'#FF4E00', Venmo:'#3D95CE', PayPal:'#003087', Other:'#64748B' }
const METHOD_LETTERS = { CashApp:'$', Chime:'C', Zelle:'Z', TapTap:'T', Venmo:'V', PayPal:'P', Other:'?' }
const STEPS = ['Uploading image...','Running AI extraction...','Checking for duplicates...','Finalizing result...']

function MethodIcon({ method, size=32 }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <rect width="40" height="40" rx="10" fill={METHOD_COLORS[method]||'#64748B'}/>
      <text x="20" y="27" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white" fontFamily="Arial">{METHOD_LETTERS[method]}</text>
    </svg>
  )
}

function DetailRow({ label, value }) {
  if (!value||value==='UNKNOWN'||value==='N/A') return null
  return (
    <div style={{display:'flex',justifyContent:'space-between',gap:'16px',padding:'9px 0',borderBottom:'1px solid #f1f5f9'}}>
      <span style={{color:'#94a3b8',fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.5px',whiteSpace:'nowrap',fontWeight:600}}>{label}</span>
      <span style={{color:'#0f172a',fontSize:'13px',fontWeight:'600',textAlign:'right'}}>{value}</span>
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
  const [expectedAmount, setExpectedAmount] = useState('')
  const fileRef = useRef(null)
  const router = useRouter()

  useEffect(() => { init() }, [])
  useEffect(() => {
    const paste = (e) => {
      for (const item of e.clipboardData?.items||[])
        if (item.type.startsWith('image/')) { handleFile(item.getAsFile()); break }
    }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  }, [])
  useEffect(() => {
    let t
    if (loading) { setStep(0); t = setInterval(()=>setStep(s=>s<STEPS.length-1?s+1:s),1800) }
    return () => clearInterval(t)
  }, [loading])

  const init = async () => {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUploaderName(user.email)
    const { data:prof } = await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
    if (prof?.role==='finance') { router.replace('/finance'); return }
    if (prof?.role==='admin') { router.replace('/dashboard'); return }
  }

  const handleFile = (f) => { if (!f||!f.type.startsWith('image/')) return; setFile(f); setPreview(URL.createObjectURL(f)); setResult(null) }

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!file) return
    setLoading(true); setResult(null)
    const fd = new FormData()
    fd.append('file',file); fd.append('paymentMethod',method); fd.append('uploaderName',uploaderName); fd.append('note',note)
    try { const r = await fetch('/api/verify',{method:'POST',body:fd}); setResult(await r.json()) }
    catch { setResult({status:'error',message:'Connection failed. Please try again.'}) }
    setLoading(false)
  }

  const reset = (m) => { setFile(null); setPreview(null); setResult(null); setNote(''); setExpectedAmount(''); if(m) setMethod(m) }

  const S = {
    verified:   {icon:'✅',label:'Payment Verified',    color:'#16a34a',bg:'#f0fdf4',border:'#bbf7d0',pBg:'#dcfce7',pColor:'#15803d'},
    duplicate:  {icon:'❌',label:'Duplicate Detected',  color:'#dc2626',bg:'#fff5f5',border:'#fecaca',pBg:'#fee2e2',pColor:'#dc2626'},
    suspicious: {icon:'⚠️',label:'Needs Manual Review', color:'#d97706',bg:'#fffbeb',border:'#fde68a',pBg:'#fef9c3',pColor:'#b45309'},
    error:      {icon:'🚫',label:'Error',               color:'#64748b',bg:'#f8fafc',border:'#e2e8f0',pBg:'#f1f5f9',pColor:'#475569'},
  }
  const meta = S[result?.status]||S.error

  return (
    <Layout title="Verify Payment">
      <style>{`
        .upload-grid{display:grid;grid-template-columns:1fr 380px;gap:24px;max-width:1000px}
        @media(max-width:900px){.upload-grid{grid-template-columns:1fr}}
        .card{background:#fff;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 1px 6px rgba(0,0,0,0.05);overflow:hidden}
        .card-head{padding:20px 24px 0}
        .card-title{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:3px}
        .card-sub{font-size:12px;color:#94a3b8;margin-bottom:20px}
        .card-body{padding:0 24px 24px}
        .drop-zone{border:2px dashed #cbd5e1;border-radius:12px;padding:32px 20px;text-align:center;cursor:pointer;transition:all 0.2s;background:#f8fafc;position:relative}
        .drop-zone.over{border-color:#3b82f6;background:#eff6ff}
        .drop-zone:hover{border-color:#94a3b8}
        .preview-img{max-height:200px;border-radius:8px;border:1px solid #e2e8f0}
        .change-btn{position:absolute;top:10px;right:10px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;color:#64748b;font-size:11px;padding:5px 10px;cursor:pointer;font-family:'Inter',sans-serif;font-weight:500}
        .change-btn:hover{border-color:#3b82f6;color:#3b82f6}
        .field-label{font-size:11px;font-weight:700;color:#475569;letter-spacing:0.5px;margin-bottom:8px;display:block;margin-top:16px;text-transform:uppercase}
        .method-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
        @media(max-width:480px){.method-grid{grid-template-columns:repeat(2,1fr)}}
        .m-btn{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 4px;text-align:center;cursor:pointer;transition:all 0.15s;font-family:'Inter',sans-serif}
        .m-btn:hover{border-color:#94a3b8;background:#f1f5f9}
        .m-btn.sel{border-color:#3b82f6;background:#eff6ff}
        .m-icon{display:flex;align-items:center;justify-content:center;margin-bottom:4px}
        .m-label{font-size:10px;color:#64748b;font-weight:600}
        .m-btn.sel .m-label{color:#2563eb}
        .txt-input{width:100%;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:11px 14px;color:#0f172a;font-size:13px;font-family:'Inter',sans-serif;outline:none;transition:border-color 0.2s}
        .txt-input:focus{border-color:#3b82f6;background:#fff}
        .note-input{width:100%;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:11px 14px;color:#0f172a;font-size:13px;font-family:'Inter',sans-serif;outline:none;transition:border-color 0.2s;resize:none}
        .note-input:focus{border-color:#3b82f6;background:#fff}
        .submit-btn{width:100%;background:#1d4ed8;border:none;border-radius:10px;padding:14px;color:#fff;font-size:14px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.2s;margin-top:20px}
        .submit-btn:hover:not(:disabled){background:#1e40af;transform:translateY(-1px);box-shadow:0 4px 12px rgba(29,78,216,0.3)}
        .submit-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;box-shadow:none}
        .loading-wrap{background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:60px 36px;text-align:center;max-width:480px;margin:0 auto}
        .spinner{width:44px;height:44px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 20px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .step-track{display:flex;justify-content:center;gap:6px;margin-top:16px}
        .step-dot{width:7px;height:7px;border-radius:50%;background:#e2e8f0;transition:background 0.3s}
        .step-dot.done{background:#2563eb}
        .result-wrap{border-radius:16px;overflow:hidden;border:1.5px solid;max-width:560px;margin:0 auto}
        .result-top{padding:28px 28px 20px;text-align:center}
        .result-icon-big{font-size:52px;margin-bottom:10px}
        .result-heading{font-size:20px;font-weight:800;letter-spacing:-0.5px}
        .result-pill{display:inline-block;padding:8px 18px;border-radius:30px;font-size:13px;font-weight:600;margin-top:10px}
        .result-body{background:#fff;padding:20px 24px 24px}
        .s-head{font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;margin-top:18px}
        .s-head:first-child{margin-top:0}
        .d-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px}
        .o-box{border-radius:10px;padding:12px 16px}
        .orig-link{display:inline-flex;align-items:center;gap:5px;color:#2563eb;font-size:13px;text-decoration:none;margin-top:10px;font-weight:500}
        .orig-link:hover{text-decoration:underline}
        .reset-btn{width:100%;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px;color:#475569;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.2s;margin-top:10px}
        .reset-btn:hover{background:#eff6ff;border-color:#93c5fd;color:#2563eb}
        .reupload-btn{width:100%;background:#1d4ed8;border:none;border-radius:10px;padding:12px;color:#fff;font-size:13px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;margin-top:12px;transition:background 0.2s}
        .reupload-btn:hover{background:#1e40af}
        .help-card{background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:20px}
        .check-item{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9}
        .check-item:last-child{border-bottom:none}
        .tip-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px;margin-bottom:20px}
      `}</style>

      {!loading && !result && (
        <div className="upload-grid">
          <div>
            <div className="tip-box">
              <div style={{fontSize:'12px',color:'#1d4ed8',lineHeight:'1.6'}}>
                📋 <strong>How it works:</strong> Upload a payment screenshot → AI extracts details → checks for duplicates → finance team gets notified for approval.
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <div className="card-title">Upload Payment Screenshot</div>
                <div className="card-sub">Drag & drop, click to browse, or press Ctrl+V to paste</div>
              </div>
              <div className="card-body">
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
                        <div style={{fontSize:'32px',marginBottom:'8px'}}>📸</div>
                        <div style={{color:'#475569',fontSize:'14px',fontWeight:'500'}}><span style={{color:'#3b82f6'}}>Click to upload</span> or drag & drop</div>
                        <div style={{color:'#94a3b8',fontSize:'12px',marginTop:'5px'}}>PNG, JPG up to 10MB · Ctrl+V to paste</div>
                      </>
                    )}
                  </div>

                  <label className="field-label">Payment Method</label>
                  <div className="method-grid">
                    {METHODS.map(m=>(
                      <button key={m} type="button" className={`m-btn${method===m?' sel':''}`} onClick={()=>setMethod(m)}>
                        <div className="m-icon"><MethodIcon method={m} size={28}/></div>
                        <div className="m-label">{m}</div>
                      </button>
                    ))}
                  </div>

                  <label className="field-label">Your Email</label>
                  <input type="text" className="txt-input" value={uploaderName} onChange={e=>setUploaderName(e.target.value)} required/>

                  <label className="field-label">Expected Amount <span style={{color:'#cbd5e1',textTransform:'none',fontWeight:400,fontSize:'11px'}}>(optional — for mismatch detection)</span></label>
                  <input type="text" className="txt-input" style={{marginBottom:'16px'}} value={expectedAmount} onChange={e=>setExpectedAmount(e.target.value)} placeholder="e.g. $25.00"/>
                  <label className="field-label">Note for Finance <span style={{color:'#cbd5e1',textTransform:'none',fontWeight:400,fontSize:'11px'}}>(optional)</span></label>
                  <textarea className="note-input" rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Order #445 for client John Smith..."/>

                  <button type="submit" className="submit-btn" disabled={!file||loading}>🔍 Verify Payment</button>
                </form>
              </div>
            </div>
          </div>

          <div>
            <div className="help-card">
              <div style={{fontSize:'13px',fontWeight:'700',color:'#0f172a',marginBottom:'14px'}}>🔍 Detection Checks</div>
              {[
                {icon:'🔷',l:'Exact duplicate',d:'Catches byte-identical screenshots instantly'},
                {icon:'🤖',l:'AI extraction',d:'Reads amount, sender, date from image'},
                {icon:'📅',l:'Age check',d:'Flags screenshots older than 48 hours'},
                {icon:'🔑',l:'Transaction ID',d:'Matches existing transaction IDs in DB'},
                {icon:'👤',l:'Sender + Amount',d:'Flags same sender sending same amount'},
                {icon:'👁️',l:'Visual match',d:'Catches cropped or resized screenshots'},
              ].map(c=>(
                <div key={c.l} className="check-item">
                  <span style={{fontSize:'16px',flexShrink:0,marginTop:'1px'}}>{c.icon}</span>
                  <div>
                    <div style={{fontSize:'12px',fontWeight:'700',color:'#0f172a'}}>{c.l}</div>
                    <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'2px'}}>{c.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-wrap">
          <div className="spinner"/>
          <div style={{fontSize:'14px',color:'#475569',fontWeight:'500'}}>{STEPS[step]}</div>
          <div className="step-track">{STEPS.map((_,i)=><div key={i} className={`step-dot${i<=step?' done':''}`}/>)}</div>
        </div>
      )}

      {result && !loading && (
        <div className="result-wrap" style={{borderColor:meta.border}}>
          <div className="result-top" style={{background:meta.bg}}>
            <div className="result-icon-big">{meta.icon}</div>
            <div className="result-heading" style={{color:meta.color}}>{meta.label}</div>
            {result.message && <div className="result-pill" style={{background:meta.pBg,color:meta.pColor}}>{result.message}</div>}
            {result.fraudScore != null && (
              <div style={{marginTop:'12px',display:'inline-flex',alignItems:'center',gap:'10px',background:'#f8fafc',border:'1.5px solid #e2e8f0',borderRadius:'12px',padding:'10px 16px'}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'24px',fontWeight:'800',color:result.fraudScore>=80?'#16a34a':result.fraudScore>=50?'#d97706':'#dc2626'}}>{result.fraudScore}</div>
                  <div style={{fontSize:'10px',color:'#94a3b8',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.5px'}}>Fraud Score</div>
                </div>
                <div style={{width:'1px',height:'36px',background:'#e2e8f0'}}/>
                <div style={{fontSize:'12px',color:'#64748b'}}>
                  {result.fraudScore>=80?'✅ Low risk payment':''}
                  {result.fraudScore>=50&&result.fraudScore<80?'⚠️ Moderate risk':''}
                  {result.fraudScore<50?'🚨 High risk — review carefully':''}
                </div>
              </div>
            )}
            {result.similarity!=null && <div style={{fontSize:'12px',color:'#94a3b8',marginTop:'6px'}}>{result.similarity}% visual similarity</div>}
            {result.ruleFlags?.length>0 && (
              <div style={{marginTop:'10px',background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:'10px',padding:'10px 14px',textAlign:'left'}}>
                <div style={{fontSize:'11px',fontWeight:'800',color:'#b45309',marginBottom:'5px'}}>⚙️ Rule Flags</div>
                {result.ruleFlags.map((f,i)=><div key={i} style={{fontSize:'12px',color:'#92400e'}}>• {f}</div>)}
              </div>
            )}
          </div>
          <div className="result-body">
            {result.details && (
              <>
                <div className="s-head">{result.status==='verified'?'Payment Details':'Submitted Screenshot'}</div>
                <div className="d-box">
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
                <div className="s-head">Already on Record</div>
                <div className="o-box" style={{background:meta.bg,border:`1.5px solid ${meta.border}`}}>
                  <DetailRow label="Amount" value={result.original.amount}/>
                  <DetailRow label="Sender" value={result.original.sender_name}/>
                  <DetailRow label="Uploaded By" value={result.original.uploaded_by}/>
                  <DetailRow label="Uploaded On" value={result.original.created_at?new Date(result.original.created_at).toLocaleString():null}/>
                  {result.original.screenshot_url && <a href={result.original.screenshot_url} target="_blank" rel="noopener noreferrer" className="orig-link">🖼️ View original ↗</a>}
                </div>
              </>
            )}
            {result.status==='verified'
              ? <button className="reset-btn" onClick={reset}>+ Verify Another Payment</button>
              : <>
                  <button className="reupload-btn" onClick={()=>reset(result.details?.payment_app)}>↑ Re-upload Corrected Screenshot</button>
                  <button className="reset-btn" onClick={reset}>+ Verify Different Payment</button>
                </>
            }
          </div>
        </div>
      )}
    </Layout>
  )
}
