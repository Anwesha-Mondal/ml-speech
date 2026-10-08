import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

export interface TabLink {
  to: string
  label: string
  end?: boolean
}

export default function PageHeader({
  title,
  description,
  actions,
  tabs,
  eyebrow,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  tabs?: TabLink[]
  eyebrow?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="page-header-row">
        <div className="stack gap-4 grow">
          {eyebrow && <div className="t-label">{eyebrow}</div>}
          <h1 className="t-display">{title}</h1>
          {description && <p className="page-desc">{description}</p>}
        </div>
        {actions && <div className="row gap-8 wrap page-actions">{actions}</div>}
      </div>
      {tabs && (
        <nav className="tabs" aria-label="Sections">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
