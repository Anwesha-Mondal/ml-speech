import { Info, TriangleAlert, X } from 'lucide-react'
import type { FlawRegion } from '../../lib/analysis/model'
import { BUCKETS, flawMeta } from '../../lib/analysis/model'
import { fmtSec } from '../../lib/format'
import { severityOf } from './severity'

export function FlawList({
  flaws,
  selectedId,
  onSelect,
}: {
  flaws: FlawRegion[]
  selectedId: string | null
  onSelect: (f: FlawRegion) => void
}) {
  return (
    <ul className="flaw-list">
      {flaws.map((f) => {
        const meta = flawMeta(f.type)
        return (
          <li key={f.id}>
            <button
              type="button"
              className={`flaw-row ${f.id === selectedId ? 'is-selected' : ''}`}
              onClick={() => onSelect(f)}
              aria-pressed={f.id === selectedId}
            >
              <span className={`flaw-swatch sev-${severityOf(f)}`} aria-hidden="true" />
              <span className="grow">
                <span className="flaw-row-title">{meta.label}</span>
                <span className="flaw-row-sub mono">
                  {fmtSec(f.start)} – {fmtSec(f.end)}
                  {f.word ? ` · “${f.word}”` : ''}
                </span>
              </span>
              <span className="num mono flaw-row-pen">{f.penalty.toFixed(1).replace('-', '−')}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default function FlawPanel({
  flaw,
  onClose,
  showConfidence,
}: {
  flaw: FlawRegion
  onClose: () => void
  showConfidence: boolean
}) {
  const meta = flawMeta(flaw.type)
  const bucket = BUCKETS.find((b) => b.key === flaw.bucket)
  return (
    <section className="flaw-panel" aria-label={`${meta.label} explanation`}>
      <div className="row between">
        <span className={`badge badge-mono badge-${severityOf(flaw)}`}>{flaw.type}</span>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close explanation">
          <X size={15} />
        </button>
      </div>
      <h3 className="t-title">{meta.label}</h3>
      <p className="mono flaw-time">
        {fmtSec(flaw.start)} — {fmtSec(flaw.end)}
      </p>

      {flaw.evidence && (
        <dl className="flaw-evidence">
          <div className="flaw-ev-metric t-label">{flaw.evidence.metric}</div>
          {flaw.evidence.rows.map((r) => (
            <div key={r.label} className="flaw-ev-row">
              <dt>{r.label}</dt>
              <dd className="num">{r.value}</dd>
            </div>
          ))}
          <div className="flaw-ev-row flaw-ev-dev">
            <dt>Deviation</dt>
            <dd className="num">{flaw.evidence.deviation}</dd>
          </div>
        </dl>
      )}

      <div className="flaw-block">
        <div className="t-label">Measured</div>
        <p>{flaw.fact}</p>
      </div>
      {meta.interpretation && (
        <div className="flaw-block">
          <div className="t-label">What happened</div>
          <p>{meta.interpretation}</p>
        </div>
      )}
      {meta.action && (
        <div className="flaw-block">
          <div className="t-label">Action</div>
          <p>{meta.action}</p>
        </div>
      )}

      <dl className="kv flaw-meta">
        <dt>Bucket</dt>
        <dd>{bucket?.label ?? flaw.bucket}</dd>
        <dt>Deduction</dt>
        <dd className="mono">
          {flaw.penalty.toFixed(1).replace('-', '−')}
          {flaw.count > 1 ? ` (${flaw.count} words)` : ''}
        </dd>
        {flaw.confidence != null && (
          <>
            <dt>Confidence</dt>
            <dd className="mono">{flaw.confidence.toFixed(2)}</dd>
          </>
        )}
      </dl>

      {showConfidence && flaw.confidence != null && flaw.confidence < 0.8 && (
        <p className="notice notice-warn">
          <TriangleAlert size={15} />
          <span>
            High background noise detected in this segment; temporal measurements may be less accurate.
          </span>
        </p>
      )}
      <p className="notice">
        <Info size={15} />
        <span>Explanations come from fixed templates (docs/10-EXPLAINABILITY.md), not generated text.</span>
      </p>
    </section>
  )
}
