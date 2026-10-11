import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Markdown from '../../components/legal/Markdown'
import SiteFooter from '../../components/legal/SiteFooter'
import { useAuth } from '../../lib/auth/context'
import { LEGAL, type LegalSlug } from '../../lib/legal/docs'

const ORDER: LegalSlug[] = ['privacy', 'terms', 'cookies']

/** Public page: readable without an account, before signing up. */
export default function LegalPage({ slug }: { slug: LegalSlug }) {
  const doc = LEGAL[slug]
  const { status } = useAuth()
  const signedIn = status === 'signedIn'

  useEffect(() => {
    document.title = `${doc.title} · Speech Arena`
    window.scrollTo({ top: 0 })
    return () => {
      document.title = 'Speech Arena'
    }
  }, [doc.title])

  return (
    <div className="legal">
      <header className="legal-top">
        <Link to={signedIn ? '/' : '/login'} className="brand" aria-label="Speech Arena">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <rect x="2" y="8" width="2" height="6" rx="1" fill="currentColor" />
            <rect x="6" y="4" width="2" height="14" rx="1" fill="currentColor" />
            <rect x="10" y="7" width="2" height="8" rx="1" fill="currentColor" />
            <rect x="14" y="2" width="2" height="18" rx="1" fill="currentColor" />
            <rect x="18" y="9" width="2" height="4" rx="1" fill="currentColor" />
          </svg>
          <span className="brand-name">Speech Arena</span>
        </Link>
        <Link to={signedIn ? '/' : '/login'} className="btn btn-sm">
          <ArrowLeft size={14} /> {signedIn ? 'Back to the app' : 'Sign in'}
        </Link>
      </header>
      <div className="legal-body">
        <nav className="legal-nav" aria-label="Legal documents">
          {ORDER.map((s) => (
            <Link key={s} to={`/${s}`} className={s === slug ? 'active' : ''} aria-current={s === slug ? 'page' : undefined}>
              {LEGAL[s].title}
            </Link>
          ))}
        </nav>
        <article className="legal-doc">
          <h1 className="t-display">{doc.title}</h1>
          <p className="legal-meta mono">
            Version {doc.version} · effective {doc.effective}
          </p>
          <Markdown source={doc.body} />
        </article>
      </div>
      <SiteFooter />
    </div>
  )
}
