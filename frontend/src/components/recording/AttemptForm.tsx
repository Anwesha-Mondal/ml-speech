import { ArrowRight, CircleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EXAMPLE_ID } from '../../lib/analysis/example'
import type { Mode } from '../../lib/api/types'
import { useAnalysisRun } from '../../lib/analysis/useRun'
import { REFERENCES } from '../../lib/references'
import { useApiHealth } from '../../lib/useApiHealth'
import AudioInput from './AudioInput'
import ProcessingSteps from './ProcessingSteps'

/**
 * Shared "choose → record/upload → submit" form used by Practice and the Assessment modes.
 * `stage` lets a mode render its own recording surface (teleprompter, question card…).
 */
export default function AttemptForm({
  mode,
  defaultReference = 'asset-07',
  transcriptLabel = 'Transcript of what you read',
  transcriptHelp = 'Optional. With it, the transcript panel follows the audio.',
  showReferencePicker = true,
  stage,
  initialTranscript,
  submitLabel = 'Analyze delivery',
}: {
  mode: Mode
  defaultReference?: string
  transcriptLabel?: string
  transcriptHelp?: string
  showReferencePicker?: boolean
  stage?: (transcript: string) => ReactNode
  initialTranscript?: string
  submitLabel?: string
}) {
  const [refId, setRefId] = useState(defaultReference)
  const ref = REFERENCES.find((r) => r.id === refId) ?? REFERENCES[0]
  const [transcript, setTranscript] = useState(initialTranscript ?? ref.text)
  const [participant, setParticipant] = useState<File | null>(null)
  const [refAudio, setRefAudio] = useState<File | null>(null)
  const run = useAnalysisRun()
  const health = useApiHealth()

  if (run.progress) {
    return (
      <div className="panel panel-pad attempt-progress">
        <div className="stack gap-4" style={{ marginBottom: 12 }}>
          <span className="t-section">Analyzing {participant?.name}</span>
          <span className="t-small muted">Keep this page open. It moves to the analysis when it's ready.</span>
        </div>
        <ProcessingSteps progress={run.progress} />
        {run.error && (
          <div className="stack gap-12" style={{ marginTop: 12 }}>
            <p className="notice notice-bad">
              <CircleAlert size={15} />
              <span>{run.error}</span>
            </p>
            <div className="row gap-8 wrap">
              <button type="button" className="btn btn-primary" onClick={run.reset}>
                Back to the form
              </button>
              <Link to={`/analysis/${EXAMPLE_ID}`} className="btn">
                Open the example analysis
              </Link>
            </div>
          </div>
        )}
      </div>
    )
  }

  const canSubmit = Boolean(participant)

  return (
    <form
      className="attempt"
      onSubmit={(e) => {
        e.preventDefault()
        if (!participant) return
        void run.submit({
          participant,
          reference: refAudio,
          transcript: transcript.trim(),
          mode,
          title: ref.id === 'custom' ? 'Practice attempt' : ref.title,
          referenceLabel: ref.id === 'custom' ? (refAudio ? refAudio.name : 'none') : `${ref.speaker} · ${ref.license.toLowerCase()}`,
        })
      }}
    >
      {health.state === 'offline' && (
        <p className="notice notice-warn">
          <CircleAlert size={15} />
          <span>
            The API isn't reachable, so recordings can't be analyzed right now. Start the backend, or{' '}
            <Link to={`/analysis/${EXAMPLE_ID}`}>open the example analysis</Link>.
          </span>
        </p>
      )}

      {showReferencePicker && (
        <div className="grid-2">
          <label className="field">
            <span>Reference speech</span>
            <select
              id={`${mode}-reference`}
              className="select"
              value={refId}
              onChange={(e) => {
                const next = REFERENCES.find((r) => r.id === e.target.value) ?? REFERENCES[0]
                setRefId(next.id)
                setTranscript(next.text)
              }}
            >
              {REFERENCES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                  {r.id !== 'custom' ? ` — ${r.speaker}` : ''}
                </option>
              ))}
            </select>
          </label>
          <AudioInput
            id={`${mode}-ref-audio`}
            label="Reference recording (optional)"
            file={refAudio}
            onFile={setRefAudio}
            allowRecord={false}
          />
        </div>
      )}

      {stage?.(transcript)}

      <label className="field">
        <span>{transcriptLabel}</span>
        <textarea
          id={`${mode}-transcript`}
          className="textarea"
          rows={4}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste or type the passage. Leave it empty if you improvised."
        />
        <span className="t-small faint">{transcriptHelp}</span>
      </label>

      <AudioInput id={`${mode}-participant`} file={participant} onFile={setParticipant} />

      <div className="row gap-12 wrap attempt-foot">
        <button type="submit" className="btn btn-primary btn-lg" disabled={!canSubmit}>
          {submitLabel} <ArrowRight size={15} />
        </button>
        {!canSubmit && <span className="t-small muted">Record or upload your attempt first.</span>}
      </div>
    </form>
  )
}
