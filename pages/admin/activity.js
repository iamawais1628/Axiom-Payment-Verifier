import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const ACTION_ICONS = {
  payment_uploaded: '📤',
  payment_approved: '✅',
  payment_rejected: '❌',
  tag_updated:      '🏷️',
  tag_requested:    '📨',
  user_created:     '👤',
  user_deleted:     '🗑️',
}

const ACTION_COLORS = {
  payment_uploaded: { bg:'#eff6ff', color:'#1d4ed8', border:'#bfdbfe' },
  payment_approved: { bg:'#f0fdf4', color:'#15803d', border:'#bbf7d0' },
  payment_rejected: { bg:'#fff5f5', color:'#dc2626', border:'#fecaca' },
  tag_updated:      { bg:'#fef9c3', color:'#b45309', border:'#fde68a' },
  tag_requested:    { bg:'#fff9f0', color:'#b45309', border:'#fed7aa' },
  user_created:     { bg:'#f5f3ff', color:'#6d28d9', border:'#ddd6fe' },
  user_deleted:     { bg:'#fff5f5', color:'#dc2626', border:'#fecaca' },
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const router = useRouter()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data:prof } = await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
    if (prof?.role!=='admin') { router.replace('/'); return }
    loadLogs()
  }

  const loadLogs = async () => {
    const [{ data:payments }, { data:tagHistory }] = await Promise.all([
      supabase.from('payments').select('id,created_at,uploaded_by,amount,payment_method,sender_name,status,approval_status,reviewed_by,reviewed_at,rejection_reason').order('created_at',{ascending:false}).limit(200),
      supabase.from('tag_history').select('*').order('changed_at',{ascending:false}).limit(100),
    ])

    const combined = []

    payments?.forEach(p => {
      combined.push({
        id:`pay-up-${p.id}`, time:p.created_at, type:'payment_uploaded',
        actor:p.uploaded_by,
        detail:`Uploaded ${p.payment_method} payment of ${p.amount} from ${p.sender_name}`,
        badge:p.status,
      })
      if (p.reviewed_by&&p.reviewed_at) {
        combined.push({
          id:`pay-rv-${p.id}`, time:p.reviewed_at,
          type:p.approval_status==='approved'?'payment_approved':'payment_rejected',
          actor:p.reviewed_by,
          detail:p.approval_status==='approved'
            ? `Approved ${p.payment_method} payment of ${p.amount} (submitted by ${p.uploaded_by})`
            : `Rejected ${p.payment_method} payment of ${p.amount} — Reason: ${p.rejection_reason||'None'}`,
        })
      }
    })

    tagHistory?.forEach(t => {
      combined.push({
        id:`tag-${t.id}`, time:t.changed_at, type:'tag_updated',
        actor:t.changed_by,
        detail:`Updated ${t.payment_method} tag: "${t.old_value||'none'}" → "${t.new_value}"`,
      })
    })

    combined.sort((a,b)=>new Date(b.time)-new Date(a.time))
    setLogs(combined)
    setLoading(false)
  }

  const exportCSV = () => {
    const headers=['Time','Type','Actor','Detail']
    const rows=filtered.map(l=>[new Date(l.time).toLocaleString(),l.type,l.actor,l.detail])
    const csv=[headers,...rows].map(r=>r.map(v=>`"${v||''}"`).join(',')).join('\n')
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download=`activity-${Date.now()}.csv`
    a.click()
  }

  const filtered = logs.filter(l => {
    const mf = filter==='all'||l.type===filter
    const ms = !search||JSON.stringify(l).toLowerCase().includes(search.toLowerCase())
    return mf&&ms
  })

  return (
    <Layout title="Activity Log">
      <style>{`
        .page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px}
        .export-btn{background:none;border:1.5px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:13px;padding:9px 16px;cursor:pointer;font-family:'Inter',sans-serif;font-weight:600;transition:all 0.2s}
        .export-btn:hover{border-color:#16a34a;color:#16a34a;background:#f0fdf4}
        .controls{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
        .search-inp{flex:1;min-width:200px;background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:10px 14px;color:var(--text);font-size:13px;font-family:'Inter',sans-serif;outline:none;transition:border-color 0.2s}
        .search-inp:focus{border-color:#3b82f6}
        .filter-select{background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:10px 13px;color:var(--text-muted);font-size:13px;font-family:'Inter',sans-serif;outline:none;cursor:pointer}
        .count-badge{background:var(--bg);color:var(--text-muted);font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;margin-left:8px}
        .log-list{display:flex;flex-direction:column;gap:8px}
        .log-item{background:var(--card);border-radius:14px;padding:16px 18px;border:1px solid var(--border);display:flex;align-items:flex-start;gap:14px;box-shadow:0 1px 4px rgba(0,0,0,0.04);transition:box-shadow 0.15s}
        .log-item:hover{box-shadow:0 3px 12px rgba(0,0,0,0.08)}
        .log-icon-wrap{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
        .log-body{flex:1;min-width:0}
        .log-detail{font-size:13px;color:var(--text);font-weight:500;line-height:1.5;word-break:break-word}
        .log-meta{display:flex;gap:10px;margin-top:6px;flex-wrap:wrap;align-items:center}
        .log-actor{font-size:12px;color:#2563eb;font-weight:700}
        .log-time{font-size:11px;color:#cbd5e1;font-weight:500}
        .log-type-badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px}
        .empty{text-align:center;padding:60px;color:#cbd5e1;font-size:14px;background:var(--card);border-radius:16px;border:1px solid #e2e8f0}
      `}</style>

      <div className="page-header">
        <div>
          <div style={{fontSize:'13px',color:'#94a3b8'}}>
            Complete audit trail of all team activity
            <span className="count-badge">{filtered.length} entries</span>
          </div>
        </div>
        <button className="export-btn" onClick={exportCSV}>⬇ Export CSV</button>
      </div>

      <div className="controls">
        <input className="search-inp" placeholder="🔍  Search by actor, action, amount, method..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="filter-select" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All Actions</option>
          <option value="payment_uploaded">📤 Uploads</option>
          <option value="payment_approved">✅ Approvals</option>
          <option value="payment_rejected">❌ Rejections</option>
          <option value="tag_updated">🏷️ Tag Updates</option>
          <option value="tag_requested">📨 Tag Requests</option>
        </select>
      </div>

      {loading ? (
        <div className="empty">Loading activity...</div>
      ) : filtered.length===0 ? (
        <div className="empty">No activity found</div>
      ) : (
        <div className="log-list">
          {filtered.map(log => {
            const tc = ACTION_COLORS[log.type]||{bg:'#f1f5f9',color:'#475569',border:'#e2e8f0'}
            return (
              <div key={log.id} className="log-item">
                <div className="log-icon-wrap" style={{background:tc.bg,border:`1px solid ${tc.border}`}}>
                  {ACTION_ICONS[log.type]||'📌'}
                </div>
                <div className="log-body">
                  <div className="log-detail">{log.detail}</div>
                  <div className="log-meta">
                    <span className="log-actor">👤 {log.actor}</span>
                    <span className="log-time">🕐 {new Date(log.time).toLocaleString()}</span>
                    <span className="log-type-badge" style={{background:tc.bg,color:tc.color,border:`1px solid ${tc.border}`}}>
                      {log.type.replace(/_/g,' ')}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
