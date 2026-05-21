import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function MyPayments() {
  const [payments, setPayments] = useState([])
  const [profile, setProfile] = useState(null)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (prof?.role === 'finance') { router.replace('/finance'); return }
    if (prof?.role === 'admin') { router.replace('/dashboard'); return }
    setProfile(prof || { email: user.email })
    loadPayments(user.email)

    supabase.channel('agent-payments')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payments' }, () => loadPayments(user.email))
      .subscribe()
  }

  const loadPayments = async (email) => {
    const { data } = await supabase.from('payments').select('*')
      .eq('uploaded_by', email).order('created_at', { ascending: false })
    if (data) setPayments(data)
    setLoading(false)
  }

  const filtered = payments.filter(p => {
    const matchFilter = filter === 'all' || (p.approval_status || 'pending_review') === filter
    const matchSearch = !search || JSON.stringify(p).toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const counts = {
    all: payments.length,
    pending_review: payments.filter(p => (p.approval_status || 'pending_review') === 'pending_review').length,
    approved: payments.filter(p => p.approval_status === 'approved').length,
    rejected: payments.filter(p => p.approval_status === 'rejected').length,
  }

  const AM = {
    pending_review: { icon: '⏳', label: 'Pending Review', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    approved:       { icon: '✅', label: 'Approved',       color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    rejected:       { icon: '❌', label: 'Rejected',       color: '#dc2626', bg: '#fff5f5', border: '#fecaca' },
  }

  return (
    <Layout title="My Payments">
      <style>{`
        .stats-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .stat-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 20px; flex: 1; min-width: 110px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .stat-num { font-size: 28px; font-weight: 800; line-height: 1; }
        .stat-lbl { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.7px; margin-top: 5px; font-weight: 600; }
        .controls { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .search-inp { flex: 1; min-width: 200px; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; color: #0f172a; font-size: 13px; font-family: 'Inter',sans-serif; outline: none; transition: border-color 0.2s; }
        .search-inp:focus { border-color: #3b82f6; }
        .filter-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
        .ftab { padding: 8px 16px; border-radius: 30px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1.5px solid #e2e8f0; background: #fff; color: #64748b; font-family: 'Inter',sans-serif; transition: all 0.15s; }
        .ftab.active { background: #0f172a; color: #fff; border-color: #0f172a; }
        .pay-list { display: flex; flex-direction: column; gap: 10px; }
        .pay-card { background: #fff; border-radius: 14px; padding: 18px 20px; border: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 16px; cursor: pointer; transition: all 0.15s; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .pay-card:hover { border-color: #93c5fd; box-shadow: 0 2px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .pay-method { font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .pay-amount { font-size: 22px; font-weight: 800; color: #0f172a; }
        .pay-sender { font-size: 13px; color: #475569; margin-top: 3px; }
        .pay-date { font-size: 11px; color: #cbd5e1; margin-top: 5px; }
        .status-pill { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 30px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .ai-badge { font-size: 10px; padding: 3px 9px; border-radius: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
        .empty { text-align: center; padding: 60px; color: #cbd5e1; font-size: 14px; background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; }
        .overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
        .modal { background: #fff; border-radius: 20px; padding: 32px; width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); max-height: 88vh; overflow-y: auto; }
        .modal-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 20px; }
        .d-row { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #f1f5f9; }
        .d-row:last-of-type { border-bottom: none; }
        .d-lbl { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
        .d-val { font-size: 13px; color: #0f172a; font-weight: 600; text-align: right; word-break: break-all; }
        .status-banner { border-radius: 14px; padding: 20px; margin: 18px 0; text-align: center; }
        .status-banner-icon { font-size: 36px; margin-bottom: 8px; }
        .status-banner-label { font-size: 17px; font-weight: 800; }
        .status-banner-sub { font-size: 12px; margin-top: 5px; opacity: 0.8; }
        .reject-box { background: #fff5f5; border: 1.5px solid #fecaca; border-radius: 12px; padding: 14px 16px; margin-top: 12px; }
        .reject-box-label { font-size: 10px; font-weight: 800; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .note-box { background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 14px 16px; margin-top: 12px; }
        .note-box-label { font-size: 10px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .ss-link { display: inline-flex; align-items: center; gap: 5px; color: #2563eb; font-size: 13px; text-decoration: none; margin-top: 14px; font-weight: 600; }
        .ss-link:hover { text-decoration: underline; }
        .reupload-btn { width: 100%; background: #1d4ed8; border: none; border-radius: 10px; padding: 12px; color: #fff; font-size: 14px; font-weight: 700; font-family: 'Inter',sans-serif; cursor: pointer; margin-top: 14px; transition: background 0.2s; }
        .reupload-btn:hover { background: #1e40af; }
        .close-btn { width: 100%; margin-top: 10px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px; color: #64748b; font-size: 13px; font-family: 'Inter',sans-serif; cursor: pointer; font-weight: 600; }
        @media(max-width:640px){ .pay-card{flex-direction:column;align-items:flex-start} .pay-amount{font-size:18px} }
      `}</style>

      {/* Stats */}
      <div className="stats-row">
        {[
          { key:'all',            label:'Total',    color:'#0f172a' },
          { key:'pending_review', label:'Pending',  color:'#d97706' },
          { key:'approved',       label:'Approved', color:'#16a34a' },
          { key:'rejected',       label:'Rejected', color:'#dc2626' },
        ].map(s => (
          <div key={s.key} className="stat-card" style={{ cursor:'pointer', borderColor: filter===s.key ? s.color : '#e2e8f0' }} onClick={() => setFilter(s.key)}>
            <div className="stat-num" style={{ color: s.color }}>{counts[s.key]}</div>
            <div className="stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="controls">
        <input className="search-inp" placeholder="🔍  Search by amount, sender, method..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-tabs">
          {[
            { key:'all',            label:'All' },
            { key:'pending_review', label:'⏳ Pending' },
            { key:'approved',       label:'✅ Approved' },
            { key:'rejected',       label:'❌ Rejected' },
          ].map(t => (
            <button key={t.key} className={`ftab${filter===t.key?' active':''}`} onClick={() => setFilter(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="empty">Loading your payments...</div>
      ) : filtered.length === 0 ? (
        <div className="empty">No payments found</div>
      ) : (
        <div className="pay-list">
          {filtered.map(p => {
            const aStatus = p.approval_status || 'pending_review'
            const am = AM[aStatus] || AM.pending_review
            return (
              <div key={p.id} className="pay-card" onClick={() => setSelected(p)}>
                <div>
                  <div className="pay-method">{p.payment_method}</div>
                  <div className="pay-amount">{p.amount}</div>
                  <div className="pay-sender">from {p.sender_name}</div>
                  <div className="pay-date">{new Date(p.created_at).toLocaleString()}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px' }}>
                  <div className="status-pill" style={{ background:am.bg, color:am.color, border:`1.5px solid ${am.border}` }}>
                    {am.icon} {am.label}
                  </div>
                  <span className="ai-badge" style={{
                    background: p.status==='verified'?'#dcfce7':'#fef9c3',
                    color: p.status==='verified'?'#15803d':'#b45309'
                  }}>AI: {p.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (() => {
        const aStatus = selected.approval_status || 'pending_review'
        const am = AM[aStatus] || AM.pending_review
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
              ].filter(([,v]) => v && v !== 'UNKNOWN').map(([l,v]) => (
                <div className="d-row" key={l}>
                  <div className="d-lbl">{l}</div>
                  <div className="d-val">{v}</div>
                </div>
              ))}

              <div className="status-banner" style={{ background:am.bg, border:`1.5px solid ${am.border}` }}>
                <div className="status-banner-icon">{am.icon}</div>
                <div className="status-banner-label" style={{ color:am.color }}>{am.label}</div>
                {aStatus==='pending_review' && <div className="status-banner-sub" style={{ color:am.color }}>Finance team is reviewing your payment</div>}
                {aStatus==='approved' && selected.reviewed_by && <div className="status-banner-sub" style={{ color:am.color }}>Approved by {selected.reviewed_by}</div>}
              </div>

              {aStatus==='rejected' && selected.rejection_reason && (
                <div className="reject-box">
                  <div className="reject-box-label">Rejection Reason</div>
                  <div style={{ fontSize:'13px', color:'#333' }}>{selected.rejection_reason}</div>
                </div>
              )}

              {selected.agent_note && (
                <div className="note-box">
                  <div className="note-box-label">Your Note</div>
                  <div style={{ fontSize:'13px', color:'#333' }}>{selected.agent_note}</div>
                </div>
              )}

              {selected.screenshot_url && (
                <a href={selected.screenshot_url} target="_blank" rel="noopener noreferrer" className="ss-link">🖼️ View Screenshot ↗</a>
              )}

              {aStatus==='rejected' && (
                <button className="reupload-btn" onClick={() => { setSelected(null); router.push('/upload') }}>↑ Re-upload Corrected Screenshot</button>
              )}
              <button className="close-btn" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        )
      })()}
    </Layout>
  )
}
