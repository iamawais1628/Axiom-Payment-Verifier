import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const AGENT_NAV = [
  { href: '/upload',      icon: '📤', label: 'Verify Payment' },
  { href: '/my-payments', icon: '📋', label: 'My Payments' },
  { href: '/tags',        icon: '🏷️', label: 'Payment Tags' },
]

const FINANCE_NAV = [
  { href: '/finance',     icon: '✅', label: 'Review Queue' },
  { href: '/tags',        icon: '🏷️', label: 'Payment Tags' },
]

const ADMIN_NAV = [
  { href: '/dashboard',        icon: '📊', label: 'Dashboard' },
  { href: '/finance',          icon: '✅', label: 'Review Queue' },
  { href: '/tags',             icon: '🏷️', label: 'Payment Tags' },
  { href: '/admin/users',      icon: '👥', label: 'Team Members' },
  { href: '/admin/activity',   icon: '📋', label: 'Activity Log' },
]

export default function Layout({ children, title = '' }) {
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [notifications, setNotifications] = useState([])
  const [showNotif, setShowNotif] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProfileLoading(false); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    setProfile(prof || { email: user.email, role: 'agent' })
    setProfileLoading(false)
    loadNotifications(user.email)

    supabase.channel('layout-notif')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => loadNotifications(user.email))
      .subscribe()
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
    setNotifications([])
    setShowNotif(false)
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  // Use profile role as primary source — URL is only used as fallback
  // while profile is still loading from DB
  const currentPath = router.pathname
  const isAdminPath = currentPath.startsWith('/admin') || currentPath === '/dashboard'
  const isFinancePath = currentPath === '/finance'
  const isAgentPath = currentPath === '/upload' || currentPath === '/my-payments'

  const navItems = profile
    ? profile.role === 'admin' ? ADMIN_NAV
      : profile.role === 'finance' ? FINANCE_NAV
      : AGENT_NAV
    : isAdminPath ? ADMIN_NAV
      : isFinancePath ? FINANCE_NAV
      : isAgentPath ? AGENT_NAV
      : AGENT_NAV

  const roleLabel = profile?.role === 'admin' ? 'Admin' : profile?.role === 'finance' ? 'Finance' : 'Agent'
  const roleColor = profile?.role === 'admin' ? '#8b5cf6' : profile?.role === 'finance' ? '#f59e0b' : '#3b82f6'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2fa', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* Sidebar */
        .sidebar {
          width: 240px; background: #0f172a; min-height: 100vh;
          display: flex; flex-direction: column;
          position: fixed; left: 0; top: 0; bottom: 0; z-index: 50;
          transition: transform 0.25s ease;
        }
        .sidebar-logo {
          padding: 24px 20px 20px;
          border-bottom: 1px solid #1e293b;
          display: flex; align-items: center; gap: 10px;
        }
        .logo-icon { font-size: 24px; }
        .logo-text { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
        .logo-sub { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-top: 1px; }

        .sidebar-profile {
          padding: 16px 20px;
          border-bottom: 1px solid #1e293b;
          display: flex; align-items: center; gap: 10px;
        }
        .profile-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 13px; font-weight: 700; flex-shrink: 0;
        }
        .profile-email { font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
        .profile-role { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; margin-top: 3px; }

        .sidebar-nav { flex: 1; padding: 12px 12px; overflow-y: auto; }
        .nav-section-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; padding: 8px 8px 4px; }
        .nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px; cursor: pointer;
          color: #94a3b8; font-size: 13px; font-weight: 500;
          transition: all 0.15s; margin-bottom: 2px; text-decoration: none;
          border: none; background: none; width: 100%; text-align: left; font-family: 'Inter', sans-serif;
        }
        .nav-item:hover { background: #1e293b; color: #e2e8f0; }
        .nav-item.active { background: #1d4ed8; color: #fff; }
        .nav-item.active .nav-icon { opacity: 1; }
        .nav-icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }

        .sidebar-footer { padding: 16px 12px; border-top: 1px solid #1e293b; }
        .logout-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px; cursor: pointer;
          color: #64748b; font-size: 13px; font-weight: 500;
          transition: all 0.15s; width: 100%; border: none; background: none;
          font-family: 'Inter', sans-serif;
        }
        .logout-btn:hover { background: #1e293b; color: #f87171; }

        /* Top bar */
        .topbar {
          position: fixed; top: 0; left: 240px; right: 0; height: 60px;
          background: #fff; border-bottom: 1px solid #e2e8f0;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px; z-index: 40;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          width: calc(100% - 240px);
        }
        .topbar-title { font-size: 17px; font-weight: 700; color: #0f172a; }
        .topbar-right { display: flex; align-items: center; gap: 12px; }

        .notif-btn { position: relative; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; padding: 8px 10px; display: flex; align-items: center; transition: all 0.15s; }
        .notif-btn:hover { background: #f0f2fa; border-color: #cbd5e1; }
        .notif-badge { position: absolute; top: -4px; right: -4px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }

        .notif-panel { position: absolute; right: 0; top: 52px; width: 340px; background: #fff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.12); border: 1px solid #e2e8f0; z-index: 200; overflow: hidden; }
        .notif-header { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .notif-header-title { font-size: 14px; font-weight: 700; color: #0f172a; }
        .notif-clear { font-size: 12px; color: #3b82f6; cursor: pointer; background: none; border: none; font-family: 'Inter', sans-serif; font-weight: 500; }
        .notif-item { padding: 14px 18px; border-bottom: 1px solid #f8fafc; transition: background 0.1s; cursor: default; }
        .notif-item:hover { background: #f8fafc; }
        .notif-item-title { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 3px; }
        .notif-item-msg { font-size: 12px; color: #64748b; line-height: 1.5; }
        .notif-empty { padding: 32px; text-align: center; color: #94a3b8; font-size: 13px; }

        /* Main content */
        .main-content { margin-left: 240px; margin-top: 60px; min-height: calc(100vh - 60px); padding: 28px; width: calc(100% - 240px); }

        /* Mobile */
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

        /* Toast */
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 12px; font-size: 13px; font-weight: 500; z-index: 999; box-shadow: 0 4px 20px rgba(0,0,0,0.15); animation: slidein 0.3s ease; display: flex; align-items: center; gap: 8px; }
        .toast.success { background: #0f172a; color: #fff; }
        .toast.error { background: #dc2626; color: #fff; }
        .toast.info { background: #2563eb; color: #fff; }
        @keyframes slidein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Sidebar overlay for mobile */}
      <div className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">🛡️</div>
          <div>
            <div className="logo-text">PayVerify</div>
            <div className="logo-sub">Payment Intelligence</div>
          </div>
        </div>

        {/* Profile */}
        <div className="sidebar-profile">
          <div className="profile-avatar">
            {(profile?.full_name || profile?.email || 'U')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div className="profile-email">{profile?.full_name || profile?.email}</div>
            <span className="profile-role" style={{ background: roleColor + '22', color: roleColor }}>
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Nav */}
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

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
            <span className="nav-icon">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Top bar */}
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
          {/* Notifications */}
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
                {notifications.length === 0 ? (
                  <div className="notif-empty">🔔 No new notifications</div>
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
      </header>

      {/* Page content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
