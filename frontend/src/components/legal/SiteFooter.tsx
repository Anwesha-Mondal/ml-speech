import { Link } from 'react-router-dom'
import { openCookieSettings } from '../../lib/consent'

export default function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={`site-footer ${compact ? 'is-compact' : ''}`}>
      <nav aria-label="Legal" className="row gap-16 wrap">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/cookies">Cookies</Link>
        <button type="button" className="link-btn" onClick={openCookieSettings}>
          Cookie settings
        </button>
      </nav>
      <span className="faint">Speech Arena · hackathon prototype</span>
    </footer>
  )
}
