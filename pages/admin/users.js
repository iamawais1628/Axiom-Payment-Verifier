
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

const METHODS = ['CashApp', 'Chime', 'Zelle', 'TapTap', 'Venmo', 'PayPal']
const ROLES = ['agent', 'finance', 'admin']

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [toast, setToast] = useState(null)
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'agent', payment_methods: [] })
  const router = useRouter()

  useEffect(() => { init() }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (prof?.role !== 'admin') { router.push('/'); return }
    loadUsers()
  }

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setUsers(data)
    setLoading(false)
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const toggleMethod = (method, current, setter) => {
    const updated = current.includes(method)
      ? current.filter(m => m !== method)
      : [...current, method]
    setter(updated)
  }

  const createUser = async () => {
    if (!newUser.email || !newUser.password) { showToast('Email and password required', 'error'); return }
    setSaving(true)
    try {
      // Create auth user via Supabase Admin API
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create user')
      showToast(`User ${newUser.email} created successfully`)
      setShowAdd(false)
      setNewUser({ email: '', password: '', full_name: '', role: 'agent', payment_methods: [] })
      loadUsers()
    } catch (err) {
      showToast(err.message, 'error')
    }
    setSaving(false)
  }

  const updateUser = async () => {
    setSaving(true)
    await supabase.from('profiles').update({
      role: editUser.role,
      full_name: editUser.full_name,
      payment_methods: editUser.payment_methods || [],
    }).eq('id', editUser.id)
    showToast('User updated successfully')
    setEditUser(null)
    loadUsers()
    setSaving(false)
  }

  const deleteUser = async (user) => {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return
    await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    })
    showToast(`${user.email} deleted`)
    loadUsers()
  }

  const roleColor = { agent: { bg: '#eff6ff', color: '#1d4ed8' }, finance: { bg: '#fef9c3', color: '#b45309' }, admin: { bg: '#fce7f3', color: '#9d174d' } }

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
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .page-title { font-size: 20px; font-weight: 700; color: #111; }
        .add-btn { background: #2563eb; border: none; border-radius: 10px; color: #fff; font-size: 13px; font-weight: 600; padding: 10px 20px; cursor: pointer; font-family: 'Inter',sans-serif; transition: background 0.2s; }
        .add-btn:hover { background: #1d4ed8; }
        .table-wrap { background: #fff; border-radius: 16px; box-shadow: 0 1px 8px rgba(0,0,0,0.06); overflow: hidden; border: 1.5px solid #eef1fb; }
        .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
        .tbl thead tr { background: #f8f9ff; }
        .tbl th { padding: 12px 16px; text-align: left; font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; border-bottom: 1.5px solid #eef1fb; }
        .tbl td { padding: 13px 16px; border-bottom: 1px solid #f0f2fc; color: #333; vertical-align: middle; }
        .tbl tr:last-child td { border-bottom: none; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .method-tag { display: inline-block; background: #f0f4ff; color: #2563eb; border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 500; margin: 2px; }
        .action-btn { background: none; border: 1px solid #e8ecf8; border-radius: 7px; color: #555; font-size: 12px; padding: 5px 12px; cursor: pointer; font-family: 'Inter',sans-serif; transition: all 0.15s; margin-right: 6px; }
        .action-btn:hover { border-color: #3b6be8; color: #3b6be8; }
        .action-btn.del:hover { border-color: #dc2626; color: #dc2626; }
        .empty { text-align: center; padding: 60px; color: #ccc; font-size: 14px; }
        .overlay { position: fixed; inset: 0; background: rgba(10,15,40,0.55); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(2px); }
        .modal { background: #fff; border-radius: 20px; padding: 32px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.18); max-height: 90vh; overflow-y: auto; }
        .modal-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 24px; }
        .field { margin-bottom: 16px; }
        .field label { display: block; font-size: 12px; font-weight: 600; color: #555; margin-bottom: 7px; letter-spacing: 0.4px; }
        .field input, .field select { width: 100%; background: #f8f9ff; border: 1.5px solid #e8ecf8; border-radius: 10px; padding: 12px 15px; color: #111; font-size: 14px; font-family: 'Inter',sans-serif; outline: none; transition: border-color 0.2s; }
        .field input:focus, .field select:focus { border-color: #3b6be8; background: #fff; }
        .methods-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
        .method-chip { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1.5px solid #e8ecf8; background: #f8f9ff; color: #888; transition: all 0.15s; font-family: 'Inter',sans-serif; }
        .method-chip.sel { background: #eef2ff; border-color: #3b6be8; color: #2563eb; }
        .modal-note { font-size: 12px; color: #aaa; margin-bottom: 16px; background: #f8f9ff; border-radius: 8px; padding: 10px 12px; }
        .modal-actions { display: flex; gap: 10px; margin-top: 8px; }
        .btn-save { flex: 1; background: #2563eb; border: none; border-radius: 10px; padding: 13px; color: #fff; font-size: 14px; font-weight: 600; font-family: 'Inter',sans-serif; cursor: pointer; }
        .btn-save:hover:not(:disabled) { background: #1d4ed8; }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-cancel { flex: 1; background: #f5f7ff; border: 1.5px solid #e8ecf8; border-radius: 10px; padding: 13px; color: #555; font-size: 14px; font-weight: 600; font-family: 'Inter',sans-serif; cursor: pointer; }
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 12px; font-size: 13px; font-weight: 500; z-index: 999; box-shadow: 0 4px 20px rgba(0,0,0,0.3); animation: slidein 0.3s ease; }
        .toast.success { background: #111; color: #fff; }
        .toast.error { background: #dc2626; color: #fff; }
        @keyframes slidein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .role-note { font-size: 12px; color: #aaa; margin-top: 4px; }
      `}</style>

      <nav className="nav">
        <div className="nav-logo" onClick={() => router.push('/dashboard')}>🛡️ Payment Verifier</div>
        <div className="nav-right">
          <span style={{ color:'#4a6090', fontSize:'11px', padding:'3px 8px', background:'#2a3f70', borderRadius:'20px' }}>⚙️ Admin</span>
          <button className="nav-link" onClick={() => router.push('/dashboard')}>Dashboard</button>
          <button className="nav-link" onClick={() => router.push('/finance')}>Finance Queue</button>
          <button className="nav-link" onClick={() => router.push('/tags')}>Tags</button>
          <button className="nav-link danger" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="page">
        <div className="page-header">
          <div className="page-title">👥 Team Members ({users.length})</div>
          <button className="add-btn" onClick={() => setShowAdd(true)}>+ Add Team Member</button>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="empty">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="empty">No users found</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name / Email</th>
                  <th>Role</th>
                  <th>Payment Methods</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const rc = roleColor[u.role] || roleColor.agent
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#111', fontSize: 13 }}>{u.full_name || '—'}</div>
                        <div style={{ color: '#aaa', fontSize: 12 }}>{u.email}</div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: rc.bg, color: rc.color }}>{u.role}</span>
                      </td>
                      <td>
                        {u.role === 'finance' ? (
                          u.payment_methods?.length > 0
                            ? u.payment_methods.map(m => <span key={m} className="method-tag">{m}</span>)
                            : <span style={{ color: '#aaa', fontSize: 12 }}>All methods</span>
                        ) : <span style={{ color: '#ddd', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ color: '#aaa', fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="action-btn" onClick={() => setEditUser({ ...u, payment_methods: u.payment_methods || [] })}>✏️ Edit</button>
                        <button className="action-btn del" onClick={() => deleteUser(u)}>🗑 Delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Team Member</div>
            <div className="modal-note">A new account will be created. Share the email & password with the team member.</div>

            <div className="field">
              <label>Full Name</label>
              <input value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} placeholder="John Smith" />
            </div>
            <div className="field">
              <label>Email Address</label>
              <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@company.com" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 6 characters" />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value, payment_methods: [] })}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
              <div className="role-note">
                {newUser.role === 'agent' && '👤 Can upload screenshots and view their own payments'}
                {newUser.role === 'finance' && '💼 Can approve/reject payments for assigned methods'}
                {newUser.role === 'admin' && '⚙️ Full access to everything including user management'}
              </div>
            </div>

            {newUser.role === 'finance' && (
              <div className="field">
                <label>Payment Methods (leave empty = all methods)</label>
                <div className="methods-grid">
                  {METHODS.map(m => (
                    <button key={m} type="button"
                      className={`method-chip${newUser.payment_methods.includes(m) ? ' sel' : ''}`}
                      onClick={() => toggleMethod(m, newUser.payment_methods, (v) => setNewUser({ ...newUser, payment_methods: v }))}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-save" onClick={createUser} disabled={saving}>
                {saving ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="overlay" onClick={() => setEditUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit {editUser.email}</div>

            <div className="field">
              <label>Full Name</label>
              <input value={editUser.full_name || ''} onChange={e => setEditUser({ ...editUser, full_name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value, payment_methods: [] })}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
              <div className="role-note">
                {editUser.role === 'agent' && '👤 Can upload screenshots and view their own payments'}
                {editUser.role === 'finance' && '💼 Can approve/reject payments for assigned methods'}
                {editUser.role === 'admin' && '⚙️ Full access to everything including user management'}
              </div>
            </div>

            {editUser.role === 'finance' && (
              <div className="field">
                <label>Payment Methods (leave empty = all methods)</label>
                <div className="methods-grid">
                  {METHODS.map(m => (
                    <button key={m} type="button"
                      className={`method-chip${(editUser.payment_methods || []).includes(m) ? ' sel' : ''}`}
                      onClick={() => toggleMethod(m, editUser.payment_methods || [], (v) => setEditUser({ ...editUser, payment_methods: v }))}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setEditUser(null)}>Cancel</button>
              <button className="btn-save" onClick={updateUser} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
