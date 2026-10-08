import { Menu, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useApiHealth } from '../../lib/useApiHealth'
import { useSettings } from '../../lib/settings'
import { JUMP_TARGETS } from './nav'

const SECTION_LABELS: Record<string, string> = {
  practice: 'Practice',
  assessment: 'Assessment',
  arena: 'Arena',
  leaderboard: 'Leaderboard',
  analysis: 'Analysis',
  dataset: 'Dataset',
  pipeline: 'Pipeline',
  system: 'System',
  settings: 'Settings',
}

function useCrumbs(): { label: string; to?: string }[] {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)
  if (!parts.length) return [{ label: 'Overview' }]
  const crumbs: { label: string; to?: string }[] = [{ label: SECTION_LABELS[parts[0]] ?? parts[0], to: `/${parts[0]}` }]
  if (parts[0] === 'analysis' && parts[1]) {
    crumbs.push({ label: parts[1] === 'example-gettysburg' ? 'Example' : parts[1].slice(0, 8), to: `/analysis/${parts[1]}` })
    if (parts[2] === 'data') crumbs.push({ label: 'Data' })
  } else if (parts[1]) {
    const hit = JUMP_TARGETS.find((t) => t.to === `/${parts[0]}/${parts[1]}`)
    crumbs.push({ label: hit?.label ?? parts[1] })
  }
  delete crumbs[crumbs.length - 1].to
  return crumbs
}

function QuickJump() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = s
      ? JUMP_TARGETS.filter((t) => `${t.label} ${t.section}`.toLowerCase().includes(s))
      : JUMP_TARGETS.slice(0, 8)
    return list.slice(0, 8)
  }, [q])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (to: string) => {
    navigate(to)
    setQ('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className="quickjump">
      <Search size={15} className="quickjump-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        id="quickjump"
        className="quickjump-input"
        placeholder="Jump to a page"
        value={q}
        role="combobox"
        aria-expanded={open}
        aria-controls="quickjump-list"
        aria-autocomplete="list"
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && results[active]) {
            go(results[active].to)
          } else if (e.key === 'Escape') {
            setOpen(false)
            inputRef.current?.blur()
          }
        }}
      />
      <kbd className="quickjump-kbd" aria-hidden="true">
        /
      </kbd>
      {open && (
        <ul id="quickjump-list" className="quickjump-list" role="listbox">
          {results.length ? (
            results.map((r, i) => (
              <li
                key={r.to}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'is-active' : ''}
                onMouseDown={(e) => {
                  e.preventDefault()
                  go(r.to)
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span>{r.label}</span>
                <span className="faint t-small">{r.section}</span>
              </li>
            ))
          ) : (
            <li className="quickjump-none">No page matches “{q}”.</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const crumbs = useCrumbs()
  const health = useApiHealth()
  const { name } = useSettings()
  const initial = (name.trim()[0] ?? 'Y').toUpperCase()

  return (
    <header className="topbar">
      <button type="button" className="btn btn-ghost btn-icon topbar-menu" onClick={onMenu} aria-label="Open navigation">
        <Menu size={18} />
      </button>
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} className="crumb">
            {i > 0 && <span className="crumb-sep">/</span>}
            {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
          </span>
        ))}
      </nav>
      <div className="topbar-right">
        <QuickJump />
        <Link
          to="/system"
          className={`api-pill api-${health.state}`}
          title={
            health.state === 'online'
              ? `API reachable (${health.latencyMs} ms)`
              : health.state === 'offline'
                ? 'The API is not reachable. Recording analysis needs the backend running.'
                : 'Checking the API…'
          }
        >
          <span className="dot" aria-hidden="true" />
          <span className="api-pill-text">
            {health.state === 'online' ? 'API online' : health.state === 'offline' ? 'API offline' : 'Checking API'}
          </span>
        </Link>
        <Link to="/settings" className="avatar" aria-label={`Profile: ${name}`} title={name}>
          {initial}
        </Link>
      </div>
    </header>
  )
}
