import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const METHODS = ['CashApp','Chime','Zelle','TapTap','Venmo','PayPal']
const METHOD_COLORS = { CashApp:'#00D64F', Chime:'#1EC677', Zelle:'#6D1ED4', TapTap:'#FF4E00', Venmo:'#3D95CE', PayPal:'#003087' }
const METHOD_PREFIX = { CashApp:'$', Chime:'$', Zelle:'', TapTap:'', Venmo:'@', PayPal:'' }

export default function Tags() {
  const [tags, setTags] = useState([])
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [editingMethod, setEditingMethod] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [requesting, setRequesting] = useState(null)
  const [toast, setToast] = useState(null)
  const router = useRouter()

  useEffect(() => { init() }, [])

  const showToast = (msg,type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  const init = async () => {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data:prof } = await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle()
    setProfile(prof||{email:user.email,role:'agent',payment_methods:[]})
    loadTags(); loadRequests()
    supabase.channel('tags-ch')
      .on('postgres_changes',{event:'*',schema:'public',table:'tags'},loadTags)
      .on('postgres_changes',{event:'*',schema:'public',table:'tag_requests'},loadRequests)
      .subscribe()
  }

  const loadTags = async () => { const {data}=await supabase.from('tags').select('*'); if(data) setTags(data) }
  const loadRequests = async () => { const {data}=await supabase.from('tag_requests').select('*').eq('status','pending'); if(data) setRequests(data) }

  const getTag = (m) => tags.find(t=>t.payment_method===m)
  const isFinanceFor = (m) => !profile?false:profile.role==='admin'?true:profile.role==='finance'&&(profile.payment_methods?.includes(m)||!profile.payment_methods?.length)
  const pendingFor = (m) => requests.filter(r=>r.payment_method===m)

  const startEdit = (m) => { const t=getTag(m); setEditingMethod(m); setEditValue(t?.tag_value||''); setEditLabel(t?.tag_label||'') }

  const saveTag = async () => {
    if (!editValue.trim()) return
    setSaving(true)
    const old = getTag(editingMethod)
    await supabase.from('tags').upsert({payment_method:editingMethod,tag_value:editValue.trim(),tag_label:editLabel.trim(),updated_by:profile.email,updated_at:new Date().toISOString(),is_active:true},{onConflict:'payment_method'})
    if (old?.tag_value!==editValue.trim()) {
      await supabase.from('tag_history').insert({payment_method:editingMethod,old_value:old?.tag_value,new_value:editValue.trim(),changed_by:profile.email})
    }
    const {data:agents}=await supabase.from('profiles').select('email').eq('role','agent')
    if (agents) await supabase.from('notifications').insert(agents.map(a=>({recipient_email:a.email,type:'tag_updated',title:`${editingMethod} Tag Updated`,message:`The ${editingMethod} payment tag has been updated to: ${editValue.trim()}`})))
    const pending=requests.filter(r=>r.payment_method===editingMethod)
    for (const req of pending) {
      await supabase.from('tag_requests').update({status:'fulfilled',fulfilled_at:new Date().toISOString(),fulfilled_by:profile.email}).eq('id',req.id)
      await supabase.from('notifications').insert({recipient_email:req.requested_by,type:'tag_updated',title:`${editingMethod} Tag Available`,message:`Your tag request for ${editingMethod} has been fulfilled: ${editValue.trim()}`})
    }
    setSaving(false); setEditingMethod(null)
    showToast(`${editingMethod} tag updated`)
  }

  const requestTag = async (m) => {
    setRequesting(m)
    const {data:ex}=await supabase.from('tag_requests').select('*').eq('payment_method',m).eq('requested_by',profile.email).eq('status','pending').maybeSingle()
    if (ex) { showToast('Already requested','info'); setRequesting(null); return }
    await supabase.from('tag_requests').insert({payment_method:m,requested_by:profile.email})
    const {data:fin}=await supabase.from('profiles').select('email').eq('role','finance')
    if (fin?.length) await supabase.from('notifications').insert(fin.map(f=>({recipient_email:f.email,type:'tag_requested',title:`Tag Request: ${m}`,message:`${profile.email} is requesting the ${m} payment tag.`})))
    setRequesting(null); showToast(`Tag request sent for ${m}`)
  }

  return (
    <Layout title="Payment Tags">
      <style>{`
        .tags-intro{background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:#1d4ed8;line-height:1.6}
        .tags-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
        .tag-card{background:var(--card);border-radius:16px;border:1px solid var(--border);box-shadow:0 1px 6px rgba(0,0,0,0.05);overflow:hidden;transition:box-shadow 0.2s}
        .tag-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.1)}
        .tag-card-header{padding:16px 18px 12px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f1f5f9}
        .method-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .method-name{font-size:15px;font-weight:800;color:#0f172a}
        .tag-card-body{padding:14px 18px 16px}
        .tag-value-box{background:var(--bg);border:1.5px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px}
        .tag-value{font-size:20px;font-weight:800;color:var(--text);letter-spacing:-0.3px}
        .tag-label-text{font-size:11px;color:#94a3b8;margin-top:3px}
        .tag-updated{font-size:10px;color:#cbd5e1;margin-top:4px}
        .no-tag-box{background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:12px}
        .pending-badge{background:#fff5f5;border:1.5px solid #fecaca;border-radius:8px;padding:8px 12px;margin-bottom:10px}
        .pending-badge-label{font-size:10px;font-weight:800;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px}
        .pending-badge-item{font-size:11px;color:var(--text-muted);margin-top:2px}
        .copy-btn{width:100%;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:#2563eb;cursor:pointer;font-family:'Inter',sans-serif;transition:all 0.15s;margin-bottom:8px}
        .copy-btn:hover{background:#eff6ff;border-color:#93c5fd}
        .request-btn{width:100%;background:#fffbeb;border:1.5px solid #fde68a;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:#b45309;cursor:pointer;font-family:'Inter',sans-serif;transition:all 0.15s}
        .request-btn:hover{background:#fef9c3}
        .request-btn:disabled{opacity:0.5;cursor:not-allowed}
        .edit-btn{width:100%;background:#0f172a;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;font-family:'Inter',sans-serif;transition:background 0.15s;margin-bottom:8px}
        .edit-btn:hover{background:#1e293b}
        .reqs-section{margin-top:28px}
        .reqs-title{font-size:15px;font-weight:800;color:var(--text);margin-bottom:14px}
        .req-card{background:var(--card);border:1.5px solid #fecaca;border-radius:12px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
        .fulfill-btn{background:#dcfce7;border:1.5px solid #bbf7d0;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;color:#15803d;cursor:pointer;font-family:'Inter',sans-serif;white-space:nowrap}
        .fulfill-btn:hover{background:#bbf7d0}
        .overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
        .modal{background:var(--card);border-radius:20px;padding:32px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
        .modal-title{font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px}
        .modal-sub{font-size:13px;color:#94a3b8;margin-bottom:22px}
        .modal-label{font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:7px;display:block;text-transform:uppercase;letter-spacing:0.4px}
        .modal-input{width:100%;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;padding:13px 15px;color:var(--text);font-size:16px;font-family:'Inter',sans-serif;outline:none;transition:border-color 0.2s;margin-bottom:14px;font-weight:700}
        .modal-input:focus{border-color:#3b82f6;background:#fff}
        .modal-actions{display:flex;gap:10px;margin-top:4px}
        .btn-save{flex:1;background:#1d4ed8;border:none;border-radius:10px;padding:13px;color:#fff;font-size:14px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;transition:background 0.2s}
        .btn-save:hover:not(:disabled){background:#1e40af}
        .btn-save:disabled{opacity:0.5;cursor:not-allowed}
        .btn-cancel{flex:1;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;padding:13px;color:var(--text-muted);font-size:14px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer}
        .toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:999;box-shadow:0 4px 20px rgba(0,0,0,0.15);animation:slidein 0.3s ease}
        .toast.success{background:#0f172a;color:#fff}
        .toast.info{background:#2563eb;color:#fff}
        @keyframes slidein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {profile?.role==='agent' && (
        <div className="tags-intro">
          💡 <strong>How to use:</strong> Find the payment method tag below, copy it, then send your payment to that address. After sending, go to <strong>Verify Payment</strong> to upload your screenshot.
        </div>
      )}

      <div className="tags-grid">
        {METHODS.map(m=>{
          const tag=getTag(m)
          const hasTag=tag?.tag_value
          const isFin=isFinanceFor(m)
          const pending=pendingFor(m)
          const color=METHOD_COLORS[m]
          const prefix=METHOD_PREFIX[m]
          return (
            <div key={m} className="tag-card">
              <div className="tag-card-header">
                <div className="method-dot" style={{background:color}}/>
                <div className="method-name">{m}</div>
              </div>
              <div className="tag-card-body">
                {hasTag ? (
                  <div className="tag-value-box">
                    <div className="tag-value">{prefix}{tag.tag_value}</div>
                    {tag.tag_label&&<div className="tag-label-text">{tag.tag_label}</div>}
                    {tag.updated_at&&<div className="tag-updated">Updated {new Date(tag.updated_at).toLocaleString()} · {tag.updated_by}</div>}
                  </div>
                ) : (
                  <div className="no-tag-box">
                    <div style={{fontSize:'13px',color:'#92400e',fontWeight:'600'}}>⚠️ No tag set yet</div>
                    <div style={{fontSize:'11px',color:'#b45309',marginTop:'3px'}}>Finance has not set a tag for this method</div>
                  </div>
                )}

                {isFin&&pending.length>0&&(
                  <div className="pending-badge">
                    <div className="pending-badge-label">🔔 {pending.length} request{pending.length>1?'s':''}</div>
                    {pending.map(r=><div key={r.id} className="pending-badge-item">↳ {r.requested_by}</div>)}
                  </div>
                )}

                {!isFin&&(
                  <>
                    {hasTag&&<button className="copy-btn" onClick={()=>{navigator.clipboard.writeText(prefix+tag.tag_value);showToast('Tag copied!')}}>📋 Copy Tag</button>}
                    <button className="request-btn" disabled={requesting===m} onClick={()=>requestTag(m)}>
                      {requesting===m?'Requesting...':hasTag?'🔄 Request Update':'📨 Request Tag'}
                    </button>
                  </>
                )}

                {isFin&&(
                  <button className="edit-btn" onClick={()=>startEdit(m)}>✏️ {hasTag?'Update Tag':'Set Tag'}</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {profile?.role!=='agent'&&requests.length>0&&(
        <div className="reqs-section">
          <div className="reqs-title">📨 Pending Tag Requests ({requests.length})</div>
          {requests.map(r=>(
            <div key={r.id} className="req-card">
              <div>
                <div style={{fontWeight:'700',color:'#dc2626',fontSize:'13px'}}>{r.payment_method} tag requested</div>
                <div style={{fontSize:'12px',color:'#94a3b8',marginTop:'3px'}}>by {r.requested_by}</div>
                <div style={{fontSize:'11px',color:'#cbd5e1',marginTop:'2px'}}>{new Date(r.requested_at).toLocaleString()}</div>
              </div>
              {isFinanceFor(r.payment_method)&&<button className="fulfill-btn" onClick={()=>startEdit(r.payment_method)}>Set Tag →</button>}
            </div>
          ))}
        </div>
      )}

      {editingMethod&&(
        <div className="overlay" onClick={()=>setEditingMethod(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Update {editingMethod} Tag</div>
            <div className="modal-sub">All agents will be notified immediately when you save</div>
            <label className="modal-label">{editingMethod} Tag / Handle</label>
            <input className="modal-input" value={editValue} onChange={e=>setEditValue(e.target.value)}
              placeholder={editingMethod==='CashApp'?'$cashtag':editingMethod==='Venmo'?'@username':editingMethod==='Zelle'?'email or phone':'tag / handle'}
              autoFocus/>
            <label className="modal-label">Label <span style={{color:'#cbd5e1',fontWeight:400,textTransform:'none'}}>(optional)</span></label>
            <input className="modal-input" style={{fontSize:'14px',fontWeight:'400'}} value={editLabel} onChange={e=>setEditLabel(e.target.value)} placeholder="e.g. Main Finance Account"/>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={()=>setEditingMethod(null)}>Cancel</button>
              <button className="btn-save" onClick={saveTag} disabled={saving||!editValue.trim()}>{saving?'Saving...':'Save & Notify'}</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </Layout>
  )
}
