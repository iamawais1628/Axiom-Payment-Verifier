import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Dashboard() {
  const [payments, setPayments] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const router = useRouter()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data:prof } = await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
    const role = prof?.role||'agent'
    if (role==='agent') { router.replace('/upload'); return }
    if (role==='finance') { router.replace('/finance'); return }
    const { data } = await supabase.from('payments').select('*').order('created_at',{ascending:false})
    if (data) setPayments(data)
    setLoading(false)
  }

  const exportCSV = () => {
    const headers=['Date','Amount','Sender','Method','Uploaded By','AI Status','Approval']
    const rows=filtered.map(p=>[new Date(p.created_at).toLocaleString(),p.amount,p.sender_name,p.payment_method,p.uploaded_by,p.status,p.approval_status])
    const csv=[headers,...rows].map(r=>r.map(v=>`"${v||''}"`).join(',')).join('\n')
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`payments-${Date.now()}.csv`; a.click()
  }

  const filtered = payments.filter(p => {
    const ms = !search||JSON.stringify(p).toLowerCase().includes(search.toLowerCase())
    const mSt = filterStatus==='all'||p.status===filterStatus
    const mM = filterMethod==='all'||p.payment_method===filterMethod
    return ms&&mSt&&mM
  })

  const stats = {
    total: payments.length,
    verified: payments.filter(p=>p.status==='verified').length,
    duplicate: payments.filter(p=>p.status==='duplicate').length,
    suspicious: payments.filter(p=>p.status==='suspicious').length,
    approved: payments.filter(p=>p.approval_status==='approved').length,
    pending: payments.filter(p=>(p.approval_status||'pending_review')==='pending_review').length,
    flagRate: payments.length>0?Math.round((payments.filter(p=>p.status==='duplicate'||p.status==='suspicious').length/payments.length)*100):0,
  }

  const methods=[...new Set(payments.map(p=>p.payment_method).filter(Boolean))]

  const SS={
    verified:{bg:'#dcfce7',color:'#15803d'},
    suspicious:{bg:'#fef9c3',color:'#b45309'},
    duplicate:{bg:'#fee2e2',color:'#dc2626'},
  }
  const AS={
    pending_review:{bg:'#fffbeb',color:'#b45309'},
    approved:{bg:'#dcfce7',color:'#15803d'},
    rejected:{bg:'#fee2e2',color:'#dc2626'},
  }

  return (
    <Layout title="Admin Dashboard">
      <style>{`
        .stats-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:12px;margin-bottom:24px}
        @media(max-width:1100px){.stats-grid{grid-template-columns:repeat(4,1fr)}}
        @media(max-width:640px){.stats-grid{grid-template-columns:repeat(2,1fr)}}
        .stat-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px 18px;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
        .stat-num{font-size:26px;font-weight:800;line-height:1}
        .stat-lbl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.7px;margin-top:5px;font-weight:700}
        .charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
        @media(max-width:768px){.charts-grid{grid-template-columns:1fr}}
        .chart-card{background:var(--card);border-radius:16px;padding:20px;border:1px solid var(--border);box-shadow:0 1px 6px rgba(0,0,0,0.05)}
        .chart-title{font-size:13px;font-weight:700;color:var(--text);margin-bottom:16px}
        .controls{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
        .search-inp{flex:1;min-width:200px;background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:10px 14px;color:var(--text);font-size:13px;font-family:'Inter',sans-serif;outline:none;transition:border-color 0.2s}
        .search-inp:focus{border-color:#3b82f6}
        .filter-select{background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:10px 13px;color:var(--text-muted);font-size:13px;font-family:'Inter',sans-serif;outline:none;cursor:pointer}
        .export-btn{background:none;border:1.5px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:13px;padding:10px 16px;cursor:pointer;font-family:'Inter',sans-serif;font-weight:600;white-space:nowrap;transition:all 0.2s}
        .export-btn:hover{border-color:#16a34a;color:#16a34a;background:#f0fdf4}
        .table-wrap{background:var(--card);border-radius:16px;overflow:hidden;border:1px solid var(--border);box-shadow:0 1px 6px rgba(0,0,0,0.05)}
        .tbl{width:100%;border-collapse:collapse;font-size:13px}
        .tbl thead tr{background:#f8fafc}
        .tbl th{padding:12px 16px;text-align:left;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;border-bottom:1.5px solid #e2e8f0}
        .tbl td{padding:13px 16px;border-bottom:1px solid var(--border);color:var(--text);vertical-align:middle}
        .tbl tr:last-child td{border-bottom:none}
        .tbl tbody tr:hover td{background:var(--bg);cursor:pointer}
        .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px}
        .empty{text-align:center;padding:60px;color:#cbd5e1;font-size:14px}
        .overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
        .modal{background:var(--card);border-radius:20px;padding:32px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,0.2);max-height:88vh;overflow-y:auto}
        .modal-title{font-size:18px;font-weight:800;color:var(--text);margin-bottom:20px}
        .d-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #f1f5f9}
        .d-lbl{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;font-weight:700}
        .d-val{font-size:13px;color:var(--text);font-weight:600;text-align:right;word-break:break-all}
        .ss-link{display:inline-flex;align-items:center;gap:5px;color:#2563eb;font-size:13px;text-decoration:none;margin-top:14px;font-weight:600}
        .ss-link:hover{text-decoration:underline}
        .btn-close{width:100%;margin-top:16px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;padding:12px;color:var(--text-muted);font-size:13px;font-family:'Inter',sans-serif;cursor:pointer;font-weight:600}
      `}</style>

      {/* Stats */}
      <div className="stats-grid">
        {[
          {label:'Total',     num:stats.total,     color:'#0f172a'},
          {label:'Verified',  num:stats.verified,  color:'#16a34a'},
          {label:'Duplicate', num:stats.duplicate, color:'#dc2626'},
          {label:'Suspicious',num:stats.suspicious,color:'#d97706'},
          {label:'Approved',  num:stats.approved,  color:'#2563eb'},
          {label:'Pending',   num:stats.pending,   color:'#f59e0b'},
          {label:'Flag Rate', num:`${stats.flagRate}%`, color:'#8b5cf6'},
        ].map(s=>(
          <div key={s.label} className="stat-card">
            <div className="stat-num" style={{color:s.color}}>{s.num}</div>
            <div className="stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Payments by Method</div>
          {['CashApp','Chime','Zelle','TapTap','Venmo','PayPal','Other'].map(m=>{
            const count=payments.filter(p=>p.payment_method===m).length
            const pct=payments.length>0?(count/payments.length)*100:0
            const colors={CashApp:'#00D64F',Chime:'#1EC677',Zelle:'#6D1ED4',TapTap:'#FF4E00',Venmo:'#3D95CE',PayPal:'#003087',Other:'#64748B'}
            if(!count) return null
            return (
              <div key={m} style={{marginBottom:'10px'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',marginBottom:'4px'}}>
                  <span style={{color:'#475569',fontWeight:600}}>{m}</span>
                  <span style={{color:'#0f172a',fontWeight:800}}>{count}</span>
                </div>
                <div style={{background:'#f1f5f9',borderRadius:'4px',height:'8px',overflow:'hidden'}}>
                  <div style={{background:colors[m],height:'100%',width:`${pct}%`,borderRadius:'4px',transition:'width 0.5s'}}/>
                </div>
              </div>
            )
          })}
        </div>
        <div className="chart-card">
          <div className="chart-title">AI Detection Breakdown</div>
          {[
            {label:'Verified',  count:stats.verified,  color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0'},
            {label:'Suspicious',count:stats.suspicious,color:'#d97706', bg:'#fffbeb', border:'#fde68a'},
            {label:'Duplicate', count:stats.duplicate, color:'#dc2626', bg:'#fff5f5', border:'#fecaca'},
          ].map(item=>{
            const pct=payments.length>0?Math.round((item.count/payments.length)*100):0
            return (
              <div key={item.label} style={{display:'flex',alignItems:'center',gap:'14px',padding:'12px',background:item.bg,border:`1px solid ${item.border}`,borderRadius:'12px',marginBottom:'10px'}}>
                <div style={{width:'44px',height:'44px',borderRadius:'50%',background:item.color,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'14px',fontWeight:'800',flexShrink:0}}>{pct}%</div>
                <div>
                  <div style={{fontSize:'15px',fontWeight:'800',color:item.color}}>{item.count} {item.label}</div>
                  <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'2px'}}>{pct}% of all payments</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <input className="search-inp" placeholder="🔍  Search by name, amount, sender..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="filter-select" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">All AI Results</option>
          <option value="verified">✅ Verified</option>
          <option value="suspicious">⚠️ Suspicious</option>
          <option value="duplicate">❌ Duplicate</option>
        </select>
        <select className="filter-select" value={filterMethod} onChange={e=>setFilterMethod(e.target.value)}>
          <option value="all">All Methods</option>
          {methods.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <button className="export-btn" onClick={exportCSV}>⬇ Export CSV</button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        {loading?<div className="empty">Loading...</div>:filtered.length===0?<div className="empty">No payments found</div>:(
          <table className="tbl">
            <thead>
              <tr><th>Date</th><th>Amount</th><th>Sender</th><th>Method</th><th>Agent</th><th>AI</th><th>Approval</th></tr>
            </thead>
            <tbody>
              {filtered.map(p=>{
                const ss=SS[p.status]||{bg:'#f1f5f9',color:'#475569'}
                const as=AS[p.approval_status||'pending_review']||AS.pending_review
                return (
                  <tr key={p.id} onClick={()=>setSelected(p)}>
                    <td style={{color:'#94a3b8',fontSize:'12px',whiteSpace:'nowrap'}}>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td style={{fontWeight:'800',color:'#0f172a'}}>{p.amount}</td>
                    <td>{p.sender_name}</td>
                    <td style={{color:'#64748b'}}>{p.payment_method}</td>
                    <td style={{color:'#94a3b8',fontSize:'12px'}}>{p.uploaded_by}</td>
                    <td><span className="badge" style={{background:ss.bg,color:ss.color}}>{p.status}</span></td>
                    <td><span className="badge" style={{background:as.bg,color:as.color}}>{p.approval_status||'pending'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {selected&&(
        <div className="overlay" onClick={()=>setSelected(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Payment Detail</div>
            {[
              ['Amount',selected.amount],['Sender',selected.sender_name],
              ['Transaction ID',selected.transaction_id],['Memo',selected.memo],
              ['Date on Screenshot',selected.date_time],['Method',selected.payment_method],
              ['Uploaded By',selected.uploaded_by],['AI Result',selected.status],
              ['Approval',selected.approval_status||'pending_review'],
              ['Reviewed By',selected.reviewed_by],
              ['Submitted At',new Date(selected.created_at).toLocaleString()],
            ].filter(([,v])=>v&&v!=='UNKNOWN').map(([l,v])=>(
              <div className="d-row" key={l}><div className="d-lbl">{l}</div><div className="d-val">{v}</div></div>
            ))}
            {selected.rejection_reason&&<div style={{background:'#fff5f5',border:'1.5px solid #fecaca',borderRadius:'10px',padding:'12px 14px',marginTop:'12px',fontSize:'13px',color:'#dc2626'}}><strong>Rejection:</strong> {selected.rejection_reason}</div>}
            {selected.screenshot_url&&<a href={selected.screenshot_url} target="_blank" rel="noopener noreferrer" className="ss-link">🖼️ View Screenshot ↗</a>}
            <button className="btn-close" onClick={()=>setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </Layout>
  )
}
