import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import { modeLabel } from '../../lib/analysis/model'
import { useAnalyses } from '../../lib/analysis/store'
import { fmtDateTime } from '../../lib/format'
import { PIPELINE, STAGE_STATUS, type StageStatus } from '../../lib/pipeline'

function Status({ s }: { s: StageStatus }) {
  const meta = STAGE_STATUS[s]
  return (
    <span className={`status ${meta.cls}`}>
      <span className="dot" />
      {meta.label}
    </span>
  )
}

export default function Pipeline() {
  const [sel, setSel] = useState(PIPELINE[0].key)
  const stage = PIPELINE.find((p) => p.key === sel) ?? PIPELINE[0]
  const jobs = useAnalyses().filter((a) => a.jobId)
  const counts = PIPELINE.reduce<Record<string, number>>((m, p) => ({ ...m, [p.status]: (m[p.status] ?? 0) + 1 }), {})

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="The stages a recording goes through on the server, and which of them POST /api/analyze runs today."
      />
      <div className="row gap-16 wrap" style={{ marginBottom: 16 }}>
        {(Object.keys(STAGE_STATUS) as StageStatus[]).map((k) => (
          <span key={k} className="row gap-8 t-small">
            <Status s={k} />
            <span className="mono num muted">{counts[k] ?? 0}</span>
          </span>
        ))}
      </div>
      <div className="pipe">
        <section className="panel">
          <ol className="pipe-list" aria-label="Pipeline stages">
            {PIPELINE.map((p, i) => (
              <li key={p.key}>
                <button
                  type="button"
                  className={`pipe-stage ${p.key === sel ? 'is-selected' : ''}`}
                  onClick={() => setSel(p.key)}
                  aria-pressed={p.key === sel}
                >
                  <span className="pipe-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="t-small" style={{ fontWeight: 500 }}>
                    {p.name}
                  </span>
                  <Status s={p.status} />
                </button>
              </li>
            ))}
          </ol>
        </section>

        <div className="stack gap-16">
          <section className="panel panel-pad stack gap-12" aria-live="polite">
            <div className="row between wrap gap-8">
              <h2 className="t-title">{stage.name}</h2>
              <Status s={stage.status} />
            </div>
            <dl className="kv">
              <dt>Module</dt>
              <dd className="mono t-small">{stage.module}</dd>
              <dt>Input</dt>
              <dd>{stage.input}</dd>
              <dt>Output</dt>
              <dd>{stage.output}</dd>
              <dt>Errors</dt>
              <dd className="muted">None recorded</dd>
            </dl>
            {stage.note && <p className="notice">{stage.note}</p>}
          </section>

          <section className="panel">
            <div className="panel-head">
              <span className="t-section">Recent jobs</span>
              <span className="t-small muted">from this browser</span>
            </div>
            {jobs.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Mode</th>
                      <th className="r">Server time</th>
                      <th>Status</th>
                      <th>Finished</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.slice(0, 10).map((a) => (
                      <tr key={a.id}>
                        <td className="mono t-small">
                          <Link to={`/analysis/${a.id}`}>{a.jobId?.slice(0, 8)}</Link>
                        </td>
                        <td className="muted">{modeLabel(a.mode)}</td>
                        <td className="r mono num">{a.serverSeconds != null ? `${a.serverSeconds.toFixed(1)} s` : '—'}</td>
                        <td>
                          <span className="status status-ok">
                            <span className="dot" />
                            completed
                          </span>
                        </td>
                        <td className="muted">{fmtDateTime(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="panel-pad t-small muted">All processing queues are clear.</p>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
