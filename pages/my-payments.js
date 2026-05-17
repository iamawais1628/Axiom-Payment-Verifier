import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function MyPayments() {
  const [payments, setPayments] = useState([])
  const [profile, setProfile] = useState(null)
  const [selected, setSelected] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [showNotif, setShowNotif] = useState(false)
  const [filter, setFilter] = useState('all')
  const router = useRouter()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (prof?.role === 'finance') { router.push('/finance'); return }
    setProfile(prof || { email: user.email })
    loadPayments(user.email)
    loadNotifications(user.email)

    supabase.channel('agent-channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payments' }, () => loadPayments(user.email))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => loadNotifications(user.email))
      .subscribe()
  }

  const loadPayments = async (email) => {
    const { data } = await supabase.from('payments').select('*')
      .eq('uploaded_by', email).order('created_at', { ascending: false })
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

  const filtered = payments.filter(p =>
    filter === 'all' ? true : (p.approval_status || 'pending_review') === filter
  )

  const counts = {
    all: payments.length,
    pending_review: payments.filter(p => (p.approval_status || 'pending_review') === 'pending_review').length,
    approved: payments.filter(p => p.approval_status === 'approved').length,
    rejected: payments.filter(p => p.approval_status === 'rejected').length,
  }

  const approvalMeta = {
    pending_review: { icon: '⏳', label: 'Pending Review', bg: '#fff9f0', color: '#b45309', border: '#fde68a' },
    approved:       { icon: '✅', label: 'Approved',       bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    rejected:       { icon: '❌', label: 'Rejected',       bg: '#fff5f5', color: '#dc2626', border: '#fecaca' },
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
        .nav-btn { background: #2563eb; border: none; border-radius: 8px; color: #fff; font-size: 13px; padding: 8px 16px; cursor: pointer; font-family: 'Inter',sans-serif; font-weight: 500; }
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
        .page { max-width: 960px; margin: 0 auto; padding: 28px 20px; }
        .page-title { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .page-sub { font-size: 13px; color: #999; margin-bottom: 22px; }
        .filter-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-tab { padding: 8px 18px; border-radius: 30px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1.5px solid #e8ecf8; background: #fff; color: #888; font-family: 'Inter',sans-serif; transition: all 0.15s; }
        .filter-tab.active { background: #1e2d5a; color: #fff; border-color: #1e2d5a; }
        .cards-list { display: flex; flex-direction: column; gap: 12px; }
        .pay-card { background: #fff; border-radius: 14px; padding: 18px 20px; border: 1.5px solid #eef1fb; box-shadow: 0 1px 6px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; gap: 16px; cursor: pointer; transition: all 0.15s; }
        .pay-card:hover { border-color: #a5b4fc; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .pay-left { flex: 1; }
        .pay-method { font-size: 12px; color: #aaa; font-weight: 500; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
        .pay-amount { font-size: 22px; font-weight: 700; color: #111; }
        .pay-sender { font-size: 13px; color: #555; margin-top: 3px; }
        .pay-date { font-size: 11px; color: #ccc; margin-top: 4px; }
        .pay-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .status-big { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 30px; font-size: 13px; font-weight: 700; }
        .ai-badge { font-size: 11px; padding: 3px 9px; border-radius: 20px; font-weight: 600; }
        .empty { text-align: center; padding: 60px; color: #ccc; font-size: 14px; }
        .overlay { position: fixed; inset: 0; background: rgba(10,15,40,0.55); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(2px); }
        .modal { background: #fff; border-radius: 20px; padding: 32px; width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(0,0,0,0.18); max-height: 90vh; overflow-y: auto; }
        .modal-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 20px; }
        .detail-row { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #f0f0f0; }
        .d-label { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; }
        .d-value { font-size: 13px; color: #111; font-weight: 600; text-align: right; }
        .status-banner { border-radius: 12px; padding: 16px 18px; margin: 20px 0; text-align: center; }
        .status-banner-icon { font-size: 32px; margin-bottom: 6px; }
        .status-banner-label { font-size: 16px; font-weight: 700; }
        .status-banner-sub { font-size: 12px; margin-top: 4px; opacity: 0.8; }
        .reject-reason-box { background: #fff5f5; border: 1.5px solid #fecaca; border-radius: 10px; padding: 12px 14px; margin-top: 12px; }
        .reject-reason-label { font-size: 11px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .reject-reason-text { font-size: 13px; color: #333; }
        .ss-link { display: inline-flex; align-items: center; gap: 5px; color: #2563eb; font-size: 13px; text-decoration: none; margin-top: 14px; font-weight: 500; }
        .btn-close { width: 100%; margin-top: 16px; background: #f5f7ff; border: 1.5px solid #e8ecf8; border-radius: 10px; padding: 12px; color: #888; font-size: 13px; font-family: 'Inter',sans-serif; cursor: pointer; }
      `}</style>

      <nav className="nav">
        <div className="nav-logo" onClick={() => router.push('/upload')}>🛡️ Payment Verifier</div>
        <div className="nav-right">
          <span style={{color:'#4a6090',fontSize:'11px',padding:'3px 8px',background:'#2a3f70',borderRadius:'20px'}}>👤 Agent</span>
          <button className="nav-link" onClick={() => router.push('/tags')}>🏷️ Tags</button>
          <button className="nav-btn" onClick={() => router.push('/upload')}>+ New Upload</button>
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
                {notifications.length === 0
                  ? <div className="notif-empty">No new notifications</div>
                  : notifications.map(n => (
                    <div key={n.id} className="notif-item">
                      <div className="notif-item-title">{n.title}</div>
                      <div className="notif-item-msg">{n.message}</div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="page">
        <div className="page-title">My Payments</div>
        <div className="page-sub">Track all your submitted payments and their approval status in real-time</div>

        <div className="filter-tabs">
          {[
            { key: 'all',            label: `All (${counts.all})` },
            { key: 'pending_review', label: `⏳ Pending (${counts.pending_review})` },
            { key: 'approved',       label: `✅ Approved (${counts.approved})` },
            { key: 'rejected',       label: `❌ Rejected (${counts.rejected})` },
          ].map(t => (
            <button key={t.key} className={`filter-tab${filter === t.key ? ' active' : ''}`} onClick={() => setFilter(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="cards-list">
          {filtered.length === 0 ? (
            <div className="empty">No payments found</div>
          ) : filtered.map(p => {
            const aStatus = p.approval_status || 'pending_review'
            const am = approvalMeta[aStatus] || approvalMeta.pending_review
            return (
              <div key={p.id} className="pay-card" onClick={() => setSelected(p)}>
                <div className="pay-left">
                  <div className="pay-method">{p.payment_method}</div>
                  <div className="pay-amount">{p.amount}</div>
                  <div className="pay-sender">from {p.sender_name}</div>
                  <div className="pay-date">{new Date(p.created_at).toLocaleString()}</div>
                </div>
                <div className="pay-right">
                  <div className="status-big" style={{ background: am.bg, color: am.color, border: `1.5px solid ${am.border}` }}>
                    {am.icon} {am.label}
                  </div>
                  <span className="ai-badge" style={{
                    background: p.status === 'verified' ? '#dcfce7' : '#fef9c3',
                    color: p.status === 'verified' ? '#15803d' : '#b45309'
                  }}>AI: {p.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (() => {
        const aStatus = selected.approval_status || 'pending_review'
        const am = approvalMeta[aStatus] || approvalMeta.pending_review
        return (
          <div className="overlay" onClick={() => setSelected(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Payment Details</div>

              {[
                ['Amount', selected.amount],
                ['Sender', selected.sender_name],
                ['Transaction ID', selected.transaction_id],
                ['Memo', selected.memo],
                ['Date on Screenshot', selected.date_time],
                ['Payment Method', selected.payment_method],
                ['Submitted At', new Date(selected.created_at).toLocaleString()],
              ].filter(([, v]) => v && v !== 'UNKNOWN').map(([l, v]) => (
                <div className="detail-row" key={l}>
                  <div className="d-label">{l}</div>
                  <div className="d-value">{v}</div>
                </div>
              ))}

              {/* Big status banner */}
              <div className="status-banner" style={{ background: am.bg, border: `1.5px solid ${am.border}` }}>
                <div className="status-banner-icon">{am.icon}</div>
                <div className="status-banner-label" style={{ color: am.color }}>{am.label}</div>
                {aStatus === 'pending_review' && (
                  <div className="status-banner-sub" style={{ color: am.color }}>Finance team is reviewing your payment</div>
                )}
                {aStatus === 'approved' && selected.reviewed_by && (
                  <div className="status-banner-sub" style={{ color: am.color }}>
                    Approved by {selected.reviewed_by}
                  </div>
                )}
              </div>

              {/* Rejection reason */}
              {aStatus === 'rejected' && selected.rejection_reason && (
                <div className="reject-reason-box">
                  <div className="reject-reason-label">Rejection Reason</div>
                  <div className="reject-reason-text">{selected.rejection_reason}</div>
                </div>
              )}

              {selected.screenshot_url && (
                <a href={selected.screenshot_url} target="_blank" rel="noopener noreferrer" className="ss-link">
                  🖼️ View Screenshot ↗
                </a>
              )}

              <button className="btn-close" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
