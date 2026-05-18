import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Finance() {
  const [payments, setPayments] = useState([])
  const [profile, setProfile] = useState(null)
  const [selected, setSelected] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)
  const [filter, setFilter] = useState('pending_review')
  const [notifications, setNotifications] = useState([])
  const [showNotif, setShowNotif] = useState(false)
  const [toast, setToast] = useState(null)
  const router = useRouter()

  useEffect(() => { init() }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (!prof || (prof.role !== 'finance' && prof.role !== 'admin')) {
      router.push('/upload'); return
    }
    setProfile(prof)
    loadPayments(prof)
    loadNotifications(user.email)

    supabase.channel('finance-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => loadPayments(prof))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => loadNotifications(user.email))
      .subscribe()
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const loadPayments = async (prof) => {
    let query = supabase.from('payments').select('*').order('created_at', { ascending: false })
    // Finance only sees their assigned methods
    if (prof?.role === 'finance' && prof?.payment_methods?.length > 0) {
      query = query.in('payment_method', prof.payment_methods)
    }
    const { data } = await query
    if (data) setPayments(data)
  }

  const loadNotifications = async (email) => {
    const { data } = await supabase.from('notifications').select('*')
      .eq('recipient_email', email).eq('is_read', false).order('created_at', { ascending: false })
    if (data) setNotifications(data)
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_email', profile.email)
    setNotifications([])
    setShowNotif(false)
  }

  const handleDecision = async (decision) => {
    if (!selected) return
    setActing(true)

    await supabase.from('payments').update({
      approval_status: decision,
      reviewed_by: profile.email,
      reviewed_at: new Date().toISOString(),
      rejection_reason: decision === 'rejected' ? rejectReason : null,
    }).eq('id', selected.id)

    // Notify the agent
    const emoji = decision === 'approved' ? '✅' : '❌'
    await supabase.from('notifications').insert({
      recipient_email: selected.agent_email || selected.uploaded_by,
      type: decision === 'approved' ? 'payment_approved' : 'payment_rejected',
      title: `Payment ${decision === 'approved' ? 'Approved' : 'Rejected'} ${emoji}`,
      message: decision === 'approved'
        ? `Your ${selected.payment_method} payment of ${selected.amount} from ${selected.sender_name} has been approved.`
        : `Your ${selected.payment_method} payment of ${selected.amount} was rejected. Reason: ${rejectReason || 'No reason provided'}`,
      related_id: selected.id,
    })

    // Send email notification via API
    await fetch('/api/notify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: selected.agent_email || selected.uploaded_by,
        decision,
        amount: selected.amount,
        method: selected.payment_method,
        sender: selected.sender_name,
        reason: rejectReason,
        reviewedBy: profile.email,
      })
    })

    setActing(false)
    setSelected(null)
    setRejectReason('')
    showToast(`Payment ${decision} successfully`)
  }

  const filtered = payments.filter(p =>
    filter === 'all' ? true : (p.approval_status || 'pending_review') === filter
  )

  const counts = {
    pending_review: payments.filter(p => (p.approval_status || 'pending_review') === 'pending_review').length,
    approved: payments.filter(p => p.approval_status === 'approved').length,
    rejected: payments.filter(p => p.approval_status === 'rejected').length,
  }

  const statusStyle = {
    pending_review: { bg: '#fff9f0', color: '#b45309', border: '#fde68a', label: 'Pending' },
    approved:       { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Approved' },
    rejected:       { bg: '#fff5f5', color: '#dc2626', border: '#fecaca', label: 'Rejected' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7ff', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .nav { background: #1e2d5a; height: 58px; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
        .nav-logo { color: #fff; font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .nav-right { display: flex; align-items: center; gap: 10px; }
        .nav-link { background: none; border: none; color: #8fa8d8; font-size: 13px; font-family: 'Inter',sans-serif; cursor: pointer; padding: 6px 12px; border-radius: 7px; transition: all 0.15s; }
        .nav-link:hover { background: #2a3f70; color: #fff; }
        .notif-btn { position: relative; background: none; border: none; cursor: pointer; padding: 6px; }
        .notif-badge { position: absolute; top: 0; right: 0; background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .notif-panel { position: absolute; right: 0; top: 48px; width: 320px; background: #fff; border-radius: 14px; box-shadow: 0 8px 40px rgba(0,0,0,0.15); border: 1.5px solid #e8ecf8; z-index: 100; overflow: hidden; }
        .notif-header { padding: 14px 16px; border-bottom: 1px solid #f0f2fc; display: flex; justify-content: space-between; align-items: center; }
        .notif-title { font-size: 13px; font-weight: 700; color: #111; }
        .notif-clear { font-size: 11px; color: #2563eb; cursor: pointer; background: none; border: none; font-family: 'Inter',sans-serif; }
        .notif-item { padding: 12px 16px; border-bottom: 1px solid #f8f9ff; }
        .notif-item-title { font-size: 13px; font-weight: 600; color: #111; margin-bottom: 3px; }
        .notif-item-msg { font-size: 12px; color: #888; line-height: 1.4; }
        .notif-empty { padding: 24px; text-align: center; color: #bbb; font-size: 13px; }
        .page { max-width: 1100px; margin: 0 auto; padding: 28px 20px; }
        .page-title { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 20px; }
        .stat-row { display: flex; gap: 12px; margin-bottom: 22px; flex-wrap: wrap; }
        .stat-pill { padding: 10px 20px; border-radius: 30px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1.5px solid transparent; transition: all 0.15s; }
        .filter-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-tab { padding: 8px 18px; border-radius: 30px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1.5px solid #e8ecf8; background: #fff; color: #888; font-family: 'Inter',sans-serif; transition: all 0.15s; }
        .filter-tab.active { background: #1e2d5a; color: #fff; border-color: #1e2d5a; }
        .table-wrap { background: #fff; border-radius: 16px; box-shadow: 0 1px 8px rgba(0,0,0,0.06); overflow: hidden; border: 1.5px solid #eef1fb; }
        .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
        .tbl thead tr { background: #f8f9ff; }
        .tbl th { padding: 12px 16px; text-align: left; font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; border-bottom: 1.5px solid #eef1fb; }
        .tbl td { padding: 13px 16px; border-bottom: 1px solid #f0f2fc; color: #333; vertical-align: middle; }
        .tbl tr:last-child td { border-bottom: none; }
        .tbl tbody tr:hover td { background: #f8f9ff; cursor: pointer; }
        .badge { display: inline-block; padding: 3px 11px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .empty { text-align: center; padding: 60px; color: #ccc; font-size: 14px; }
        .overlay { position: fixed; inset: 0; background: rgba(10,15,40,0.55); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(2px); }
        .modal { background: #fff; border-radius: 20px; padding: 32px; width: 100%; max-width: 680px; box-shadow: 0 20px 60px rgba(0,0,0,0.18); max-height: 90vh; overflow-y: auto; }
        .ss-img { width: 100%; max-height: 320px; object-fit: contain; border-radius: 10px; border: 1.5px solid #e8ecf8; margin-top: 14px; cursor: pointer; }
        .ss-img:hover { border-color: #3b6be8; }
        .modal-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 20px; }
        .detail-row { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #f0f0f0; }
        .detail-row:last-of-type { border-bottom: none; }
        .d-label { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; }
        .d-value { font-size: 13px; color: #111; font-weight: 600; text-align: right; }
        .ss-link { display: inline-flex; align-items: center; gap: 5px; color: #2563eb; font-size: 13px; text-decoration: none; margin-top: 14px; font-weight: 500; }
        .ss-link:hover { text-decoration: underline; }
        .decision-section { margin-top: 20px; padding-top: 20px; border-top: 1.5px solid #f0f2fc; }
        .decision-title { font-size: 13px; font-weight: 700; color: #555; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .reject-input { width: 100%; background: #f8f9ff; border: 1.5px solid #e8ecf8; border-radius: 10px; padding: 11px 14px; color: #111; font-size: 13px; font-family: 'Inter',sans-serif; outline: none; margin-bottom: 14px; resize: none; }
        .reject-input:focus { border-color: #3b6be8; }
        .action-btns { display: flex; gap: 10px; }
        .btn-approve { flex: 1; background: #16a34a; border: none; border-radius: 10px; padding: 13px; color: #fff; font-size: 14px; font-weight: 700; font-family: 'Inter',sans-serif; cursor: pointer; transition: background 0.2s; }
        .btn-approve:hover:not(:disabled) { background: #15803d; }
        .btn-reject { flex: 1; background: #dc2626; border: none; border-radius: 10px; padding: 13px; color: #fff; font-size: 14px; font-weight: 700; font-family: 'Inter',sans-serif; cursor: pointer; transition: background 0.2s; }
        .btn-reject:hover:not(:disabled) { background: #b91c1c; }
        .btn-approve:disabled, .btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-close { width: 100%; margin-top: 10px; background: #f5f7ff; border: 1.5px solid #e8ecf8; border-radius: 10px; padding: 11px; color: #888; font-size: 13px; font-family: 'Inter',sans-serif; cursor: pointer; }
        .toast { position: fixed; bottom: 24px; right: 24px; background: #111; color: #fff; padding: 12px 20px; border-radius: 12px; font-size: 13px; font-weight: 500; z-index: 999; box-shadow: 0 4px 20px rgba(0,0,0,0.3); animation: slidein 0.3s ease; }
        @keyframes slidein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .already-reviewed { background: #f8f9ff; border: 1.5px solid #e8ecf8; border-radius: 10px; padding: 14px; margin-top: 20px; text-align: center; color: #888; font-size: 13px; }
      `}</style>

      <nav className="nav">
        <div className="nav-logo">🛡️ Payment Verifier</div>
        <div className="nav-right">
          <span style={{color:'#4a6090',fontSize:'11px',padding:'3px 8px',background:'#2a3f70',borderRadius:'20px'}}>💼 Finance</span>
          <button className="nav-link" onClick={() => router.push('/tags')}>🏷️ Tags</button>
          <button className="nav-link" style={{color:'#f87171'}} onClick={logout}>Logout</button>
          <div style={{ position: 'relative' }}>
            <button className="notif-btn" onClick={() => setShowNotif(!showNotif)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8fa8d8" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {notifications.length > 0 && (
                <span className="notif-badge">{notifications.length > 9 ? '9+' : notifications.length}</span>
              )}
            </button>
            {showNotif && (
              <div className="notif-panel">
                <div className="notif-header">
                  <span className="notif-title">Notifications</span>
                  {notifications.length > 0 && <button className="notif-clear" onClick={markAllRead}>Mark all read</button>}
                </div>
                {notifications.length === 0 ? (
                  <div className="notif-empty">No new notifications</div>
                ) : notifications.map(n => (
                  <div key={n.id} className="notif-item">
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-msg">{n.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="page">
        <div className="page-title">Finance Review Queue</div>

        {/* Filter tabs */}
        <div className="filter-tabs">
          {[
            { key: 'pending_review', label: `⏳ Pending (${counts.pending_review})` },
            { key: 'approved',       label: `✅ Approved (${counts.approved})` },
            { key: 'rejected',       label: `❌ Rejected (${counts.rejected})` },
            { key: 'all',            label: `All (${payments.length})` },
          ].map(t => (
            <button key={t.key} className={`filter-tab${filter === t.key ? ' active' : ''}`} onClick={() => setFilter(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <div className="empty">No payments in this category</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Sender</th>
                  <th>Method</th>
                  <th>Submitted By</th>
                  <th>AI Check</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const approvalStatus = p.approval_status || 'pending_review'
                  const ss = statusStyle[approvalStatus] || statusStyle.pending_review
                  return (
                    <tr key={p.id} onClick={() => { setSelected(p); setRejectReason('') }}>
                      <td style={{ color: '#aaa', fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td style={{ fontWeight: '700', color: '#111' }}>{p.amount}</td>
                      <td>{p.sender_name}</td>
                      <td style={{ color: '#888' }}>{p.payment_method}</td>
                      <td style={{ color: '#aaa', fontSize: '12px' }}>{p.uploaded_by}</td>
                      <td>
                        <span className="badge" style={{
                          background: p.status === 'verified' ? '#dcfce7' : p.status === 'suspicious' ? '#fef9c3' : '#f3f4f6',
                          color: p.status === 'verified' ? '#15803d' : p.status === 'suspicious' ? '#b45309' : '#374151'
                        }}>{p.status}</span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
                          {ss.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Review Payment</div>

            {[
              ['Amount', selected.amount],
              ['Sender', selected.sender_name],
              ['Transaction ID', selected.transaction_id],
              ['Memo', selected.memo],
              ['Date on Screenshot', selected.date_time],
              ['Payment Method', selected.payment_method],
              ['Submitted By', selected.uploaded_by],
              ['AI Check Result', selected.status],
              ['Submitted At', new Date(selected.created_at).toLocaleString()],
            ].filter(([, v]) => v && v !== 'UNKNOWN').map(([l, v]) => (
              <div className="detail-row" key={l}>
                <div className="d-label">{l}</div>
                <div className="d-value">{v}</div>
              </div>
            ))}

            {selected.screenshot_url && (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, marginBottom: '8px' }}>Payment Screenshot</div>
                <img
                  src={selected.screenshot_url}
                  alt="Payment screenshot"
                  className="ss-img"
                  onClick={() => window.open(selected.screenshot_url, '_blank')}
                  title="Click to open full size"
                />
                <a href={selected.screenshot_url} target="_blank" rel="noopener noreferrer" className="ss-link">
                  ↗ Open full size
                </a>
              </div>
            )}

            {(selected.approval_status || 'pending_review') === 'pending_review' ? (
              <div className="decision-section">
                <div className="decision-title">Make Decision</div>
                <textarea
                  className="reject-input"
                  rows={2}
                  placeholder="Rejection reason (required if rejecting)..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
                <div className="action-btns">
                  <button className="btn-approve" disabled={acting} onClick={() => handleDecision('approved')}>
                    {acting ? '...' : '✅ Approve'}
                  </button>
                  <button className="btn-reject" disabled={acting || !rejectReason.trim()} onClick={() => handleDecision('rejected')}>
                    {acting ? '...' : '❌ Reject'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="already-reviewed">
                {selected.approval_status === 'approved' ? '✅ Approved' : '❌ Rejected'} by {selected.reviewed_by} on {new Date(selected.reviewed_at).toLocaleString()}
                {selected.rejection_reason && <div style={{ marginTop: 6, color: '#dc2626' }}>Reason: {selected.rejection_reason}</div>}
              </div>
            )}

            <button className="btn-close" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast.msg}</div>}
    </div>
  )
}
