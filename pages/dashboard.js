import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [payments, setPayments] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const router = useRouter()

  useEffect(() => { checkUserAndLoad() }, [])

  const checkUserAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const role = prof?.role || 'agent'
    // Only admin can see full dashboard, others redirect to their page
    if (role === 'agent') { router.push('/upload'); return }
    if (role === 'finance') { router.push('/finance'); return }
    loadPayments()
  }

  const loadPayments = async () => {
    const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false })
    if (data) setPayments(data)
    setLoading(false)
  }

  const exportCSV = () => {
    const headers = ['Date', 'Transaction ID', 'Amount', 'Sender', 'Memo', 'Method', 'Uploaded By', 'Status']
    const rows = filtered.map(p => [
      new Date(p.created_at).toLocaleString(), p.transaction_id, p.amount,
      p.sender_name, p.memo, p.payment_method, p.uploaded_by, p.status,
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v || ''}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `payments-${Date.now()}.csv`
    a.click()
  }

  const filtered = payments.filter(p => {
    const matchSearch = !search || JSON.stringify(p).toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    const matchMethod = filterMethod === 'all' || p.payment_method === filterMethod
    return matchSearch && matchStatus && matchMethod
  })

  const stats = {
    total: payments.length,
    verified: payments.filter(p => p.status === 'verified').length,
    duplicate: payments.filter(p => p.status === 'duplicate').length,
    suspicious: payments.filter(p => p.status === 'suspicious').length,
    flagRate: payments.length > 0 ? Math.round(
      (payments.filter(p => p.status === 'duplicate' || p.status === 'suspicious').length / payments.length) * 100
    ) : 0,
  }

  const methods = [...new Set(payments.map(p => p.payment_method).filter(Boolean))]

  const statusStyle = {
    verified:   { bg: '#dcfce7', color: '#15803d' },
    duplicate:  { bg: '#fee2e2', color: '#dc2626' },
    suspicious: { bg: '#fef9c3', color: '#b45309' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7ff', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }

        .nav {
          background: #1e2d5a; height: 58px; padding: 0 28px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; z-index: 10;
        }
        .nav-logo { color: #fff; font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
        .nav-btn { background: #2563eb; border: none; border-radius: 8px; color: #fff; font-size: 13px; padding: 8px 16px; cursor: pointer; font-family: 'Inter',sans-serif; font-weight: 500; transition: background 0.2s; }
        .nav-btn:hover { background: #1d4ed8; }

        .page { max-width: 1200px; margin: 0 auto; padding: 28px 20px; }
        .page-heading { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 20px; }

        .stats-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 12px; margin-bottom: 24px; }
        @media(max-width:768px){ .stats-grid { grid-template-columns: repeat(2,1fr); } }

        .stat-card { background: #fff; border-radius: 14px; box-shadow: 0 1px 8px rgba(0,0,0,0.06); padding: 18px 20px; border: 1.5px solid #eef1fb; }
        .stat-num { font-size: 30px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
        .stat-lbl { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 0.7px; margin-top: 6px; font-weight: 500; }

        .controls { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; align-items: center; }
        .search-input {
          flex: 1; min-width: 200px; background: #fff;
          border: 1.5px solid #e8ecf8; border-radius: 10px;
          padding: 10px 14px; color: #111; font-size: 13px;
          font-family: 'Inter',sans-serif; outline: none; transition: border-color 0.2s;
        }
        .search-input:focus { border-color: #3b6be8; }
        .filter-select {
          background: #fff; border: 1.5px solid #e8ecf8; border-radius: 10px;
          padding: 10px 13px; color: #555; font-size: 13px;
          font-family: 'Inter',sans-serif; outline: none; cursor: pointer;
        }
        .export-btn {
          background: none; border: 1.5px solid #e8ecf8; border-radius: 10px;
          color: #777; font-size: 13px; padding: 10px 16px; cursor: pointer;
          font-family: 'Inter',sans-serif; font-weight: 500; white-space: nowrap; transition: all 0.2s;
        }
        .export-btn:hover { border-color: #16a34a; color: #16a34a; background: #f0fdf4; }

        .table-wrap { background: #fff; border-radius: 16px; box-shadow: 0 1px 8px rgba(0,0,0,0.06); overflow: hidden; border: 1.5px solid #eef1fb; }
        .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
        .tbl thead tr { background: #f8f9ff; }
        .tbl th { padding: 12px 16px; text-align: left; font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; border-bottom: 1.5px solid #eef1fb; }
        .tbl td { padding: 13px 16px; border-bottom: 1px solid #f0f2fc; color: #333; vertical-align: middle; }
        .tbl tr:last-child td { border-bottom: none; }
        .tbl tbody tr:hover td { background: #f8f9ff; cursor: pointer; }

        .badge { display: inline-block; padding: 3px 11px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }

        .empty { text-align: center; padding: 60px; color: #ccc; font-size: 14px; }

        /* Modal */
        .overlay { position: fixed; inset: 0; background: rgba(10,15,40,0.55); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(2px); }
        .modal { background: #fff; border-radius: 20px; padding: 32px; width: 100%; max-width: 460px; position: relative; max-height: 88vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.18); }
        .modal-close { position: absolute; top: 16px; right: 16px; background: #f5f7ff; border: 1.5px solid #e8ecf8; border-radius: 7px; color: #888; width: 30px; height: 30px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; font-family: 'Inter',sans-serif; }
        .modal-close:hover { border-color: #dc2626; color: #dc2626; }
        .modal-title { font-size: 17px; font-weight: 700; color: #111; margin-bottom: 18px; }
        .modal-row { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #f0f0f0; }
        .modal-row:last-of-type { border-bottom: none; }
        .modal-lbl { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; white-space: nowrap; }
        .modal-val { font-size: 13px; color: #222; font-weight: 500; text-align: right; word-break: break-all; }
        .ss-link { display: inline-flex; align-items: center; gap: 5px; color: #2563eb; font-size: 13px; text-decoration: none; margin-top: 16px; font-weight: 500; }
        .ss-link:hover { text-decoration: underline; }
        .modal-divider { border: none; border-top: 1.5px solid #f0f2fc; margin: 14px 0; }
      `}</style>

      {/* Nav */}
      <nav className="nav">
        <div className="nav-logo">🛡️ Payment Verifier</div>
          <span style={{color:'#4a6090',fontSize:'11px',padding:'3px 8px',background:'#2a3f70',borderRadius:'20px'}}>⚙️ Admin</span>
          <button className="nav-btn" onClick={() => router.push('/finance')}>Finance Queue</button>
          <button className="nav-btn" onClick={() => router.push('/tags')}>Tags</button>
      </nav>

      <div className="page">
        <div className="page-heading">Dashboard</div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#1e2d5a' }}>{stats.total}</div>
            <div className="stat-lbl">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#16a34a' }}>{stats.verified}</div>
            <div className="stat-lbl">Verified</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#dc2626' }}>{stats.duplicate}</div>
            <div className="stat-lbl">Duplicates</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#d97706' }}>{stats.suspicious}</div>
            <div className="stat-lbl">Suspicious</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#2563eb' }}>{stats.flagRate}%</div>
            <div className="stat-lbl">Flag Rate</div>
          </div>
        </div>

        {/* Controls */}
        <div className="controls">
          <input className="search-input" placeholder="🔍  Search by name, amount, sender..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="verified">✅ Verified</option>
            <option value="duplicate">❌ Duplicate</option>
            <option value="suspicious">⚠️ Suspicious</option>
          </select>
          <select className="filter-select" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
            <option value="all">All Methods</option>
            {methods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="export-btn" onClick={exportCSV}>⬇ Export CSV</button>
        </div>

        {/* Table */}
        <div className="table-wrap">
          {loading ? (
            <div className="empty">Loading payments...</div>
          ) : filtered.length === 0 ? (
            <div className="empty">No payments found</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Sender</th>
                  <th>Method</th>
                  <th>Memo</th>
                  <th>Uploaded By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const ss = statusStyle[p.status] || { bg: '#f3f4f6', color: '#374151' }
                  return (
                    <tr key={p.id} onClick={() => setSelected(p)}>
                      <td style={{ color: '#aaa', fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td style={{ fontWeight: '700', color: '#111', fontVariantNumeric: 'tabular-nums' }}>{p.amount}</td>
                      <td style={{ color: '#333' }}>{p.sender_name}</td>
                      <td style={{ color: '#888' }}>{p.payment_method}</td>
                      <td style={{ color: '#bbb', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.memo}</td>
                      <td style={{ color: '#bbb', fontSize: '12px' }}>{p.uploaded_by}</td>
                      <td>
                        <span className="badge" style={{ background: ss.bg, color: ss.color }}>{p.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            <div className="modal-title">Payment Detail</div>
            {(() => {
              const ss = statusStyle[selected.status] || { bg: '#f3f4f6', color: '#374151' }
              return <span className="badge" style={{ background: ss.bg, color: ss.color, marginBottom: '18px', display: 'inline-block' }}>{selected.status}</span>
            })()}
            {[
              ['Date', new Date(selected.created_at).toLocaleString()],
              ['Amount', selected.amount],
              ['Sender', selected.sender_name],
              ['Transaction ID', selected.transaction_id],
              ['Memo', selected.memo],
              ['Date on Screenshot', selected.date_time],
              ['Payment Method', selected.payment_method],
              ['Uploaded By', selected.uploaded_by],
            ].filter(([, v]) => v && v !== 'UNKNOWN').map(([l, v]) => (
              <div className="modal-row" key={l}>
                <div className="modal-lbl">{l}</div>
                <div className="modal-val">{v}</div>
              </div>
            ))}
            {selected.screenshot_url && (
              <a href={selected.screenshot_url} target="_blank" rel="noopener noreferrer" className="ss-link">
                🖼️ View Screenshot ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
