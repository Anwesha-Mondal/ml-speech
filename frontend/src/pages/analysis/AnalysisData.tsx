import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import SourceTag from '../../components/ui/SourceTag'
import { flawMeta } from '../../lib/analysis/model'
import { getAnalysis } from '../../lib/analysis/store'
import { fmtTime } from '../../lib/format'

/** Rough syllable count (vowel groups), as in the engine's algorithmic fallback. */
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  const groups = w.replace(/e$/, '').match(/[aeiouy]+/g)
  return Math.max(1, groups?.length ?? 1)
}

export default function AnalysisData() {
  const { id = '' } = useParams()
  const a = useMemo(() => getAnalysis(id), [id])
  if (!a) {
    return (
      <div className="panel">
        <EmptyState title="This analysis isn't in this browser" action={<Link to="/analysis" className="btn">All analyses</Link>} />
      </div>
    )
  }

  const c = a.contours
  const voiced = c?.pitchPart ? c.pitchPart.filter((v) => v != null).length / c.pitchPart.length : null
  const words = a.words ?? []
  const totalSyl = words.reduce((s, w) => s + syllables(w.text), 0)
  const speaking = words.reduce((s, w) => s + (w.end - w.start), 0)

  const notReturned = 'Not returned by the API yet'
  const measures: { k: string; v: string; src?: 'live' | 'example' | 'browser' }[] = [
    { k: 'Duration', v: fmtTime(a.duration, true) },
    { k: 'Words', v: words.length ? String(words.length) : '—' },
    {
      k: 'Mean articulation rate',
      v: speaking > 0 ? `${(totalSyl / speaking).toFixed(2)} syllables/sec${a.wordTimingEstimated ? ' (from estimated timing)' : ''}` : '—',
    },
    { k: 'F0 contour', v: c?.pitchPart ? `${c.t.length} frames · 20 ms hop · voiced ${(voiced! * 100).toFixed(0)}%` : notReturned, src: c ? (a.source === 'live' ? 'browser' : 'example') : undefined },
    { k: 'RMS energy contour', v: c?.energyPart ? `${c.t.length} frames · 20 ms hop` : notReturned, src: c ? (a.source === 'live' ? 'browser' : 'example') : undefined },
    { k: 'MFCC-13', v: notReturned },
    { k: 'Spectrum (FFT)', v: notReturned },
    { k: 'Alignment confidence', v: a.flaws.some((f) => f.confidence != null) ? 'Per flaw, see table below' : notReturned },
    { k: 'Normalization', v: 'Two-channel: semitone / dB-relative magnitude + per-speaker z-score shape (ADR-001)' },
    { k: 'DTW', v: 'Not used in the main path; words are matched by alignment (ADR-002). Used by Mimic Party.' },
    { k: 'Scoring version', v: a.scoringVersion },
    { k: 'Server time', v: a.serverSeconds != null ? `${a.serverSeconds.toFixed(1)} s` : '—' },
    { k: 'Job ID', v: a.jobId ?? '—' },
  ]

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to={`/analysis/${a.id}`} className="row gap-4" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={12} /> Back to analysis
          </Link>
        }
        title={`${a.title} · data`}
        description="The measurements behind the analysis, for technical review."
        actions={<SourceTag kind={a.source === 'live' ? 'live' : 'example'} />}
      />
      <div className="stack gap-16">
        <div className="grid-2">
          <section className="panel">
            <div className="panel-head">
              <span className="t-section">Measurements</span>
            </div>
            <dl className="kv panel-pad">
              {measures.map((m) => (
                <div key={m.k} style={{ display: 'contents' }}>
                  <dt>{m.k}</dt>
                  <dd className={m.v === notReturned ? 'faint' : ''}>{m.v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="panel">
            <div className="panel-head">
              <span className="t-section">Flaw evidence</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th className="r">Start</th>
                    <th className="r">End</th>
                    <th>Metric</th>
                    <th className="r">Deviation</th>
                    <th className="r">Conf.</th>
                    <th className="r">Penalty</th>
                  </tr>
                </thead>
                <tbody>
                  {a.flaws.map((f) => (
                    <tr key={f.id}>
                      <td className="mono t-small" title={flawMeta(f.type).label}>
                        {f.type}
                      </td>
                      <td className="r mono num">{f.start.toFixed(2)}</td>
                      <td className="r mono num">{f.end.toFixed(2)}</td>
                      <td className="t-small">{f.evidence?.metric ?? '—'}</td>
                      <td className="r mono num">{f.evidence?.deviation ?? '—'}</td>
                      <td className="r mono num">{f.confidence != null ? f.confidence.toFixed(2) : '—'}</td>
                      <td className="r mono num">{f.penalty.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!a.flaws.length && <p className="panel-pad t-small muted">No flaws.</p>}
          </section>
        </div>

        <section className="panel">
          <div className="panel-head">
            <span className="t-section">Words</span>
            {a.wordTimingEstimated && <span className="badge">Timing estimated</span>}
          </div>
          {words.length ? (
            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Word</th>
                    <th className="r">Start (s)</th>
                    <th className="r">End (s)</th>
                    <th className="r">Syllables</th>
                    <th className="r">Local rate (syl/s)</th>
                    <th className="r">Pause after (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {words.map((w, i) => {
                    const syl = syllables(w.text)
                    const next = words[i + 1]
                    return (
                      <tr key={i}>
                        <td className="mono faint num">{i + 1}</td>
                        <td>{w.text}</td>
                        <td className="r mono num">{w.start.toFixed(2)}</td>
                        <td className="r mono num">{w.end.toFixed(2)}</td>
                        <td className="r mono num">{syl}</td>
                        <td className="r mono num">{(syl / Math.max(w.end - w.start, 0.01)).toFixed(1)}</td>
                        <td className="r mono num">{next ? Math.max(0, next.start - w.end).toFixed(2) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel-pad t-small muted">No transcript was given for this attempt.</p>
          )}
        </section>

        {a.raw && (
          <section className="panel">
            <div className="panel-head">
              <span className="t-section">API response</span>
              <span className="mono t-small muted">GET /api/jobs/{a.jobId}</span>
            </div>
            <div className="panel-pad">
              <pre className="code">{JSON.stringify(a.raw, null, 2)}</pre>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
