import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

export default function AgentStats() {
  const [agents, setAgents] = useState([])
  const [payments, setPayments] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('all')
  const router = useRouter()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data:prof } = await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
    if (prof?.role!=='admin') { router.replace('/'); return }
    const [{ data:agentData }, { data:paymentData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role','agent'),
      supabase.from('payments').select('*').order('created_at',{ascending:false}),
    ])
    if (agentData) setAgents(agentData)
    if (paymentData) setPayments(paymentData)
    setLoading(false)
  }

  const exportAgentCSV = (agent, agentPayments) => {
    const headers = ['Date','Amount','Sender','Method','AI Status','Approval']
    const rows = agentPayments.map(p => [
      new Date(p.created_at).toLocaleString(), p.amount, p.sender_name,
      p.payment_method, p.status, p.approval_status||'pending_review'
    ])
    const csv = [headers,...rows].map(r=>r.map(v=>`"${v||''}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = `${agent.email}-payments.csv`
    a.click()
  }

  const getAgentPayments = (email) => {
    let filtered = payments.filter(p => p.uploaded_by === email)
    if (dateRange === '7d') filtered = filtered.filter(p => new Date(p.created_at) > new Date(Date.now()-7*24*60*60*1000))
    if (dateRange === '30d') filtered = filtered.filter(p => new Date(p.created_at) > new Date(Date.now()-30*24*60*60*1000))
    return filtered
  }

  const getAgentStats = (email) => {
    const p = getAgentPayments(email)
    return {
      total: p.length,
      verified: p.filter(x=>x.status==='verified').length,
      suspicious: p.filter(x=>x.status==='suspicious').length,
      duplicate: p.filter(x=>x.status==='duplicate').length,
      approved: p.filter(x=>x.approval_status==='approved').length,
      rejected: p.filter(x=>x.approval_status==='rejected').length,
      pending: p.filter(x=>(x.approval_status||'pending_review')==='pending_review').length,
      fraudRate: p.length>0 ? Math.round((p.filter(x=>x.status==='duplicate'||x.status==='suspicious').length/p.length)*100) : 0,
      approvalRate: p.length>0 ? Math.round((p.filter(x=>x.approval_status==='approved').length/p.length)*100) : 0,
      lastActivity: p.length>0 ? p[0].created_at : null,
    }
  }

  const allStats = agents.map(a => ({ ...a, stats: getAgentStats(a.email) }))
    .sort((a,b) => b.stats.total - a.stats.total)

  return (
    <Layout title="Agent Performance">
      <style>{`
        .controls { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .filter-tabs { display: flex; gap: 6px; }
        .ftab { padding: 8px 16px; border-radius: 30px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1.5px solid #e2e8f0; background: #fff; color: #64748b; font-family: 'Inter',sans-serif; transition: all 0.15s; }
        .ftab.active { background: #0f172a; color: #fff; border-color: #0f172a; }
        .agents-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .agent-card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 1px 6px rgba(0,0,0,0.05); overflow: hidden; cursor: pointer; transition: all 0.15s; }
        .agent-card:hover { border-color: #93c5fd; box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .agent-header { padding: 18px 20px 14px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #f1f5f9; }
        .agent-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 15px; font-weight: 800; flex-shrink: 0; }
        .agent-name { font-size: 14px; font-weight: 700; color: #0f172a; }
        .agent-email { font-size: 11px; color: #94a3b8; margin-top: 2px; }
        .agent-body { padding: 14px 20px 18px; }
        .stat-row-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
        .mini-stat { text-align: center; padding: 10px 6px; background: #f8fafc; border-radius: 10px; }
        .mini-num { font-size: 20px; font-weight: 800; line-height: 1; }
        .mini-lbl { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; font-weight: 600; }
        .progress-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .progress-label { font-size: 11px; color: #64748b; width: 70px; font-weight: 600; }
        .progress-bar-wrap { flex: 1; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
        .progress-bar { height: 100%; border-radius: 3px; transition: width 0.5s; }
        .progress-pct { font-size: 11px; color: #94a3b8; width: 32px; text-align: right; font-weight: 600; }
        .last-activity { font-size: 11px; color: #cbd5e1; margin-top: 10px; }
        .export-btn { width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 8px; color: #475569; font-size: 12px; font-weight: 600; font-family: 'Inter',sans-serif; cursor: pointer; margin-top: 10px; transition: all 0.2s; }
        .export-btn:hover { background: #eff6ff; border-color: #93c5fd; color: #2563eb; }
        .empty { text-align: center; padding: 60px; color: #cbd5e1; font-size: 14px; background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; }
        .rank-badge { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0; }
        .overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.55); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
        .modal { background: #fff; border-radius: 20px; padding: 32px; width: 100%; max-width: 540px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto; }
        .modal-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 20px; }
        .detail-stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
        .detail-stat { background: #f8fafc; border-radius: 12px; padding: 14px; text-align: center; }
        .detail-num { font-size: 24px; font-weight: 800; line-height: 1; }
        .detail-lbl { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; font-weight: 600; }
        .payment-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .payment-row:last-child { border-bottom: none; }
        .badge-sm { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .btn-close { width: 100%; margin-top: 16px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px; color: #64748b; font-size: 13px; font-family: 'Inter',sans-serif; cursor: pointer; font-weight: 600; }
        .modal-export-btn { width: 100%; background: #1d4ed8; border: none; border-radius: 10px; padding: 12px; color: #fff; font-size: 13px; font-weight: 700; font-family: 'Inter',sans-serif; cursor: pointer; margin-top: 10px; }
      `}</style>

      <div className="controls">
        <div style={{fontSize:'13px',color:'#94a3b8',flex:1}}>Click any agent card to see detailed payment history</div>
        <div className="filter-tabs">
          {[{k:'all',l:'All Time'},{k:'30d',l:'Last 30 Days'},{k:'7d',l:'Last 7 Days'}].map(t=>(
            <button key={t.k} className={`ftab${dateRange===t.k?' active':''}`} onClick={()=>setDateRange(t.k)}>{t.l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty">Loading agent stats...</div>
      ) : allStats.length === 0 ? (
        <div className="empty">No agents found</div>
      ) : (
        <div className="agents-grid">
          {allStats.map((agent, idx) => {
            const s = agent.stats
            const rankColors = ['#f59e0b','#94a3b8','#cd7c32']
            return (
              <div key={agent.id} className="agent-card" onClick={() => setSelected(agent)}>
                <div className="agent-header">
                  <div className="rank-badge" style={{background: idx<3?rankColors[idx]:'#f1f5f9', color: idx<3?'#fff':'#94a3b8'}}>
                    {idx+1}
                  </div>
                  <div className="agent-avatar">{(agent.full_name||agent.email)[0].toUpperCase()}</div>
                  <div>
                    <div className="agent-name">{agent.full_name||'—'}</div>
                    <div className="agent-email">{agent.email}</div>
                  </div>
                </div>
                <div className="agent-body">
                  <div className="stat-row-grid">
                    <div className="mini-stat">
                      <div className="mini-num" style={{color:'#0f172a'}}>{s.total}</div>
                      <div className="mini-lbl">Total</div>
                    </div>
                    <div className="mini-stat">
                      <div className="mini-num" style={{color:'#16a34a'}}>{s.approved}</div>
                      <div className="mini-lbl">Approved</div>
                    </div>
                    <div className="mini-stat">
                      <div className="mini-num" style={{color:'#dc2626'}}>{s.duplicate}</div>
                      <div className="mini-lbl">Flagged</div>
                    </div>
                  </div>

                  <div className="progress-row">
                    <div className="progress-label">Approval</div>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar" style={{width:`${s.approvalRate}%`,background:'#16a34a'}}/>
                    </div>
                    <div className="progress-pct">{s.approvalRate}%</div>
                  </div>
                  <div className="progress-row">
                    <div className="progress-label">Flag Rate</div>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar" style={{width:`${s.fraudRate}%`,background:'#ef4444'}}/>
                    </div>
                    <div className="progress-pct">{s.fraudRate}%</div>
                  </div>

                  {s.lastActivity && (
                    <div className="last-activity">Last active: {new Date(s.lastActivity).toLocaleDateString()}</div>
                  )}
                  <button className="export-btn" onClick={e=>{e.stopPropagation();exportAgentCSV(agent,getAgentPayments(agent.email))}}>
                    ⬇ Export CSV
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Agent Detail Modal */}
      {selected && (() => {
        const s = selected.stats
        const agentPayments = getAgentPayments(selected.email).slice(0,20)
        const SS = {verified:{bg:'#dcfce7',color:'#15803d'},suspicious:{bg:'#fef9c3',color:'#b45309'},duplicate:{bg:'#fee2e2',color:'#dc2626'}}
        const AS = {approved:{bg:'#dcfce7',color:'#15803d'},rejected:{bg:'#fee2e2',color:'#dc2626'},pending_review:{bg:'#fffbeb',color:'#b45309'}}
        return (
          <div className="overlay" onClick={()=>setSelected(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div className="modal-title">{selected.full_name||selected.email}</div>
              <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'16px'}}>{selected.email}</div>

              <div className="detail-stat-grid">
                {[
                  {n:s.total,l:'Total',c:'#0f172a'},
                  {n:s.approved,l:'Approved',c:'#16a34a'},
                  {n:s.rejected,l:'Rejected',c:'#dc2626'},
                  {n:s.pending,l:'Pending',c:'#d97706'},
                  {n:s.verified,l:'AI Clean',c:'#2563eb'},
                  {n:s.duplicate,l:'Duplicate',c:'#dc2626'},
                  {n:s.suspicious,l:'Suspicious',c:'#d97706'},
                  {n:`${s.approvalRate}%`,l:'Approval Rate',c:'#16a34a'},
                ].map(x=>(
                  <div key={x.l} className="detail-stat">
                    <div className="detail-num" style={{color:x.c}}>{x.n}</div>
                    <div className="detail-lbl">{x.l}</div>
                  </div>
                ))}
              </div>

              <div style={{fontSize:'13px',fontWeight:'700',color:'#0f172a',marginBottom:'10px'}}>Recent Payments</div>
              {agentPayments.length===0 ? (
                <div style={{textAlign:'center',padding:'20px',color:'#cbd5e1',fontSize:'13px'}}>No payments yet</div>
              ) : agentPayments.map(p=>(
                <div key={p.id} className="payment-row">
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'700',color:'#0f172a'}}>{p.amount} · {p.payment_method}</div>
                    <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'2px'}}>{new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                    <span className="badge-sm" style={{background:SS[p.status]?.bg||'#f1f5f9',color:SS[p.status]?.color||'#475569'}}>{p.status}</span>
                    <span className="badge-sm" style={{background:AS[p.approval_status||'pending_review']?.bg||'#f1f5f9',color:AS[p.approval_status||'pending_review']?.color||'#475569'}}>{p.approval_status||'pending'}</span>
                  </div>
                </div>
              ))}

              <button className="modal-export-btn" onClick={()=>exportAgentCSV(selected,getAgentPayments(selected.email))}>
                ⬇ Export Full History
              </button>
              <button className="btn-close" onClick={()=>setSelected(null)}>Close</button>
            </div>
          </div>
        )
      })()}
    </Layout>
  )
}
