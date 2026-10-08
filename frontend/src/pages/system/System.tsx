import { RefreshCw } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import { API_BASE } from '../../lib/api/client'
import { BUCKETS, SCORING_VERSION } from '../../lib/analysis/model'
import { checkHealth, useApiHealth } from '../../lib/useApiHealth'
import { fmtDateTime } from '../../lib/format'

export function SystemLayout() {
  return (
    <>
      <PageHeader
        title="System"
        description="What is running, what it returns, and what is still planned."
        tabs={[
          { to: '/system', label: 'API & services', end: true },
          { to: '/system/architecture', label: 'Architecture' },
          { to: '/system/scoring', label: 'Scoring' },
          { to: '/system/devops', label: 'DevOps' },
        ]}
      />
      <Outlet />
    </>
  )
}

type Svc = { name: string; state: 'ok' | 'warn' | 'bad' | 'off'; label: string; detail: string }

const ENDPOINTS: { method: string; path: string; returns: string; kind: 'live' | 'fixed' | 'unused' }[] = [
  { method: 'GET', path: '/api/health', returns: 'Service status', kind: 'live' },
  { method: 'POST', path: '/api/analyze', returns: 'Job ID; runs scoring in a background task', kind: 'live' },
  { method: 'GET', path: '/api/jobs/{job_id}', returns: 'Job status and analysis result', kind: 'live' },
  { method: 'GET', path: '/api/progress/history', returns: 'Fixed sample history', kind: 'fixed' },
  { method: 'GET', path: '/api/leaderboard', returns: 'Fixed sample rankings', kind: 'fixed' },
  { method: 'POST', path: '/api/battle/1v1', returns: 'Fixed sample battle (UI scores battles via /analyze)', kind: 'unused' },
  { method: 'POST', path: '/api/mimic-party', returns: 'Fixed score of 94 (UI computes Mimic in the browser)', kind: 'unused' },
]

export function SystemApi() {
  const h = useApiHealth()
  const apiState: Svc['state'] = h.state === 'online' ? 'ok' : h.state === 'offline' ? 'bad' : 'off'
  const services: Svc[] = [
    {
      name: 'API (FastAPI)',
      state: apiState,
      label: h.state === 'online' ? 'Operational' : h.state === 'offline' ? 'Unreachable' : 'Checking',
      detail: h.state === 'online' ? `${h.latencyMs} ms` : API_BASE,
    },
    {
      name: 'Job worker',
      state: apiState === 'ok' ? 'ok' : apiState,
      label: apiState === 'ok' ? 'In-process' : 'Unknown',
      detail: 'FastAPI BackgroundTasks',
    },
    { name: 'Job store', state: 'warn', label: 'In memory', detail: 'Cleared when the API restarts' },
    { name: 'Alignment / features', state: 'off', label: 'Not called', detail: 'See Pipeline' },
    { name: 'PostgreSQL', state: 'off', label: 'Not deployed', detail: 'Planned (docs/17)' },
    { name: 'Redis (leaderboard)', state: 'off', label: 'Not deployed', detail: 'Planned (docs/16)' },
    { name: 'Object storage (S3)', state: 'off', label: 'Not deployed', detail: 'Recordings are not stored' },
  ]
  return (
    <div className="grid-2">
      <section className="panel">
        <div className="panel-head">
          <span className="t-section">Service health</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => void checkHealth()}>
            <RefreshCw size={13} /> Check now
          </button>
        </div>
        <ul className="health">
          {services.map((s) => (
            <li key={s.name}>
              <span className="stack">
                <span>{s.name}</span>
                <span className="t-small faint mono">{s.detail}</span>
              </span>
              <span className={`status status-${s.state}`}>
                <span className="dot" />
                {s.label}
              </span>
            </li>
          ))}
        </ul>
        <p className="t-small faint panel-pad" style={{ paddingTop: 0 }}>
          {h.checkedAt ? `Last checked ${fmtDateTime(new Date(h.checkedAt).toISOString())}. ` : ''}Checked every 20 s.
        </p>
      </section>
      <section className="panel">
        <div className="panel-head">
          <span className="t-section">Endpoints</span>
          <span className="mono t-small muted">{API_BASE}</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Returns</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.path}>
                  <td className="mono t-small" style={{ whiteSpace: 'nowrap' }}>
                    <span className="faint">{e.method}</span> {e.path}
                  </td>
                  <td className="t-small">
                    {e.returns}{' '}
                    {e.kind !== 'live' && (
                      <span className={`badge badge-mono ${e.kind === 'fixed' ? 'badge-warn' : ''}`}>
                        {e.kind === 'fixed' ? 'sample' : 'not used'}
                      </span>
                    )}
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

function Node({ x, y, w, title, sub, planned }: { x: number; y: number; w: number; title: string; sub: string; planned?: boolean }) {
  return (
    <g>
      <rect className={`node ${planned ? 'planned' : ''}`} x={x} y={y} width={w} height={46} rx={7} />
      <text x={x + 12} y={y + 20} className={planned ? 'planned' : ''}>
        {title}
      </text>
      <text x={x + 12} y={y + 35} className="arch-sub">
        {sub}
      </text>
    </g>
  )
}

