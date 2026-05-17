import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const METHODS = ['CashApp', 'Chime', 'Zelle', 'TapTap', 'Venmo', 'PayPal']
const METHOD_COLORS = {
  CashApp: '#00D64F', Chime: '#1EC677', Zelle: '#6D1ED4',
  TapTap: '#FF4E00', Venmo: '#3D95CE', PayPal: '#003087'
}
const METHOD_PREFIX = {
  CashApp: '$', Chime: '$', Zelle: '', TapTap: '', Venmo: '@', PayPal: ''
}

export default function Tags() {
  const [tags, setTags] = useState([])
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [editingMethod, setEditingMethod] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [requesting, setRequesting] = useState(null)
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
    setProfile(prof || { role: 'agent', email: user.email, payment_methods: [] })

    loadTags()
    loadRequests()
    loadNotifications(user.email)

    // Realtime subscriptions
    supabase.channel('tags-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, loadTags)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tag_requests' }, loadRequests)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => loadNotifications(user.email))
      .subscribe()
  }

  const loadTags = async () => {
    const { data } = await supabase.from('tags').select('*')
    if (data) setTags(data)
  }

  const loadRequests = async () => {
    const { data } = await supabase.from('tag_requests').select('*').eq('status', 'pending')
    if (data) setRequests(data)
  }

  const loadNotifications = async (email) => {
    const { data } = await supabase.from('notifications').select('*')
      .eq('recipient_email', email).eq('is_read', false).order('created_at', { ascending: false })
    if (data) setNotifications(data)
  }

  const markAllRead = async () => {
    if (!profile) return
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_email', profile.email)
    setNotifications([])
    setShowNotif(false)
  }

  const getTag = (method) => tags.find(t => t.payment_method === method)

  const startEdit = (method) => {
    const tag = getTag(method)
    setEditingMethod(method)
    setEditValue(tag?.tag_value || '')
    setEditLabel(tag?.tag_label || '')
  }

  const saveTag = async () => {
    if (!editValue.trim()) return
    setSaving(true)
    const tag = getTag(editingMethod)
    const oldValue = tag?.tag_value

    await supabase.from('tags').upsert({
      payment_method: editingMethod,
      tag_value: editValue.trim(),
      tag_label: editLabel.trim(),
      updated_by: profile.email,
      updated_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: 'payment_method' })

    // Log history
    if (oldValue !== editValue.trim()) {
      await supabase.from('tag_history').insert({
        payment_method: editingMethod,
        old_value: oldValue,
        new_value: editValue.trim(),
        changed_by: profile.email,
      })
    }

    // Notify all agents
    const { data: agents } = await supabase.from('profiles').select('email').eq('role', 'agent')
    if (agents) {
      const notifs = agents.map(a => ({
        recipient_email: a.email,
        type: 'tag_updated',
        title: `${editingMethod} Tag Updated`,
        message: `The ${editingMethod} payment tag has been updated to: ${editValue.trim()}`,
      }))
      await supabase.from('notifications').insert(notifs)
    }

    // Fulfill any pending requests for this method
    const pendingReqs = requests.filter(r => r.payment_method === editingMethod)
    for (const req of pendingReqs) {
      await supabase.from('tag_requests').update({
        status: 'fulfilled', fulfilled_at: new Date().toISOString(), fulfilled_by: profile.email
      }).eq('id', req.id)

      await supabase.from('notifications').insert({
        recipient_email: req.requested_by,
        type: 'tag_updated',
        title: `${editingMethod} Tag Available`,
        message: `Your tag request for ${editingMethod} has been fulfilled: ${editValue.trim()}`,
      })
    }

    // Send email via Supabase edge function or just log for now
    setSaving(false)
    setEditingMethod(null)
    showToast(`${editingMethod} tag updated successfully`)
  }

  const requestTag = async (method) => {
    setRequesting(method)
    // Check if already requested
    const { data: existing } = await supabase.from('tag_requests').select('*')
      .eq('payment_method', method).eq('requested_by', profile.email).eq('status', 'pending').maybeSingle()

    if (existing) { showToast('You already have a pending request for this tag', 'info'); setRequesting(null); return }

    await supabase.from('tag_requests').insert({
      payment_method: method, requested_by: profile.email
    })

    // Notify finance members who handle this method
    const { data: financeMembers } = await supabase.from('profiles').select('email')
      .eq('role', 'finance').contains('payment_methods', [method])

    // Also notify all finance if none assigned
    const { data: allFinance } = await supabase.from('profiles').select('email').eq('role', 'finance')
    const targets = (financeMembers?.length > 0 ? financeMembers : allFinance) || []

    if (targets.length > 0) {
      await supabase.from('notifications').insert(
        targets.map(f => ({
          recipient_email: f.email,
          type: 'tag_requested',
          title: `Tag Request: ${method}`,
          message: `${profile.email} is requesting the ${method} payment tag.`,
        }))
      )
    }

    setRequesting(null)
    showToast(`Tag request sent for ${method}`)
  }

  const isFinanceFor = (method) => {
    if (!profile) return false
    if (profile.role === 'admin') return true
    return profile.role === 'finance' && (
      profile.payment_methods?.includes(method) || profile.payment_methods?.length === 0
    )
  }

  const pendingRequestsFor = (method) => requests.filter(r => r.payment_method === method)

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
        .page { max-width: 900px; margin: 0 auto; padding: 32px 20px; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
        .page-title { font-size: 20px; font-weight: 700; color: #111; }
        .page-sub { font-size: 13px; color: #999; margin-top: 3px; }
        .tags-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        .tag-card { background: #fff; border-radius: 16px; box-shadow: 0 1px 8px rgba(0,0,0,0.06); border: 1.5px solid #eef1fb; overflow: hidden; }
        .tag-card-top { padding: 18px 20px 14px; display: flex; align-items: center; gap: 12px; }
        .method-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .method-name { font-size: 15px; font-weight: 700; color: #111; }
        .tag-card-body { padding: 0 20px 18px; }
        .tag-value-box { background: #f8f9ff; border: 1.5px solid #e8ecf8; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
        .tag-value { font-size: 18px; font-weight: 700; color: #1e2d5a; letter-spacing: -0.3px; }
        .tag-label { font-size: 11px; color: #aaa; margin-top: 3px; }
        .tag-updated { font-size: 11px; color: #bbb; margin-top: 4px; }
        .no-tag-box { background: #fff9f0; border: 1.5px solid #fed7aa; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
        .no-tag-text { font-size: 13px; color: #92400e; font-weight: 500; }
        .no-tag-sub { font-size: 11px; color: #c2873a; margin-top: 3px; }
        .copy-btn { background: #f5f7ff; border: 1.5px solid #e8ecf8; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; color: #2563eb; cursor: pointer; font-family: 'Inter',sans-serif; transition: all 0.15s; width: 100%; margin-bottom: 8px; }
        .copy-btn:hover { background: #eef2ff; border-color: #a5b4fc; }
        .request-btn { background: #fff9f0; border: 1.5px solid #fed7aa; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; color: #b45309; cursor: pointer; font-family: 'Inter',sans-serif; transition: all 0.15s; width: 100%; }
        .request-btn:hover { background: #fef3e2; }
        .request-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .edit-btn { background: #1e2d5a; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; color: #fff; cursor: pointer; font-family: 'Inter',sans-serif; transition: all 0.15s; width: 100%; margin-bottom: 8px; }
        .edit-btn:hover { background: #2a3f70; }
        .pending-reqs { background: #fff5f5; border: 1.5px solid #fecaca; border-radius: 8px; padding: 8px 12px; margin-bottom: 8px; }
        .pending-reqs-label { font-size: 11px; color: #dc2626; font-weight: 600; }
        .pending-req-item { font-size: 11px; color: #888; margin-top: 3px; }

        /* Edit Modal */
        .overlay { position: fixed; inset: 0; background: rgba(10,15,40,0.55); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(2px); }
        .modal { background: #fff; border-radius: 20px; padding: 32px; width: 100%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.18); }
        .modal-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .modal-sub { font-size: 13px; color: #999; margin-bottom: 24px; }
        .modal-label { font-size: 12px; font-weight: 600; color: #555; margin-bottom: 7px; display: block; }
        .modal-input { width: 100%; background: #f8f9ff; border: 1.5px solid #e8ecf8; border-radius: 10px; padding: 12px 15px; color: #111; font-size: 15px; font-family: 'Inter',sans-serif; outline: none; transition: border-color 0.2s; margin-bottom: 14px; font-weight: 600; }
        .modal-input:focus { border-color: #3b6be8; background: #fff; }
        .modal-actions { display: flex; gap: 10px; margin-top: 8px; }
        .btn-save { flex: 1; background: #2563eb; border: none; border-radius: 10px; padding: 13px; color: #fff; font-size: 14px; font-weight: 600; font-family: 'Inter',sans-serif; cursor: pointer; transition: background 0.2s; }
        .btn-save:hover:not(:disabled) { background: #1d4ed8; }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-cancel { flex: 1; background: #f5f7ff; border: 1.5px solid #e8ecf8; border-radius: 10px; padding: 13px; color: #555; font-size: 14px; font-weight: 600; font-family: 'Inter',sans-serif; cursor: pointer; }
        .btn-cancel:hover { background: #eef2ff; }

        /* Toast */
        .toast { position: fixed; bottom: 24px; right: 24px; background: #111; color: #fff; padding: 12px 20px; border-radius: 12px; font-size: 13px; font-weight: 500; z-index: 999; box-shadow: 0 4px 20px rgba(0,0,0,0.3); animation: slidein 0.3s ease; }
        .toast.info { background: #2563eb; }
        @keyframes slidein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .requests-section { margin-top: 32px; }
        .requests-title { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 14px; }
        .req-card { background: #fff; border: 1.5px solid #fecaca; border-radius: 12px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .req-info { font-size: 13px; color: #333; }
        .req-method { font-weight: 700; color: #dc2626; }
        .req-by { font-size: 12px; color: #aaa; margin-top: 3px; }
        .req-time { font-size: 11px; color: #ccc; margin-top: 2px; }
        .fulfill-btn { background: #dcfce7; border: 1.5px solid #bbf7d0; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; color: #15803d; cursor: pointer; font-family: 'Inter',sans-serif; white-space: nowrap; }
        .fulfill-btn:hover { background: #bbf7d0; }
      `}</style>

      <nav className="nav">
        <div className="nav-logo" onClick={() => router.push('/')}>🛡️ Payment Verifier</div>
        <div className="nav-right">
          {profile?.role === 'finance' || profile?.role === 'admin' ? (
            <span style={{color:'#4a6090',fontSize:'11px',padding:'3px 8px',background:'#2a3f70',borderRadius:'20px'}}>💼 {profile?.role === 'admin' ? 'Admin' : 'Finance'}</span>
          ) : (
            <span style={{color:'#4a6090',fontSize:'11px',padding:'3px 8px',background:'#2a3f70',borderRadius:'20px'}}>👤 Agent</span>
          )}
          {profile?.role === 'agent' && <button className="nav-link" onClick={() => router.push('/upload')}>Upload</button>}
          {profile?.role === 'agent' && <button className="nav-link" onClick={() => router.push('/my-payments')}>My Payments</button>}
          {(profile?.role === 'finance' || profile?.role === 'admin') && <button className="nav-link" onClick={() => router.push('/finance')}>Review Queue</button>}
          {profile?.role === 'admin' && <button className="nav-link" onClick={() => router.push('/dashboard')}>Dashboard</button>}

          {/* Notification Bell */}
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
        <div className="page-header">
          <div>
            <div className="page-title">Payment Tags</div>
            <div className="page-sub">
              {profile?.role === 'agent'
                ? 'Current payment tags — send money to these accounts'
                : 'Manage payment tags for your assigned methods'}
            </div>
          </div>
        </div>

        {/* Tags Grid */}
        <div className="tags-grid">
          {METHODS.map(method => {
            const tag = getTag(method)
            const hasTag = tag?.tag_value
            const isFinance = isFinanceFor(method)
            const pendingReqs = pendingRequestsFor(method)
            const color = METHOD_COLORS[method]
            const prefix = METHOD_PREFIX[method]

            return (
              <div key={method} className="tag-card">
                <div className="tag-card-top">
                  <div className="method-dot" style={{ background: color }} />
                  <div className="method-name">{method}</div>
                </div>
                <div className="tag-card-body">

                  {/* Tag value display */}
                  {hasTag ? (
                    <div className="tag-value-box">
                      <div className="tag-value">{prefix}{tag.tag_value}</div>
                      {tag.tag_label && <div className="tag-label">{tag.tag_label}</div>}
                      {tag.updated_at && (
                        <div className="tag-updated">
                          Updated {new Date(tag.updated_at).toLocaleString()} by {tag.updated_by}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="no-tag-box">
                      <div className="no-tag-text">⚠️ No tag available</div>
                      <div className="no-tag-sub">Finance has not set a tag yet</div>
                    </div>
                  )}

                  {/* Pending requests — finance only */}
                  {isFinance && pendingReqs.length > 0 && (
                    <div className="pending-reqs">
                      <div className="pending-reqs-label">🔔 {pendingReqs.length} tag request{pendingReqs.length > 1 ? 's' : ''}</div>
                      {pendingReqs.map(r => (
                        <div key={r.id} className="pending-req-item">↳ {r.requested_by}</div>
                      ))}
                    </div>
                  )}

                  {/* Agent actions */}
                  {!isFinance && (
                    <>
                      {hasTag && (
                        <button className="copy-btn" onClick={() => {
                          navigator.clipboard.writeText(prefix + tag.tag_value)
                          showToast('Tag copied to clipboard!')
                        }}>
                          📋 Copy Tag
                        </button>
                      )}
                      <button
                        className="request-btn"
                        disabled={requesting === method}
                        onClick={() => requestTag(method)}
                      >
                        {requesting === method ? 'Requesting...' : hasTag ? '🔄 Request Tag Update' : '📨 Request Tag'}
                      </button>
                    </>
                  )}

                  {/* Finance actions */}
                  {isFinance && (
                    <button className="edit-btn" onClick={() => startEdit(method)}>
                      ✏️ {hasTag ? 'Update Tag' : 'Set Tag'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Pending requests list — finance only */}
        {profile?.role !== 'agent' && requests.length > 0 && (
          <div className="requests-section">
            <div className="requests-title">📨 Pending Tag Requests ({requests.length})</div>
            {requests.map(r => (
              <div key={r.id} className="req-card">
                <div className="req-info">
                  <div><span className="req-method">{r.payment_method}</span> tag requested</div>
                  <div className="req-by">by {r.requested_by}</div>
                  <div className="req-time">{new Date(r.requested_at).toLocaleString()}</div>
                </div>
                {isFinanceFor(r.payment_method) && (
                  <button className="fulfill-btn" onClick={() => startEdit(r.payment_method)}>
                    Set Tag →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Tag Modal */}
      {editingMethod && (
        <div className="overlay" onClick={() => setEditingMethod(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Update {editingMethod} Tag</div>
            <div className="modal-sub">This will notify all agents immediately</div>

            <label className="modal-label">{editingMethod} Tag / Handle</label>
            <input
              className="modal-input"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              placeholder={
                editingMethod === 'CashApp' ? '$cashtag' :
                editingMethod === 'Venmo' ? '@username' :
                editingMethod === 'Zelle' ? 'email or phone' :
                editingMethod === 'PayPal' ? 'email or @username' :
                'tag / handle'
              }
              autoFocus
            />

            <label className="modal-label">Label (optional)</label>
            <input
              className="modal-input"
              style={{ fontSize: '14px', fontWeight: '400' }}
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              placeholder="e.g. Main Finance Account"
            />

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setEditingMethod(null)}>Cancel</button>
              <button className="btn-save" onClick={saveTag} disabled={saving || !editValue.trim()}>
                {saving ? 'Saving...' : 'Save & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
