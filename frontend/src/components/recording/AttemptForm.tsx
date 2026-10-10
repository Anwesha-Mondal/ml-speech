import { ArrowRight, CircleAlert, Sparkles, Loader2, FileAudio } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EXAMPLE_ID } from '../../lib/analysis/example'
import type { Mode } from '../../lib/api/types'
import { useAnalysisRun } from '../../lib/analysis/useRun'
import { generateTranscript, transcribeAudio } from '../../lib/api/client'
import { REFERENCES } from '../../lib/references'
import { useApiHealth } from '../../lib/useApiHealth'
import AudioInput from './AudioInput'
import ProcessingSteps from './ProcessingSteps'

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
  const [isGenerating, setIsGenerating] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
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
          // Only a chosen reference passage can be ranked; custom text never is.
          promptId: showReferencePicker && ref.id !== 'custom' ? ref.id : undefined,
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

      <div className="field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label htmlFor={`${mode}-transcript`}>{transcriptLabel}</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {participant && (
              <button
                type="button"
                className="btn btn-small"
                disabled={isTranscribing}
                onClick={async (e) => {
                  e.preventDefault()
                  if (!participant) return
                  setIsTranscribing(true)
                  try {
                    const res = await transcribeAudio(participant)
                    if (res.error) alert(res.error)
                    else setTranscript(res.transcript)
                  } catch (e: any) {
                    alert(e.message)
                  } finally {
                    setIsTranscribing(false)
                  }
                }}
                title="Transcribe your recording"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
              >
                {isTranscribing ? <Loader2 size={14} className="spin" /> : <FileAudio size={14} />}
                {isTranscribing ? 'Transcribing...' : 'Auto-transcribe'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-small"
              disabled={isGenerating}
              onClick={async (e) => {
                e.preventDefault()
                setIsGenerating(true)
                try {
                  const res = await generateTranscript()
                  setTranscript(res.transcript)
                } catch (e: any) {
                  alert(e.message)
                } finally {
                  setIsGenerating(false)
                }
              }}
              title="Generate a random passage to practice reading"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
            >
              {isGenerating ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              {isGenerating ? 'Generating...' : 'Auto-generate'}
            </button>
          </div>
        </div>
        <textarea
          id={`${mode}-transcript`}
          className="textarea"
          rows={4}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste or type the passage. Leave it empty if you improvised."
        />
        <span className="t-small faint">{transcriptHelp}</span>
      </div>

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