export function SystemArchitecture() {
  const edge = (d: string, planned?: boolean) => <path className={`edge ${planned ? 'planned' : ''}`} d={d} />
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="t-section">Architecture</span>
        <span className="legend">
          <span>
            <i style={{ background: 'var(--line-strong)' }} />
            Running
          </span>
          <span>
            <i className="dashed" style={{ color: 'var(--line-strong)' }} />
            Planned
          </span>
        </span>
      </div>
      <div className="panel-pad table-wrap">
        <svg viewBox="0 0 880 330" className="arch" role="img" aria-label="System architecture" style={{ minWidth: 640 }}>
          {edge('M440,56 V84')}
          {edge('M440,130 V150 H150 V170')}
          {edge('M440,130 V170')}
          {edge('M440,130 V150 H730 V170')}
          {edge('M440,216 V244')}
          {edge('M150,216 V244', true)}
          {edge('M730,216 V244', true)}
          <Node x={340} y={10} w={200} title="Frontend" sub="Vite · React · TypeScript" />
          <Node x={340} y={84} w={200} title="API" sub="FastAPI · backend/api/main.py" />
          <Node x={50} y={170} w={200} title="Ingestion" sub="audio/io · qc · vad" planned />
          <Node x={340} y={170} w={200} title="Analysis router" sub="routers/analysis.py" />
          <Node x={630} y={170} w={200} title="Gamification router" sub="routers/gamification.py" />
          <Node x={50} y={244} w={200} title="Object storage" sub="S3 · recordings" planned />
          <Node x={340} y={244} w={200} title="Scoring engine" sub="packages/speech_arena/scoring" />
          <Node x={630} y={244} w={200} title="PostgreSQL + Redis" sub="battles · leaderboard" planned />
          <text x={340} y={312} className="arch-sub">
            Jobs run as FastAPI background tasks; results are held in memory.
          </text>
        </svg>
      </div>
    </section>
  )
}

const RULES = [
  { type: 'PACING_TOO_FAST', rule: 'local rate ÷ reference > 1.3', penalty: -2.0 },
  { type: 'PITCH_MONOTONE', rule: 'pitch range ÷ reference < 0.5', penalty: -3.0 },
  { type: 'PAUSE_EXCESSIVE', rule: 'pause after word − reference > 0.5 s', penalty: -2.5 },
  { type: 'ENERGY_LOW', rule: 'mean dB − reference < −5 dB', penalty: -1.5 },
]

export function SystemScoring() {
  return (
    <div className="grid-2">
      <section className="panel">
        <div className="panel-head">
          <span className="t-section">Scoring {SCORING_VERSION}</span>
          <span className="mono t-small muted">scoring/engine.py</span>
        </div>
        <div className="panel-pad stack gap-12">
          <p className="t-small">Score = 100 − sum of bucket deductions. Each bucket is capped.</p>
          <table className="table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th className="r">Cap</th>
              </tr>
            </thead>
            <tbody>
              {BUCKETS.map((b) => (
                <tr key={b.key}>
                  <td>{b.label}</td>
                  <td className="r mono num">−{b.cap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <span className="t-section">Detector rules</span>
          <span className="mono t-small muted">scoring/detectors.py</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Flaw</th>
                <th>Fires when</th>
                <th className="r">Per word</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.type}>
                  <td className="mono t-small">{r.type}</td>
                  <td className="t-small">{r.rule}</td>
                  <td className="r mono num">{r.penalty.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="t-small faint panel-pad">
          Thresholds are currently written into detectors.py. ADR-012 plans to move them into versioned YAML.
        </p>
      </section>
    </div>
  )
}

export function SystemDevops() {
  const chain: { label: string; planned?: boolean }[] = [
    { label: 'Commit' },
    { label: 'CI · GitHub Actions' },
    { label: 'Docker image' },
    { label: 'Registry', planned: true },
    { label: 'ArgoCD', planned: true },
    { label: 'Kubernetes', planned: true },
    { label: 'Production', planned: true },
  ]
  return (
    <div className="stack gap-16">
      <section className="panel panel-pad stack gap-12">
        <span className="t-section">Deployment pipeline</span>
        <ol className="deploy-chain">
          {chain.map((c, i) => (
            <li key={c.label}>
              {i > 0 && <span className="faint">→</span>}
              <span className={`step-box ${c.planned ? 'planned' : ''}`}>{c.label}</span>
            </li>
          ))}
        </ol>
        <p className="t-small muted">
          Dashed steps are described in docs/17-DEVOPS.md but not set up. The hackathon deployment is Docker Compose (ADR-009).
        </p>
      </section>
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <span className="t-section">This build</span>
          </div>
          <dl className="kv panel-pad">
            <dt>Environment</dt>
            <dd>{import.meta.env.DEV ? 'Development' : 'Production build'}</dd>
            <dt>Branch</dt>
            <dd className="mono t-small">{__BUILD__.branch}</dd>
            <dt>Commit</dt>
            <dd className="mono t-small">{__BUILD__.commit}</dd>
            <dt>Built</dt>
            <dd>{fmtDateTime(__BUILD__.time)}</dd>
            <dt>API</dt>
            <dd className="mono t-small">{API_BASE}</dd>
          </dl>
        </section>
        <section className="panel">
          <div className="panel-head">
            <span className="t-section">CI checks</span>
            <span className="mono t-small muted">.github/workflows/ci.yml</span>
          </div>
          <dl className="kv panel-pad">
            <dt>Runs on</dt>
            <dd>push and pull request to main, develop</dd>
            <dt>Lint</dt>
            <dd className="mono t-small">ruff check .</dd>
            <dt>Types</dt>
            <dd className="mono t-small">mypy .</dd>
            <dt>Tests</dt>
            <dd className="mono t-small">pytest tests/</dd>
            <dt>Frontend</dt>
            <dd className="faint">Not built in CI yet</dd>
          </dl>
        </section>
      </div>
    </div>
  )
}
