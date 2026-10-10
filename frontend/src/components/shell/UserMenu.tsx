import { LogOut, Settings, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth/context'

export default function UserMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const initial = (user.display_name.trim()[0] ?? user.email[0] ?? '?').toUpperCase()

  return (
    <div className="usermenu" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className="avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.display_name}`}
        onClick={() => setOpen((o) => !o)}
      >
        {initial}
      </button>
      {open && (
        <div className="usermenu-pop" role="menu">
          <div className="usermenu-head">
            <span className="t-section">{user.display_name}</span>
            <span className="t-small muted" style={{ overflowWrap: 'anywhere' }}>
              {user.email}
            </span>
            {user.role === 'admin' && (
              <span className="badge badge-mono badge-warn" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                ADMIN
              </span>
            )}
          </div>
          <Link to="/settings" role="menuitem" className="usermenu-item" onClick={() => setOpen(false)}>
            <Settings size={15} /> Settings
          </Link>
          {user.role === 'admin' && (
            <Link to="/admin" role="menuitem" className="usermenu-item" onClick={() => setOpen(false)}>
              <ShieldCheck size={15} /> Users &amp; access
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            className="usermenu-item"
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
