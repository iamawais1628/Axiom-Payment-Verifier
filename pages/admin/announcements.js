import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const TYPES = {
  info:    { label: 'Info',    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: 'ℹ️' },
  warning: { label: 'Warning', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⚠️' },
  urgent:  { label: 'Urgent',  color: '#dc2626', bg: '#fff5f5', border: '#fecaca', icon: '🚨' },
}

export default function Announcements() {
  const [items, setItems] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ title:'', message:'', type:'info' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const router = useRouter()

  useEffect(() => { init() }, [])

  const showToast = (msg,type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  const init = async () => {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data:prof } = await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
    if (prof?.role!=='admin') { router.replace('/'); return }
    load()
  }

  const load = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at',{ascending:false})
    if (data) setItems(data)
  }

  const save = async () => {
    if (!newItem.title||!newItem.message) { showToast('Title and message required','error'); return }
    setSaving(true)
    await supabase.from('announcements').insert({ title:newItem.title, message:newItem.message, type:newItem.type, is_active:true })
    showToast('Announcement posted — all team members will see it')
    setShowAdd(false)
    setNewItem({ title:'', message:'', type:'info' })
    load()
    setSaving(false)
  }

  const toggle = async (item) => {
    await supabase.from('announcements').update({ is_active:!item.is_active }).eq('id',item.id)
    load()
    showToast(item.is_active ? 'Announcement hidden' : 'Announcement shown')
  }

  const del = async (id) => {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id',id)
    load()
    showToast('Announcement deleted')
  }

  return (
    <Layout title="Announcements">
      <style>{`
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .add-btn { background: #1d4ed8; border: none; border-radius: 10px; color: #fff; font-size: 13px; font-weight: 700; padding: 10px 20px; cursor: pointer; font-family: 'Inter',sans-serif; }
        .add-btn:hover { background: #1e40af; }
        .ann-list { display: flex; flex-direction: column; gap: 12px; }
        .ann-card { background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 6px rgba(0,0,0,0.05); }
        .ann-stripe { height: 4px; }
        .ann-body { padding: 18px 20px; display: flex; gap: 14px; align-items: flex-start; }
        .ann-icon { font-size: 24px; flex-shrink: 0; }
        .ann-content { flex: 1; }
        .ann-title { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 5px; }
        .ann-message { font-size: 13px; color: #475569; line-height: 1.6; }
        .ann-meta { font-size: 11px; color: #cbd5e1; margin-top: 8px; }
        .ann-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
        .toggle-btn { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; color: #64748b; font-size: 12px; font-weight: 700; padding: 6px 12px; cursor: pointer; font-family: 'Inter',sans-serif; }
        .toggle-btn.on { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
        .del-btn { background: none; border: 1.5px solid #fecaca; border-radius: 8px; color: #dc2626; font-size: 12px; padding: 6px 10px; cursor: pointer; font-family: 'Inter',sans-serif; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.55); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
        .modal { background: #fff; border-radius: 20px; padding: 32px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .modal-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 20px; }
        .field { margin-bottom: 16px; }
        .field label { display: block; font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.4px; margin-bottom: 7px; text-transform: uppercase; }
        .field input, .field select, .field textarea { width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 15px; color: #0f172a; font-size: 14px; font-family: 'Inter',sans-serif; outline: none; transition: border-color 0.2s; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color: #3b82f6; background: #fff; }
        .field textarea { resize: none; }
        .type-grid { display: flex; gap: 8px; }
        .type-btn { flex: 1; padding: 10px; border-radius: 10px; border: 1.5px solid #e2e8f0; background: #f8fafc; cursor: pointer; text-align: center; font-size: 12px; font-weight: 700; font-family: 'Inter',sans-serif; transition: all 0.15s; }
        .type-btn.sel { border-color: #3b82f6; background: #eff6ff; color: #2563eb; }
        .modal-actions { display: flex; gap: 10px; margin-top: 8px; }
        .btn-save { flex: 1; background: #1d4ed8; border: none; border-radius: 10px; padding: 13px; color: #fff; font-size: 14px; font-weight: 700; font-family: 'Inter',sans-serif; cursor: pointer; }
        .btn-cancel { flex: 1; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 13px; color: #475569; font-size: 14px; font-weight: 600; font-family: 'Inter',sans-serif; cursor: pointer; }
        .empty { text-align: center; padding: 60px; color: #cbd5e1; font-size: 14px; background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; }
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; z-index: 999; box-shadow: 0 4px 20px rgba(0,0,0,0.15); animation: slidein 0.3s ease; }
        .toast.success { background: #0f172a; color: #fff; }
        .toast.error { background: #dc2626; color: #fff; }
        @keyframes slidein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="page-header">
        <div style={{fontSize:'13px',color:'#94a3b8'}}>Post announcements visible to all team members</div>
        <button className="add-btn" onClick={() => setShowAdd(true)}>+ Post Announcement</button>
      </div>

      {items.length === 0 ? (
        <div className="empty">No announcements yet. Post one to notify your entire team instantly.</div>
      ) : (
        <div className="ann-list">
          {items.map(item => {
            const t = TYPES[item.type] || TYPES.info
            return (
              <div key={item.id} className="ann-card" style={{ opacity: item.is_active ? 1 : 0.5 }}>
                <div className="ann-stripe" style={{ background: t.color }} />
                <div className="ann-body">
                  <div className="ann-icon">{t.icon}</div>
                  <div className="ann-content">
                    <div className="ann-title">{item.title}</div>
                    <div className="ann-message">{item.message}</div>
                    <div className="ann-meta">
                      <span className="status-dot" style={{ background: item.is_active ? '#16a34a' : '#94a3b8' }} />
                      {item.is_active ? 'Visible to all' : 'Hidden'} · Posted {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="ann-actions">
                    <button className={`toggle-btn${item.is_active ? ' on' : ''}`} onClick={() => toggle(item)}>
                      {item.is_active ? '✓ Live' : '○ Hidden'}
                    </button>
                    <button className="del-btn" onClick={() => del(item.id)}>🗑</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <div className="overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Post Announcement</div>
            <div className="field">
              <label>Type</label>
              <div className="type-grid">
                {Object.entries(TYPES).map(([k,v]) => (
                  <button key={k} className={`type-btn${newItem.type===k?' sel':''}`} onClick={() => setNewItem({...newItem,type:k})}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Title</label>
              <input value={newItem.title} onChange={e => setNewItem({...newItem,title:e.target.value})} placeholder="e.g. CashApp Tag Updated" />
            </div>
            <div className="field">
              <label>Message</label>
              <textarea rows={3} value={newItem.message} onChange={e => setNewItem({...newItem,message:e.target.value})} placeholder="Write your announcement here..." />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-save" onClick={save} disabled={saving}>{saving ? 'Posting...' : 'Post to All Team'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </Layout>
  )
}
