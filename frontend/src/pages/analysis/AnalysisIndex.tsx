import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import SourceTag from '../../components/ui/SourceTag'
import { EXAMPLE_ID } from '../../lib/analysis/example'
import { modeLabel } from '../../lib/analysis/model'
import { deleteAnalysis, getExample, useAnalyses } from '../../lib/analysis/store'
import { fmtDateTime, fmtTime } from '../../lib/format'

export default function AnalysisIndex() {
  const list = useAnalyses()
  const ex = getExample()
  const [confirm, setConfirm] = useState<string | null>(null)

  return (
    <>
      <PageHeader
        title="Analysis"
        description="Every analysis you've run in this browser. Open one to see the waveform, transcript and the evidence behind each deduction."
        actions={
          <Link to="/practice" className="btn btn-primary">
            New attempt
          </Link>
        }
      />
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Speech</th>
                <th>Mode</th>
                <th className="r">Duration</th>
                <th className="r">Flaws</th>
                <th className="r">Score</th>
                <th>Date</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/analysis/${a.id}`}>{a.title}</Link>
                  </td>
                  <td className="muted">{modeLabel(a.mode)}</td>
                  <td className="r mono num">{fmtTime(a.duration)}</td>
                  <td className="r mono num">{a.flaws.length}</td>
                  <td className="r mono num">{a.score.total.toFixed(1)}</td>
                  <td className="muted">{fmtDateTime(a.createdAt)}</td>
                  <td className="r">
                    {confirm === a.id ? (
                      <span className="row gap-4" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteAnalysis(a.id)}>
                          Delete
                        </button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(null)}>
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost btn-icon"
                        onClick={() => setConfirm(a.id)}
                        aria-label={`Delete ${a.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <Link to={`/analysis/${EXAMPLE_ID}`}>{ex.title}</Link> <SourceTag kind="example" />
                </td>
                <td className="muted">{modeLabel(ex.mode)}</td>
                <td className="r mono num">{fmtTime(ex.duration)}</td>
                <td className="r mono num">{ex.flaws.length}</td>
                <td className="r mono num">{ex.score.total.toFixed(1)}</td>
                <td className="muted">Built in</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {!list.length && (
          <EmptyState compact title="Record an attempt to begin analysis.">
            Until then, the example above shows what a finished analysis looks like.
          </EmptyState>
        )}
      </div>
    </>
  )
}
