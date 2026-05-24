import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const AGENT_NAV = [
  { href: '/upload',      icon: '📤', label: 'Verify Payment' },
  { href: '/my-payments', icon: '📋', label: 'My Payments' },
  { href: '/tags',        icon: '🏷️', label: 'Payment Tags' },
  { href: '/sender-history', icon: '👤', label: 'Sender Lookup' },
]

const FINANCE_NAV = [
  { href: '/finance',        icon: '✅', label: 'Review Queue' },
  { href: '/tags',           icon: '🏷️', label: 'Payment Tags' },
  { href: '/sender-history', icon: '👤', label: 'Sender History' },
]

const ADMIN_NAV = [
  { href: '/dashboard',           icon: '📊', label: 'Dashboard' },
  { href: '/finance',             icon: '✅', label: 'Review Queue' },
  { href: '/tags',                icon: '🏷️', label: 'Payment Tags' },
  { href: '/sender-history',      icon: '👤', label: 'Sender History' },
  { href: '/admin/users',         icon: '👥', label: 'Team Members' },
  { href: '/admin/agent-stats',   icon: '📈', label: 'Agent Performance' },
  { href: '/admin/rules',         icon: '🔧', label: 'Rules & Settings' },
  { href: '/admin/announcements', icon: '📢', label: 'Announcements' },
  { href: '/admin/activity',      icon: '📋', label: 'Activity Log' },
]

const NAV_BY_ROLE = { admin: ADMIN_NAV, finance: FINANCE_NAV, agent: AGENT_NAV }

