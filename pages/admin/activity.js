import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const ACTION_ICONS = {
  payment_uploaded: '📤',
  payment_approved: '✅',
  payment_rejected: '❌',
  tag_updated: '🏷️',
  tag_requested: '📨',
  user_created: '👤',
  user_deleted: '🗑️',
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const router = useRouter()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (prof?.role !== 'admin') { router.push('/'); return }
    loadLogs()
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const loadLogs = async () => {
    // Load from notifications table as activity source + payments
    const { data: notifs } = await supabase.from('notifications')
      .select('*').order('created_at', { ascending: false }).limit(200)

    const { data: payments } = await supabase.from('payments')
      .select('id,created_at,uploaded_by,amount,payment_method,sender_name,status,approval_status,reviewed_by,reviewed_at,rejection_reason')
      .order('created_at', { ascending: false }).limit(100)

    const { data: tagHistory } = await supabase.from('tag_history')
      .select('*').order('changed_at', { ascending: false }).limit(50)

    // Combine into unified log
    const combined = []

    payments?.forEach(p => {
      combined.push({
        id: `pay-upload-${p.id}`,
        time: p.created_at,
        type: 'payment_uploaded',
        actor: p.uploaded_by,
        detail: `Uploaded ${p.payment_method} payment of ${p.amount} from ${p.sender_name}`,
        status: p.status,
      })
      if (p.reviewed_by && p.reviewed_at) {
        combined.push({
          id: `pay-review-${p.id}`,
          time: p.reviewed_at,
          type: p.approval_status === 'approved' ? 'payment_approved' : 'payment_rejected',
          actor: p.reviewed_by,
          detail: p.approval_status === 'approved'
            ? `Approved ${p.payment_method} payment of ${p.amount} (by ${p.uploaded_by})`
            : `Rejected ${p.payment_method} payment of ${p.amount} — Reason: ${p.rejection_reason || 'None'}`,
          status: p.approval_status,
        })
      }
    })

    tagHistory?.forEach(t => {
      combined.push({
        id: `tag-${t.id}`,
        time: t.changed_at,
        type: 'tag_updated',
        actor: t.changed_by,
        detail: `Updated ${t.payment_method} tag: "${t.old_value || 'none'}" → "${t.new_value}"`,
      })
    })

    // Sort by time desc
    combined.sort((a, b) => new Date(b.time) - new Date(a.time))
    setLogs(combined)
    setLoading(false)
  }

  const exportCSV = () => {
    const headers = ['Time', 'Type', 'Actor', 'Detail']
    const rows = filtered.map(l => [
      new Date(l.time).toLocaleString(), l.type, l.actor, l.detail
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v || ''}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `activity-log-${Date.now()}.csv`
    a.click()
  }

  const filtered = logs.filter(l => {
    const matchFilter = filter === 'all' || l.type === filter
    const matchSearch = !search || JSON.stringify(l).toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const typeColor = {
    payment_uploaded: { bg: '#eff6ff', color: '#1d4ed8' },
    payment_approved: { bg: '#f0fdf4', color: '#15803d' },
    payment_rejected: { bg: '#fff5f5', color: '#dc2626' },
    tag_updated:      { bg: '#fef9c3', color: '#b45309' },
    tag_requested:    { bg: '#fff9f0', color: '#b45309' },
    user_created:     { bg: '#f5f3ff', color: '#6d28d9' },
    user_deleted:     { bg: '#fff5f5', color: '#dc2626' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7ff', fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .nav { background: #1e2d5a; height: 58px; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
        .nav-logo { color: #fff; font-size: 17px; font-weight: 700; cursor: pointer; }
        .nav-right { display: flex; align-items: center; gap: 10px; }
        .nav-link { background: none; border: none; color: #8fa8d8; font-size: 13px; font-family: 'Inter',sans-serif; cursor: pointer; padding: 6px 12px; border-radius: 7px; transition: all 0.15s; }
        .nav-link:hover { background: #2a3f70; color: #fff; }
        .nav-link.danger:hover { background: #3d1a1a; color: #f87171; }
        .page { max-width: 1000px; margin: 0 auto; padding: 28px 20px; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
        .page-title { font-size: 20px; font-weight: 700; color: #111; }
        .controls { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
        .search-input { flex: 1; min-width: 200px; background: #fff; border: 1.5px solid #e8ecf8; border-radius: 10px; padding: 10px 14px; color: #111; font-size: 13px; font-family: 'Inter',sans-serif; outline: none; transition: border-color 0.2s; }
        .search-input:focus { border-color: #3b6be8; }
        .filter-select { background: #fff; border: 1.5px solid #e8ecf8; border-radius: 10px; padding: 10px 13px; color: #555; font-size: 13px; font-family: 'Inter',sans-serif; outline: none; cursor: pointer; }
        .export-btn { background: none; border: 1.5px solid #e8ecf8; border-radius: 10px; color: #777; font-size: 13px; padding: 10px 16px; cursor: pointer; font-family: 'Inter',sans-serif; font-weight: 500; white-space: nowrap; transition: all 0.2s; }
        .export-btn:hover { border-color: #16a34a; color: #16a34a; background: #f0fdf4; }
        .log-list { display: flex; flex-direction: column; gap: 8px; }
        .log-item { background: #fff; border-radius: 12px; padding: 14px 18px; border: 1.5px solid #eef1fb; display: flex; align-items: flex-start; gap: 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .log-icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
        .log-body { flex: 1; }
        .log-detail { font-size: 13px; color: #333; font-weight: 500; line-height: 1.5; }
        .log-meta { display: flex; gap: 12px; margin-top: 5px; flex-wrap: wrap; }
        .log-actor { font-size: 12px; color: #2563eb; font-weight: 600; }
        .log-time { font-size: 12px; color: #bbb; }
        .log-badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .empty { text-align: center; padding: 60px; color: #ccc; font-size: 14px; }
        .count-note { font-size: 13px; color: #999; font-weight: 400; margin-left: 8px; }
      `}</style>

      <nav className="nav">
        <div className="nav-logo" onClick={() => router.push('/dashboard')}>🛡️ Payment Verifier</div>
        <div className="nav-right">
          <span style={{ color:'#4a6090', fontSize:'11px', padding:'3px 8px', background:'#2a3f70', borderRadius:'20px' }}>⚙️ Admin</span>
          <button className="nav-link" onClick={() => router.push('/dashboard')}>Dashboard</button>
          <button className="nav-link" onClick={() => router.push('/admin/users')}>👥 Users</button>
          <button className="nav-link danger" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="page">
        <div className="page-header">
          <div className="page-title">📋 Activity Log <span className="count-note">{filtered.length} entries</span></div>
          <button className="export-btn" onClick={exportCSV}>⬇ Export CSV</button>
        </div>

        <div className="controls">
          <input className="search-input" placeholder="🔍  Search by actor, action, amount..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Actions</option>
            <option value="payment_uploaded">📤 Uploads</option>
            <option value="payment_approved">✅ Approvals</option>
            <option value="payment_rejected">❌ Rejections</option>
            <option value="tag_updated">🏷️ Tag Updates</option>
          </select>
        </div>

        {loading ? (
          <div className="empty">Loading activity...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">No activity found</div>
        ) : (
          <div className="log-list">
            {filtered.map(log => {
              const tc = typeColor[log.type] || { bg: '#f3f4f6', color: '#374151' }
              return (
                <div key={log.id} className="log-item">
                  <div className="log-icon">{ACTION_ICONS[log.type] || '📌'}</div>
                  <div className="log-body">
                    <div className="log-detail">{log.detail}</div>
                    <div className="log-meta">
                      <span className="log-actor">👤 {log.actor}</span>
                      <span className="log-time">🕐 {new Date(log.time).toLocaleString()}</span>
                      <span className="log-badge" style={{ background: tc.bg, color: tc.color }}>
                        {log.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
