import { Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import SourceTag from '../../components/ui/SourceTag'
import { FLAW_META } from '../../lib/analysis/model'
import { AUDIO_FILES_IN_REPO, RIGHTS, SOURCES, VARIANTS } from '../../lib/data/dataset.generated'

const FLAW_KEY: Record<string, string> = {
  pacing_fast: 'PACING_TOO_FAST',
  pacing_slow: 'PACING_TOO_SLOW',
  pause_missing: 'PAUSE_MISSING',
  pause_excessive: 'PAUSE_EXCESSIVE',
  pitch_monotone: 'PITCH_MONOTONE',
  energy_low: 'ENERGY_LOW',
}

function count<T extends string | number>(xs: T[]): [T, number][] {
  const m = new Map<T, number>()
  xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1))
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

function Dist({ rows, label }: { rows: [string, number][]; label?: (k: string) => string }) {
  const max = Math.max(...rows.map((r) => r[1]), 1)
  return (
    <div className="dist">
      {rows.map(([k, n]) => (
        <div key={k} className="dist-row">
          <span className="mono t-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label ? label(k) : k}
          </span>
          <div className="hbar">
            <i style={{ width: `${(n / max) * 100}%` }} />
          </div>
          <span className="mono num t-small" style={{ textAlign: 'right' }}>
            {n}
          </span>
        </div>
      ))}
    </div>
  )
}

export function DatasetLayout() {
  return (
    <>
      <PageHeader
        title="Dataset v1"
        description="Matched reference and flawed recordings with exact flaw locations, used to test the engine."
        actions={<SourceTag kind="repo" />}
        tabs={[
          { to: '/dataset', label: 'Overview', end: true },
          { to: '/dataset/references', label: 'References' },
          { to: '/dataset/variants', label: 'Variants' },
          { to: '/dataset/flaws', label: 'Flaws' },
          { to: '/dataset/severity', label: 'Severity' },
          { to: '/dataset/rights', label: 'Rights' },
        ]}
      />
      <Outlet />
    </>
  )
}

