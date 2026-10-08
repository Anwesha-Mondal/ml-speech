import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { updateSettings, useSettings } from '../../lib/settings'
import CursorLight from './CursorLight'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell() {
  const { sidebarCollapsed } = useSettings()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <div className={`shell ${sidebarCollapsed ? 'shell-collapsed' : ''}`}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <CursorLight />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => updateSettings({ sidebarCollapsed: !sidebarCollapsed })}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />
      {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
      <div className="shell-main">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main id="main" className="content" tabIndex={-1}>
          <div key={pathname.split('/').slice(0, 3).join('/')} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
