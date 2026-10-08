export type SourceKind = 'live' | 'example' | 'sample' | 'repo' | 'browser'

const COPY: Record<SourceKind, { label: string; title: string }> = {
  live: { label: 'Live', title: 'Computed by the Speech Arena API for this recording.' },
  example: {
    label: 'Example',
    title: 'Built-in example data so this screen can be explored without the backend.',
  },
  sample: {
    label: 'Sample data',
    title: 'This API endpoint currently returns a fixed sample response, not computed results.',
  },
  repo: { label: 'From repo', title: 'Read from files in the repository at build time.' },
  browser: { label: 'In browser', title: 'Computed in your browser from your own recording. Display only.' },
}

export default function SourceTag({ kind, className = '' }: { kind: SourceKind; className?: string }) {
  const c = COPY[kind]
  return (
    <span className={`badge badge-mono source-tag source-${kind} ${className}`} title={c.title}>
      <span className="dot" aria-hidden="true" />
      {c.label}
    </span>
  )
}