export default function Layout({ children, title = '' }) {
  const [profile, setProfile] = useState(null)
  // Read role from localStorage immediately — no flash, no delay
  const [announcements, setAnnouncements] = useState([])
  const [role, setRole] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pv_role') || 'agent'
    }
    return 'agent'
  })
  const [notifications, setNotifications] = useState([])
  const [showNotif, setShowNotif] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (prof) {
      setProfile(prof)
      setRole(prof.role || 'agent')
      // Cache role in localStorage for instant nav on next render
      localStorage.setItem('pv_role', prof.role || 'agent')
    }
    loadNotifications(user.email)
    loadAnnouncements()
    supabase.channel('layout-notif')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => loadNotifications(user.email))
      .subscribe()
  }

  const loadAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('*').eq('is_active', true).order('created_at', {ascending:false}).limit(3)
    if (data) setAnnouncements(data)
  }

  const loadNotifications = async (email) => {
    const { data } = await supabase.from('notifications').select('*')
      .eq('recipient_email', email).eq('is_read', false)
      .order('created_at', { ascending: false }).limit(10)
    if (data) setNotifications(data)
  }

  const markAllRead = async () => {
    if (!profile) return
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_email', profile.email)
    setNotifications([]); setShowNotif(false)
  }

  const logout = async () => {
    localStorage.removeItem('pv_role')
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = NAV_BY_ROLE[role] || AGENT_NAV
  const roleLabel = role === 'admin' ? 'Admin' : role === 'finance' ? 'Finance' : 'Agent'
  const roleColor = role === 'admin' ? '#8b5cf6' : role === 'finance' ? '#f59e0b' : '#3b82f6'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2fa', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .sidebar { width: 240px; background: #0f172a; min-height: 100vh; display: flex; flex-direction: column; position: fixed; left: 0; top: 0; bottom: 0; z-index: 50; transition: transform 0.25s ease; }
        .sidebar-logo { padding: 24px 20px 20px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 10px; }
        .logo-icon { font-size: 24px; }
        .logo-text { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
        .logo-sub { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-top: 1px; }
        .sidebar-profile { padding: 16px 20px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 10px; }
        .profile-avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; font-weight: 700; flex-shrink: 0; }
        .profile-email { font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
        .profile-role { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; margin-top: 3px; }
        .sidebar-nav { flex: 1; padding: 12px; overflow-y: auto; }
        .nav-section-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; padding: 8px 8px 4px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; cursor: pointer; color: #94a3b8; font-size: 13px; font-weight: 500; transition: all 0.15s; margin-bottom: 2px; border: none; background: none; width: 100%; text-align: left; font-family: 'Inter', sans-serif; }
        .nav-item:hover { background: #1e293b; color: #e2e8f0; }
        .nav-item.active { background: #1d4ed8; color: #fff; }
        .nav-icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }
        .sidebar-footer { padding: 16px 12px; border-top: 1px solid #1e293b; }
        .logout-btn { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; cursor: pointer; color: #64748b; font-size: 13px; font-weight: 500; transition: all 0.15s; width: 100%; border: none; background: none; font-family: 'Inter', sans-serif; }
        .logout-btn:hover { background: #1e293b; color: #f87171; }
        .topbar { position: fixed; top: 0; left: 240px; right: 0; height: 60px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; z-index: 40; box-shadow: 0 1px 3px rgba(0,0,0,0.05); width: calc(100% - 240px); }
        .topbar-title { font-size: 17px; font-weight: 700; color: #0f172a; }
        .topbar-right { display: flex; align-items: center; gap: 12px; }
        .notif-btn { position: relative; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; padding: 8px 10px; display: flex; align-items: center; transition: all 0.15s; }
        .notif-btn:hover { background: #f0f2fa; border-color: #cbd5e1; }
        .notif-badge { position: absolute; top: -4px; right: -4px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }
        .notif-panel { position: absolute; right: 0; top: 52px; width: 340px; background: #fff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.12); border: 1px solid #e2e8f0; z-index: 200; overflow: hidden; }
        .notif-header { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .notif-header-title { font-size: 14px; font-weight: 700; color: #0f172a; }
        .notif-clear { font-size: 12px; color: #3b82f6; cursor: pointer; background: none; border: none; font-family: 'Inter', sans-serif; font-weight: 500; }
        .notif-item { padding: 14px 18px; border-bottom: 1px solid #f8fafc; }
        .notif-item:hover { background: #f8fafc; }
        .notif-item-title { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 3px; }
        .notif-item-msg { font-size: 12px; color: #64748b; line-height: 1.5; }
        .notif-empty { padding: 32px; text-align: center; color: #94a3b8; font-size: 13px; }
        .main-content { margin-left: 240px; margin-top: 60px; min-height: calc(100vh - 60px); padding: 28px; width: calc(100% - 240px); }
        .mobile-menu-btn { display: none; background: none; border: none; cursor: pointer; padding: 8px; }
        .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 49; }
        @media(max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); }
          .sidebar-overlay.open { display: block; }
          .topbar { left: 0; padding: 0 16px; width: 100%; }
          .main-content { margin-left: 0; padding: 16px; width: 100%; }
          .mobile-menu-btn { display: flex; }
          .topbar-title { font-size: 15px; }
        }
        @keyframes slidein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">🛡️</div>
          <div>
            <div className="logo-text">PayVerify</div>
            <div className="logo-sub">Payment Intelligence</div>
          </div>
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">
            {(profile?.full_name || profile?.email || 'U')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div className="profile-email">{profile?.full_name || profile?.email || '...'}</div>
            <span className="profile-role" style={{ background: roleColor + '22', color: roleColor }}>
              {roleLabel}
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {navItems.map(item => (
            <button
              key={item.href}
              className={`nav-item${router.pathname === item.href ? ' active' : ''}`}
              onClick={() => { router.push(item.href); setSidebarOpen(false) }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
            <span className="nav-icon">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="topbar-title">{title}</div>
        </div>

        <div className="topbar-right">
          <div style={{ position: 'relative' }}>
            <button className="notif-btn" onClick={() => setShowNotif(!showNotif)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
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
                  <span className="notif-header-title">Notifications</span>
                  {notifications.length > 0 && <button className="notif-clear" onClick={markAllRead}>Mark all read</button>}
                </div>
                {notifications.length === 0
                  ? <div className="notif-empty">🔔 No new notifications</div>
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
      </header>

      <main className="main-content">
        {announcements.map(ann => {
          const colors = {
            info:    { bg:'#eff6ff', border:'#bfdbfe', color:'#1d4ed8', icon:'ℹ️' },
            warning: { bg:'#fffbeb', border:'#fde68a', color:'#b45309', icon:'⚠️' },
            urgent:  { bg:'#fff5f5', border:'#fecaca', color:'#dc2626', icon:'🚨' },
          }
          const c = colors[ann.type] || colors.info
          return (
            <div key={ann.id} style={{ background:c.bg, border:`1.5px solid ${c.border}`, borderRadius:'12px', padding:'12px 16px', marginBottom:'16px', display:'flex', alignItems:'flex-start', gap:'10px' }}>
              <span style={{fontSize:'18px',flexShrink:0}}>{c.icon}</span>
              <div>
                <div style={{fontSize:'13px',fontWeight:'700',color:c.color}}>{ann.title}</div>
                <div style={{fontSize:'12px',color:c.color,opacity:0.85,marginTop:'3px'}}>{ann.message}</div>
              </div>
            </div>
          )
        })}
        {children}
      </main>
    </div>
  )
}
