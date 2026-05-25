import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function SenderHistory() {
  const [payments, setPayments] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState('agent')
  const router = useRouter()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data:prof } = await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle()
    setRole(prof?.role||'agent')
    const { data } = await supabase.from('payments').select('*').order('created_at',{ascending:false})
    if (data) setPayments(data)
    setLoading(false)
  }

  // Group payments by sender
  const senders = payments.reduce((acc, p) => {
    if (!p.sender_name || p.sender_name === 'UNKNOWN') return acc
    const key = `${p.sender_name}__${p.payment_method}`
    if (!acc[key]) {
      acc[key] = {
        sender_name: p.sender_name,
        payment_method: p.payment_method,
        payments: [],
      }
    }
    acc[key].payments.push(p)
    return acc
  }, {})

  const senderList = Object.values(senders).map(s => {
    const ps = s.payments
    return {
      ...s,
      total: ps.length,
      approved: ps.filter(p=>p.approval_status==='approved').length,
      rejected: ps.filter(p=>p.approval_status==='rejected').length,
      pending: ps.filter(p=>(p.approval_status||'pending_review')==='pending_review').length,
      totalAmount: ps.reduce((sum,p)=>{
        const n=parseFloat((p.amount||'').replace(/[^0-9.]/g,''))
        return sum+(isNaN(n)?0:n)
      },0).toFixed(2),
      lastSeen: ps[0]?.created_at,
      riskLevel: ps.filter(p=>p.approval_status==='rejected').length >= 2 ? 'high'
        : ps.filter(p=>p.status==='suspicious'||p.status==='duplicate').length >= 1 ? 'medium'
        : 'low',
    }
  }).sort((a,b) => b.total - a.total)

  const filtered = senderList.filter(s =>
    !search || s.sender_name.toLowerCase().includes(search.toLowerCase()) || s.payment_method.toLowerCase().includes(search.toLowerCase())
  )

  const METHOD_COLORS = { CashApp:'#00D64F', Chime:'#1EC677', Zelle:'#6D1ED4', TapTap:'#FF4E00', Venmo:'#3D95CE', PayPal:'#003087', Other:'#64748B' }
  const RISK = {
    low:    { label:'Low Risk',    color:'#15803d', bg:'#f0fdf4', border:'#bbf7d0' },
    medium: { label:'Medium Risk', color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
    high:   { label:'High Risk',   color:'#dc2626', bg:'#fff5f5', border:'#fecaca' },
  }

  return (
    <Layout title="Sender History">
      <style>{`
        .controls { display: flex; gap: 10px; margin-bottom: 20px; }
        .search-inp { flex: 1; background: var(--card); border: 1.5px solid var(--border); border-radius: 10px; padding: 11px 14px; color: var(--text); font-size: 13px; font-family: 'Inter',sans-serif; outline: none; transition: border-color 0.2s; }
        .search-inp:focus { border-color: #3b82f6; }
        .table-wrap { background: var(--card); border-radius: 16px; overflow: hidden; border: 1px solid var(--border); box-shadow: 0 1px 6px rgba(0,0,0,0.05); }
        .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
        .tbl thead tr { background: var(--bg); }
        .tbl th { padding: 12px 16px; text-align: left; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; border-bottom: 1.5px solid var(--border); }
        .tbl td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .tbl tr:last-child td { border-bottom: none; }
        .tbl tbody tr:hover td { background: var(--bg); cursor: pointer; }
        .sender-name { font-size: 14px; font-weight: 700; color: var(--text); }
        .method-tag { display: inline-flex; align-items: center; gap: 5px; background: #f0f4ff; color: #2563eb; border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 600; }
        .method-dot { width: 8px; height: 8px; border-radius: 50%; }
        .risk-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        .stat-cell { font-size: 15px; font-weight: 800; }
        .empty { text-align: center; padding: 60px; color: #cbd5e1; font-size: 14px; }
        .overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.55); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
        .modal { background: var(--card); border-radius: 20px; padding: 32px; width: 100%; max-width: 560px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
        .modal-name { font-size: 20px; font-weight: 800; color: var(--text); }
        .modal-method { font-size: 13px; color: #94a3b8; margin-top: 3px; }
        .stats-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
        .stat-box { background: var(--bg); border-radius: 12px; padding: 14px; text-align: center; }
        .stat-box-num { font-size: 22px; font-weight: 800; line-height: 1; }
        .stat-box-lbl { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; font-weight: 600; }
        .payment-item { display: flex; justify-content: space-between; align-items: center; padding: 11px 0; border-bottom: 1px solid var(--border); }
        .payment-item:last-child { border-bottom: none; }
        .badge-sm { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .btn-close { width: 100%; margin-top: 16px; background: var(--bg); border: 1.5px solid var(--border); border-radius: 10px; padding: 12px; color: var(--text-muted); font-size: 13px; font-family: 'Inter',sans-serif; cursor: pointer; font-weight: 600; }
        .risk-banner { border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
        .ss-link { color: #2563eb; font-size: 12px; text-decoration: none; font-weight: 500; }
        .ss-link:hover { text-decoration: underline; }
      `}</style>

      <div className="controls">
        <input className="search-inp" placeholder="🔍  Search by sender name or payment method..." value={search} onChange={e=>setSearch(e.target.value)} />
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'11px 16px',fontSize:'13px',color:'#64748b',fontWeight:'600',whiteSpace:'nowrap'}}>
          {filtered.length} senders
        </div>
      </div>

      <div className="table-wrap">
        {loading ? <div className="empty">Loading...</div>
        : filtered.length === 0 ? <div className="empty">No senders found</div>
        : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Sender</th>
                <th>Method</th>
                <th>Total Payments</th>
                <th>Total Amount</th>
                <th>Approved</th>
                <th>Rejected</th>
                <th>Risk Level</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s,i) => {
                const risk = RISK[s.riskLevel]
                const mc = METHOD_COLORS[s.payment_method]||'#64748B'
                return (
                  <tr key={i} onClick={()=>setSelected(s)}>
                    <td><div className="sender-name">{s.sender_name}</div></td>
                    <td>
                      <span className="method-tag">
                        <span className="method-dot" style={{background:mc}}/>
                        {s.payment_method}
                      </span>
                    </td>
                    <td><span className="stat-cell">{s.total}</span></td>
                    <td><span className="stat-cell" style={{color:'#0f172a'}}>${s.totalAmount}</span></td>
                    <td><span className="stat-cell" style={{color:'#16a34a'}}>{s.approved}</span></td>
                    <td><span className="stat-cell" style={{color:'#dc2626'}}>{s.rejected}</span></td>
                    <td>
                      <span className="risk-badge" style={{background:risk.bg,color:risk.color,border:`1px solid ${risk.border}`}}>
                        {risk.label}
                      </span>
                    </td>
                    <td style={{color:'#94a3b8',fontSize:'12px'}}>{s.lastSeen?new Date(s.lastSeen).toLocaleDateString():'—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Sender Detail Modal */}
      {selected && (() => {
        const risk = RISK[selected.riskLevel]
        const SS = {verified:{bg:'#dcfce7',color:'#15803d'},suspicious:{bg:'#fef9c3',color:'#b45309'},duplicate:{bg:'#fee2e2',color:'#dc2626'}}
        const AS = {approved:{bg:'#dcfce7',color:'#15803d'},rejected:{bg:'#fee2e2',color:'#dc2626'},pending_review:{bg:'#fffbeb',color:'#b45309'}}
        return (
          <div className="overlay" onClick={()=>setSelected(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <div className="modal-name">{selected.sender_name}</div>
                  <div className="modal-method">{selected.payment_method}</div>
                </div>
                <span className="risk-badge" style={{background:risk.bg,color:risk.color,border:`1px solid ${risk.border}`}}>
                  {risk.label}
                </span>
              </div>

              {selected.riskLevel === 'high' && (
                <div className="risk-banner" style={{background:'#fff5f5',border:'1.5px solid #fecaca'}}>
                  <span style={{fontSize:'20px'}}>🚨</span>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'700',color:'#dc2626'}}>High Risk Sender</div>
                    <div style={{fontSize:'12px',color:'#dc2626',opacity:0.8}}>This sender has {selected.rejected} rejection{selected.rejected!==1?'s':''} — review carefully</div>
                  </div>
                </div>
              )}

              <div className="stats-row">
                {[
                  {n:selected.total,l:'Total',c:'#0f172a'},
                  {n:`$${selected.totalAmount}`,l:'Total Amount',c:'#2563eb'},
                  {n:selected.approved,l:'Approved',c:'#16a34a'},
                  {n:selected.rejected,l:'Rejected',c:'#dc2626'},
                ].map(x=>(
                  <div key={x.l} className="stat-box">
                    <div className="stat-box-num" style={{color:x.c}}>{x.n}</div>
                    <div className="stat-box-lbl">{x.l}</div>
                  </div>
                ))}
              </div>

              <div style={{fontSize:'13px',fontWeight:'700',color:'#0f172a',marginBottom:'12px'}}>Payment History</div>
              {selected.payments.map(p=>(
                <div key={p.id} className="payment-item">
                  <div>
                    <div style={{fontSize:'14px',fontWeight:'700',color:'#0f172a'}}>{p.amount}</div>
                    <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'2px'}}>
                      {new Date(p.created_at).toLocaleString()} · by {p.uploaded_by}
                    </div>
                    {p.memo && p.memo!=='UNKNOWN' && <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'1px'}}>Memo: {p.memo}</div>}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'5px',alignItems:'flex-end'}}>
                    <span className="badge-sm" style={{background:SS[p.status]?.bg||'#f1f5f9',color:SS[p.status]?.color||'#475569'}}>{p.status}</span>
                    <span className="badge-sm" style={{background:AS[p.approval_status||'pending_review']?.bg||'#f1f5f9',color:AS[p.approval_status||'pending_review']?.color||'#475569'}}>{p.approval_status||'pending'}</span>
                    {p.screenshot_url && <a href={p.screenshot_url} target="_blank" rel="noopener noreferrer" className="ss-link">🖼️ Screenshot</a>}
                  </div>
                </div>
              ))}

              <button className="btn-close" onClick={()=>setSelected(null)}>Close</button>
            </div>
          </div>
        )
      })()}
    </Layout>
  )
}
