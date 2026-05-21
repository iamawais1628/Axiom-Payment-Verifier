import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Finance() {
  const [payments, setPayments] = useState([])
  const [profile, setProfile] = useState(null)
  const [selected, setSelected] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)
  const [filter, setFilter] = useState('pending_review')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkActing, setBulkActing] = useState(false)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { init() }, [])

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  const init = async () => {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data:prof } = await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle()
    if (!prof || (prof.role!=='finance' && prof.role!=='admin')) {
      router.replace('/upload'); return
    }
    setProfile(prof)
    loadPayments(prof)
    supabase.channel('finance-ch')
      .on('postgres_changes',{event:'*',schema:'public',table:'payments'},()=>loadPayments(prof))
      .subscribe()
  }

  const loadPayments = async (prof) => {
    let q = supabase.from('payments').select('*').order('created_at',{ascending:false})
    if (prof?.role==='finance'&&prof?.payment_methods?.length>0)
      q = q.in('payment_method', prof.payment_methods)
    const {data} = await q
    if (data) setPayments(data)
    setLoading(false)
  }

  const handleDecision = async (decision) => {
    if (!selected) return
    setActing(true)
    await supabase.from('payments').update({
      approval_status: decision,
      reviewed_by: profile.email,
      reviewed_at: new Date().toISOString(),
      rejection_reason: decision==='rejected' ? rejectReason : null,
    }).eq('id', selected.id)

    await supabase.from('notifications').insert({
      recipient_email: selected.agent_email||selected.uploaded_by,
      type: decision==='approved'?'payment_approved':'payment_rejected',
      title: decision==='approved'?'Payment Approved ✅':'Payment Rejected ❌',
      message: decision==='approved'
        ? `Your ${selected.payment_method} payment of ${selected.amount} has been approved.`
        : `Your ${selected.payment_method} payment of ${selected.amount} was rejected. Reason: ${rejectReason||'No reason provided'}`,
      related_id: selected.id,
    })

    fetch('/api/slack-notify',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:decision==='approved'?'payment_approved':'payment_rejected',
        data:{method:selected.payment_method,amount:selected.amount,agent:selected.uploaded_by,reviewer:profile.email,reason:rejectReason}})
    }).catch(()=>{})

    setActing(false); setSelected(null); setRejectReason('')
    showToast(`Payment ${decision} successfully`)
  }

  const toggleSelect = (id) => setSelectedIds(p => p.includes(id)?p.filter(x=>x!==id):[...p,id])

  const bulkApprove = async () => {
    if (selectedIds.length===0) return
    setBulkActing(true)
    for (const id of selectedIds) {
      const p = payments.find(x=>x.id===id)
      if (!p) continue
      await supabase.from('payments').update({approval_status:'approved',reviewed_by:profile.email,reviewed_at:new Date().toISOString()}).eq('id',id)
      await supabase.from('notifications').insert({recipient_email:p.agent_email||p.uploaded_by,type:'payment_approved',title:'Payment Approved ✅',message:`Your ${p.payment_method} payment of ${p.amount} has been approved.`,related_id:p.id})
    }
    setSelectedIds([])
    setBulkActing(false)
    showToast(`${selectedIds.length} payments approved`)
  }

  const filtered = payments.filter(p => {
    const matchFilter = filter==='all'||(p.approval_status||'pending_review')===filter
    const matchSearch = !search||JSON.stringify(p).toLowerCase().includes(search.toLowerCase())
    return matchFilter&&matchSearch
  })

  const counts = {
    pending_review: payments.filter(p=>(p.approval_status||'pending_review')==='pending_review').length,
    approved: payments.filter(p=>p.approval_status==='approved').length,
    rejected: payments.filter(p=>p.approval_status==='rejected').length,
  }

  const SS = {
    pending_review: {bg:'#fffbeb',color:'#b45309',border:'#fde68a',label:'Pending'},
    approved:       {bg:'#f0fdf4',color:'#15803d',border:'#bbf7d0',label:'Approved'},
    rejected:       {bg:'#fff5f5',color:'#dc2626',border:'#fecaca',label:'Rejected'},
  }

  return (
    <Layout title="Finance Review Queue">
      <style>{`
        .stats-row{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
        .stat-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px 20px;flex:1;min-width:120px;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
        .stat-num{font-size:28px;font-weight:800;line-height:1}
        .stat-lbl{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.7px;margin-top:5px;font-weight:600}
        .bulk-bar{background:#0f172a;border-radius:12px;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:12px;flex-wrap:wrap}
        .controls{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
        .search-inp{flex:1;min-width:200px;background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 14px;color:#0f172a;font-size:13px;font-family:'Inter',sans-serif;outline:none;transition:border-color 0.2s}
        .search-inp:focus{border-color:#3b82f6}
        .filter-tabs{display:flex;gap:6px;flex-wrap:wrap}
        .ftab{padding:8px 16px;border-radius:30px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;font-family:'Inter',sans-serif;transition:all 0.15s}
        .ftab.active{background:#0f172a;color:#fff;border-color:#0f172a}
        .table-wrap{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 6px rgba(0,0,0,0.05)}
        .tbl{width:100%;border-collapse:collapse;font-size:13px}
        .tbl thead tr{background:#f8fafc}
        .tbl th{padding:12px 16px;text-align:left;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;border-bottom:1.5px solid #e2e8f0}
        .tbl td{padding:13px 16px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:middle}
        .tbl tr:last-child td{border-bottom:none}
        .tbl tbody tr:hover td{background:#f8fafc;cursor:pointer}
        .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px}
        .empty{text-align:center;padding:60px;color:#cbd5e1;font-size:14px}
        .overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
        .modal{background:#fff;border-radius:20px;padding:32px;width:100%;max-width:600px;box-shadow:0 20px 60px rgba(0,0,0,0.2);max-height:90vh;overflow-y:auto}
        .modal-title{font-size:18px;font-weight:800;color:#0f172a;margin-bottom:20px}
        .d-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #f1f5f9}
        .d-lbl{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;font-weight:700}
        .d-val{font-size:13px;color:#0f172a;font-weight:600;text-align:right}
        .ss-img{width:100%;max-height:300px;object-fit:contain;border-radius:10px;border:1.5px solid #e2e8f0;margin-top:12px;cursor:pointer}
        .ss-img:hover{border-color:#3b82f6}
        .note-box{background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:12px 14px;margin-top:12px}
        .decision-sec{margin-top:20px;padding-top:20px;border-top:1.5px solid #f1f5f9}
        .decision-label{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px}
        .reject-inp{width:100%;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:11px 14px;color:#0f172a;font-size:13px;font-family:'Inter',sans-serif;outline:none;margin-bottom:12px;resize:none}
        .reject-inp:focus{border-color:#3b82f6}
        .action-btns{display:flex;gap:10px}
        .btn-approve{flex:1;background:#16a34a;border:none;border-radius:10px;padding:13px;color:#fff;font-size:14px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;transition:background 0.2s}
        .btn-approve:hover:not(:disabled){background:#15803d}
        .btn-reject{flex:1;background:#dc2626;border:none;border-radius:10px;padding:13px;color:#fff;font-size:14px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;transition:background 0.2s}
        .btn-reject:hover:not(:disabled){background:#b91c1c}
        .btn-approve:disabled,.btn-reject:disabled{opacity:0.5;cursor:not-allowed}
        .already-done{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:20px;text-align:center;color:#64748b;font-size:13px}
        .btn-close{width:100%;margin-top:10px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px;color:#64748b;font-size:13px;font-family:'Inter',sans-serif;cursor:pointer;font-weight:600}
        .toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:999;box-shadow:0 4px 20px rgba(0,0,0,0.15);animation:slidein 0.3s ease}
        .toast.success{background:#0f172a;color:#fff}
        .toast.error{background:#dc2626;color:#fff}
        @keyframes slidein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .row-cb{width:16px;height:16px;cursor:pointer;accent-color:#2563eb}
        .bulk-approve-btn{background:#16a34a;border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;padding:8px 20px;cursor:pointer;font-family:'Inter',sans-serif;transition:background 0.2s}
        .bulk-approve-btn:hover:not(:disabled){background:#15803d}
        .bulk-approve-btn:disabled{opacity:0.5;cursor:not-allowed}
        .bulk-clear-btn{background:none;border:1px solid #1e293b;border-radius:8px;color:#94a3b8;font-size:12px;padding:7px 14px;cursor:pointer;font-family:'Inter',sans-serif}
      `}</style>

      {/* Stats */}
      <div className="stats-row">
        {[
          {label:'Pending', count:counts.pending_review, color:'#d97706'},
          {label:'Approved', count:counts.approved, color:'#16a34a'},
          {label:'Rejected', count:counts.rejected, color:'#dc2626'},
          {label:'Total', count:payments.length, color:'#0f172a'},
        ].map(s=>(
          <div key={s.label} className="stat-card">
            <div className="stat-num" style={{color:s.color}}>{s.count}</div>
            <div className="stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bulk bar */}
      {selectedIds.length>0 && (
        <div className="bulk-bar">
          <span style={{color:'#94a3b8',fontSize:'13px'}}>✓ {selectedIds.length} payment{selectedIds.length>1?'s':''} selected</span>
          <div style={{display:'flex',gap:'8px'}}>
            <button className="bulk-clear-btn" onClick={()=>setSelectedIds([])}>Clear</button>
            <button className="bulk-approve-btn" disabled={bulkActing} onClick={bulkApprove}>
              {bulkActing?'Approving...':`✅ Approve All (${selectedIds.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="controls">
        <input className="search-inp" placeholder="🔍  Search payments..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="filter-tabs">
          {[
            {key:'pending_review',label:`⏳ Pending (${counts.pending_review})`},
            {key:'approved',label:`✅ Approved (${counts.approved})`},
            {key:'rejected',label:`❌ Rejected (${counts.rejected})`},
            {key:'all',label:`All (${payments.length})`},
          ].map(t=>(
            <button key={t.key} className={`ftab${filter===t.key?' active':''}`} onClick={()=>setFilter(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        {loading ? <div className="empty">Loading payments...</div>
        : filtered.length===0 ? <div className="empty">No payments found</div>
        : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width:'40px'}}>
                  <input type="checkbox" className="row-cb"
                    onChange={()=>{
                      const ids=filtered.filter(p=>(p.approval_status||'pending_review')==='pending_review').map(p=>p.id)
                      setSelectedIds(p=>p.length===ids.length?[]:ids)
                    }}
                    checked={selectedIds.length>0&&selectedIds.length===filtered.filter(p=>(p.approval_status||'pending_review')==='pending_review').length}
                  />
                </th>
                <th>Date</th><th>Amount</th><th>Sender</th><th>Method</th><th>Agent</th><th>AI Check</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p=>{
                const aStatus=p.approval_status||'pending_review'
                const ss=SS[aStatus]||SS.pending_review
                return (
                  <tr key={p.id}>
                    <td onClick={e=>e.stopPropagation()}>
                      {aStatus==='pending_review'&&<input type="checkbox" className="row-cb" checked={selectedIds.includes(p.id)} onChange={()=>toggleSelect(p.id)}/>}
                    </td>
                    <td onClick={()=>{setSelected(p);setRejectReason('')}} style={{color:'#94a3b8',fontSize:'12px',whiteSpace:'nowrap'}}>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td onClick={()=>{setSelected(p);setRejectReason('')}} style={{fontWeight:'800',color:'#0f172a'}}>{p.amount}</td>
                    <td onClick={()=>{setSelected(p);setRejectReason('')}}>{p.sender_name}</td>
                    <td onClick={()=>{setSelected(p);setRejectReason('')}} style={{color:'#64748b'}}>{p.payment_method}</td>
                    <td onClick={()=>{setSelected(p);setRejectReason('')}} style={{color:'#94a3b8',fontSize:'12px'}}>{p.uploaded_by}</td>
                    <td onClick={()=>{setSelected(p);setRejectReason('')}}>
                      <span className="badge" style={{background:p.status==='verified'?'#dcfce7':p.status==='suspicious'?'#fef9c3':'#fee2e2',color:p.status==='verified'?'#15803d':p.status==='suspicious'?'#b45309':'#dc2626'}}>{p.status}</span>
                    </td>
                    <td onClick={()=>{setSelected(p);setRejectReason('')}}>
                      <span className="badge" style={{background:ss.bg,color:ss.color,border:`1px solid ${ss.border}`}}>{ss.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Modal */}
      {selected && (
        <div className="overlay" onClick={()=>setSelected(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Review Payment</div>
            {[
              ['Amount',selected.amount],['Sender',selected.sender_name],
              ['Transaction ID',selected.transaction_id],['Memo',selected.memo],
              ['Date on Screenshot',selected.date_time],['Payment Method',selected.payment_method],
              ['Submitted By',selected.uploaded_by],['AI Check',selected.status],
              ['Submitted At',new Date(selected.created_at).toLocaleString()],
            ].filter(([,v])=>v&&v!=='UNKNOWN').map(([l,v])=>(
              <div className="d-row" key={l}><div className="d-lbl">{l}</div><div className="d-val">{v}</div></div>
            ))}

            {selected.agent_note && (
              <div className="note-box">
                <div style={{fontSize:'10px',fontWeight:'800',color:'#2563eb',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'5px'}}>Agent Note</div>
                <div style={{fontSize:'13px',color:'#334155'}}>{selected.agent_note}</div>
              </div>
            )}

            {selected.screenshot_url && (
              <div style={{marginTop:'14px'}}>
                <div style={{fontSize:'10px',fontWeight:'800',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'8px'}}>Payment Screenshot</div>
                <img src={selected.screenshot_url} alt="Screenshot" className="ss-img" onClick={()=>window.open(selected.screenshot_url,'_blank')} title="Click to open full size"/>
                <a href={selected.screenshot_url} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:'4px',color:'#2563eb',fontSize:'12px',textDecoration:'none',marginTop:'6px',fontWeight:'600'}}>↗ Open full size</a>
              </div>
            )}

            {(selected.approval_status||'pending_review')==='pending_review' ? (
              <div className="decision-sec">
                <div className="decision-label">Make Decision</div>
                <textarea className="reject-inp" rows={2} placeholder="Rejection reason (required to reject)..." value={rejectReason} onChange={e=>setRejectReason(e.target.value)}/>
                <div className="action-btns">
                  <button className="btn-approve" disabled={acting} onClick={()=>handleDecision('approved')}>{acting?'...':'✅ Approve'}</button>
                  <button className="btn-reject" disabled={acting||!rejectReason.trim()} onClick={()=>handleDecision('rejected')}>{acting?'...':'❌ Reject'}</button>
                </div>
              </div>
            ) : (
              <div className="already-done">
                {selected.approval_status==='approved'?'✅ Approved':'❌ Rejected'} by {selected.reviewed_by}<br/>
                <span style={{fontSize:'12px',color:'#94a3b8'}}>{selected.reviewed_at&&new Date(selected.reviewed_at).toLocaleString()}</span>
                {selected.rejection_reason&&<div style={{marginTop:'8px',color:'#dc2626',fontSize:'13px'}}>Reason: {selected.rejection_reason}</div>}
              </div>
            )}
            <button className="btn-close" onClick={()=>setSelected(null)}>Close</button>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </Layout>
  )
}