export function DatasetOverview() {
  const transcripts = new Set(VARIANTS.map((v) => v[1])).size
  const speakers = new Set(VARIANTS.map((v) => v[2])).size
  const flawed = VARIANTS.filter((v) => v[3] !== 'clean' && v[3] !== 'control').length
  const split = count(VARIANTS.map((v) => v[5]))
  return (
    <div className="stack gap-16">
      {AUDIO_FILES_IN_REPO === 0 && (
        <p className="notice notice-warn">
          <Info size={15} />
          <span>
            The manifest lists {VARIANTS.length} variants, but no audio files are in the repository yet. The numbers below
            describe the planned dataset in <span className="mono">datasets/manifests/dataset_v1.jsonl</span>.
          </span>
        </p>
      )}
      <div className="grid-4">
        {[
          ['Variants', VARIANTS.length],
          ['Transcripts', transcripts],
          ['Speakers', speakers],
          ['With an injected flaw', flawed],
        ].map(([k, v]) => (
          <div key={k} className="panel panel-pad stat">
            <span className="t-label">{k}</span>
            <span className="stat-value">{v}</span>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <span className="t-section">Flaw distribution</span>
          </div>
          <div className="panel-pad">
            <Dist rows={count(VARIANTS.map((v) => v[3]))} />
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <span className="t-section">Transcripts</span>
            <span className="t-small muted">
              split {split.map(([k, n]) => `${k} ${n}`).join(' · ')}
            </span>
          </div>
          <div className="panel-pad">
            <Dist rows={count(VARIANTS.map((v) => v[1]))} />
          </div>
        </section>
      </div>
    </div>
  )
}

export function DatasetReferences() {
  return (
    <div className="panel table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Title</th>
            <th>Speaker</th>
            <th>Provider</th>
            <th>License</th>
          </tr>
        </thead>
        <tbody>
          {RIGHTS.map((r) => (
            <tr key={r.asset_id}>
              <td className="mono t-small">{r.asset_id}</td>
              <td>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.title}
                  </a>
                ) : (
                  r.title
                )}
              </td>
              <td>{r.speaker}</td>
              <td className="muted">{r.provider}</td>
              <td>{r.license}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const PAGE = 25

export function DatasetVariants() {
  const [flaw, setFlaw] = useState('all')
  const [tx, setTx] = useState('all')
  const [page, setPage] = useState(0)
  const flaws = useMemo(() => [...new Set(VARIANTS.map((v) => v[3]))].sort(), [])
  const txs = useMemo(() => [...new Set(VARIANTS.map((v) => v[1]))].sort(), [])
  const rows = VARIANTS.filter((v) => (flaw === 'all' || v[3] === flaw) && (tx === 'all' || v[1] === tx))
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const p = Math.min(page, pages - 1)
  return (
    <div className="panel">
      <div className="panel-head wrap">
        <div className="row gap-8 wrap">
          <select id="variant-flaw" className="select" style={{ width: 'auto' }} value={flaw} onChange={(e) => { setFlaw(e.target.value); setPage(0) }}>
            <option value="all">All flaw types</option>
            {flaws.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select id="variant-transcript" className="select" style={{ width: 'auto' }} value={tx} onChange={(e) => { setTx(e.target.value); setPage(0) }}>
            <option value="all">All transcripts</option>
            {txs.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <span className="t-small muted num">{rows.length} variants</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Transcript</th>
              <th>Speaker</th>
              <th>Flaw</th>
              <th className="r">Severity</th>
              <th>Split</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(p * PAGE, p * PAGE + PAGE).map((v) => (
              <tr key={v[0]}>
                <td className="mono t-small">{v[0]}</td>
                <td>{v[1]}</td>
                <td>{v[2]}</td>
                <td className="mono t-small">{v[3]}</td>
                <td className="r mono num">{v[4].toFixed(1)}</td>
                <td className="muted">{v[5]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row between panel-pad" style={{ paddingTop: 12, paddingBottom: 12 }}>
        <button type="button" className="btn btn-sm" disabled={p === 0} onClick={() => setPage(p - 1)}>
          Previous
        </button>
        <span className="t-small muted num">
          Page {p + 1} of {pages}
        </span>
        <button type="button" className="btn btn-sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}

export function DatasetFlaws() {
  const counts = new Map(count(VARIANTS.map((v) => v[3])))
  return (
    <div className="panel table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Flaw</th>
            <th>Engine type</th>
            <th>Bucket</th>
            <th>Interpretation</th>
            <th className="r">Variants</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(FLAW_KEY).map(([k, type]) => {
            const m = FLAW_META[type]
            return (
              <tr key={k}>
                <td className="mono t-small">{k}</td>
                <td className="mono t-small">{type}</td>
                <td>{m.bucket}</td>
                <td className="t-small muted" style={{ minWidth: 280 }}>
                  {m.interpretation}
                </td>
                <td className="r mono num">{counts.get(k) ?? 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function DatasetSeverity() {
  const rows = count(VARIANTS.map((v) => v[4])).sort((a, b) => a[0] - b[0])
  const max = Math.max(...rows.map((r) => r[1]))
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="t-section">Severity distribution, 0.0 → 1.0</span>
        <span className="t-small muted">0.0 = clean reference copy · 0.1 = near-perfect control</span>
      </div>
      <div className="panel-pad">
        <div className="sev-chart" role="img" aria-label={rows.map(([s, n]) => `severity ${s}: ${n}`).join(', ')}>
          {rows.map(([s, n]) => (
            <div key={s} className="sev-col">
              <span className="mono num t-small">{n}</span>
              <i style={{ height: `${(n / max) * 82}%` }} />
            </div>
          ))}
        </div>
        <div className="sev-axis">
          {rows.map(([s]) => (
            <span key={s} className="mono t-small muted">
              {s.toFixed(1)}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function statusClass(s?: string) {
  if (s === 'VERIFIED') return 'badge-good'
  if (s === 'REJECTED') return 'badge-bad'
  return 'badge-warn'
}

export function DatasetRights() {
  return (
    <div className="stack gap-16">
      <section className="panel">
        <div className="panel-head">
          <span className="t-section">Rights manifests</span>
          <span className="t-small muted">datasets/rights/*.json</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Provider</th>
                <th>License</th>
                <th>Redistribution</th>
                <th>SHA-256</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {RIGHTS.map((r) => {
                const src = SOURCES.find((s) => s.id === r.asset_id)
                const hashed = r.checksum && !String(r.checksum).startsWith('placeholder')
                return (
                  <tr key={r.asset_id}>
                    <td>
                      <span className="mono t-small">{r.asset_id}</span> {r.title}
                    </td>
                    <td className="muted">{r.provider}</td>
                    <td>{r.license}</td>
                    <td>{r.redistribution ? 'Allowed' : 'Not allowed'}</td>
                    <td className="mono t-small">{hashed ? String(r.checksum).slice(0, 12) + '…' : <span className="faint">Not hashed yet</span>}</td>
                    <td>
                      <span className={`badge badge-mono ${statusClass(src?.status)}`}>{(src?.status ?? 'UNVERIFIED').replace('_', ' ')}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <span className="t-section">Source registry</span>
          <span className="t-small muted">datasets/registry/sources.yaml</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Source</th>
                <th>Notes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.id}>
                  <td className="mono t-small">{s.id}</td>
                  <td>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.name}
                      </a>
                    ) : (
                      s.name
                    )}
                  </td>
                  <td className="t-small muted">{s.notes}</td>
                  <td>
                    <span className={`badge badge-mono ${statusClass(s.status)}`}>{(s.status ?? '').replace('_', ' ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
