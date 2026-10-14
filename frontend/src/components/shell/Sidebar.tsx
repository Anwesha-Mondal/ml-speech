import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth/context'
import { NAV_GROUPS, SETTINGS_ITEM, type NavItem } from './nav'

function Item({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
    >
      <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
      <span className="nav-label">{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onNavigate,
}: {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onNavigate: () => void
}) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <NavLink to="/" className="brand" onClick={onNavigate} aria-label="Speech Guru home">
          <img src="/logo.png" alt="Speech Guru" className="brand-logo" />
          <span className="nav-label brand-name">Speech Guru</span>
        </NavLink>
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="nav-group">
            <div className="nav-group-label">{g.label}</div>
            {g.items.filter((item) => !item.adminOnly || isAdmin).map((item) => (
              <Item key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <Item item={SETTINGS_ITEM} collapsed={collapsed} onNavigate={onNavigate} />
        <button
          type="button"
          className="nav-item nav-collapse"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={17} strokeWidth={1.6} /> : <PanelLeftClose size={17} strokeWidth={1.6} />}
          <span className="nav-label">Collapse</span>
        </button>
      </div>
    </aside>
  )
}
