import { Check, X } from 'lucide-react'
import type { RunProgress, StageKey } from '../../lib/analysis/run'

const STEPS: { key: StageKey; title: string; sub: string }[] = [
  { key: 'upload', title: 'Uploading', sub: 'Sending the recording to the API.' },
  {
    key: 'server',
    title: 'Server pipeline',
    sub: 'The API reports one status for all of these stages:',
  },
  { key: 'signals', title: 'Preparing the waveform', sub: 'Drawing the waveform and contours in your browser.' },
  { key: 'ready', title: 'Ready', sub: 'Opening the analysis.' },
]

const SERVER_STAGES = ['Normalizing', 'Aligning', 'Extracting features', 'Grounding flaws', 'Calculating score']

export default function ProcessingSteps({ progress }: { progress: RunProgress }) {
  return (
    <ol className="steps" aria-live="polite">
      {STEPS.map((s) => {
        const st = progress.states[s.key]
        return (
          <li key={s.key} className={`step is-${st}`}>
            <span className="step-mark" aria-hidden="true">
              {st === 'done' && <Check size={12} strokeWidth={3} />}
              {st === 'error' && <X size={12} strokeWidth={3} />}
            </span>
            <div className="stack gap-4">
              <span className="step-title">{s.title}</span>
              <span className="step-sub">{s.sub}</span>
              {s.key === 'server' && (
                <ul className="substeps">
                  {SERVER_STAGES.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
              {s.key === 'server' && st === 'active' && progress.note && (
                <span className="step-sub" style={{ color: 'var(--warn)' }}>
                  {progress.note}
                </span>
              )}
            </div>
            <span className="mono t-small muted num">
              {s.key === 'server' && progress.serverSeconds != null && st !== 'pending'
                ? `${progress.serverSeconds.toFixed(0)}s`
                : ''}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
