import { CircleAlert, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import AudioInput from '../../components/recording/AudioInput'
import SourceTag from '../../components/ui/SourceTag'
import { computeContours, decodeFile } from '../../lib/audio/analyze'
import { compareMimic, MAX_SECONDS, SCALE, type MimicResult } from '../../lib/audio/mimic'

function ContourPlot({ r }: { r: MimicResult }) {
  const W = 900
  const H = 260
  const pad = 14
  const n = r.t.length
  const x = (i: number) => pad + (i / Math.max(n - 1, 1)) * (W - pad * 2)
  const y = (z: number) => H / 2 - Math.max(-3, Math.min(3, z)) * ((H - pad * 2) / 6)

  const line = (vals: (number | null)[]) => {
    let d = ''
    let pen = false
    vals.forEach((v, i) => {
      if (v == null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
      pen = true
    })
    return d
  }

  // Tolerance band ±0.75 z around the reference.
  let band = ''
  let segStart = -1
  const closeSeg = (end: number) => {
    if (segStart < 0) return
    const top: string[] = []
    const bot: string[] = []
    for (let i = segStart; i < end; i++) {
      const v = r.refPitch[i] as number
      top.push(`${x(i).toFixed(1)},${y(v + 0.75).toFixed(1)}`)
      bot.unshift(`${x(i).toFixed(1)},${y(v - 0.75).toFixed(1)}`)
    }
    band += `M${top.join('L')}L${bot.join('L')}Z`
    segStart = -1
  }
  r.refPitch.forEach((v, i) => {
    if (v != null && segStart < 0) segStart = i
    if (v == null) closeSeg(i)
  })
  closeSeg(n)

  const devSegs: (number | null)[] = r.partPitchWarped.map((v, i) => (r.deviation[i] ? v : null))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="contour-plot" role="img" aria-label="Reference and participant pitch contours">
      <line x1={pad} x2={W - pad} y1={H / 2} y2={H / 2} stroke="var(--line)" />
      <path d={band} fill="var(--tolerance)" />
      <path d={line(r.refPitch)} fill="none" stroke="var(--reference)" strokeWidth="1.5" />
      <path d={line(r.partPitchWarped)} fill="none" stroke="var(--participant)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={line(devSegs)} fill="none" stroke="var(--bad)" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

export default function Mimic() {
  const [ref, setRef] = useState<File | null>(null)
  const [part, setPart] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MimicResult | null>(null)

  const compare = async () => {
    if (!ref || !part) return
    setBusy(true)
    setError(null)
    try {
      const [ra, pa] = await Promise.all([decodeFile(ref), decodeFile(part)])
      if (ra.duration > MAX_SECONDS || pa.duration > MAX_SECONDS)
        throw new Error(`Keep both clips under ${MAX_SECONDS} seconds. Mimic Party compares short phrases.`)
      const [rc, pc] = await Promise.all([computeContours(ra), computeContours(pa)])
      setResult(compareMimic(rc, pc))
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'One of the files could not be decoded. Try WAV or MP3.',
      )
    } finally {
      setBusy(false)
    }
  }

  const metrics = result
    ? [
        { label: 'Cadence match', v: result.cadence },
        { label: 'Pause match', v: result.pauses },
        { label: 'Pitch contour match', v: result.pitch },
        { label: 'Energy contour match', v: result.energy },
      ]
    : []

  return (
    <div className="stack gap-16 mimic">
      <div className="panel">
        <div className="panel-head">
          <div className="row gap-12 wrap">
            <span className="t-section">Melody of the phrase</span>
            <span className="legend">
              <span>
                <i style={{ background: 'var(--reference)' }} />
                Target
              </span>
              <span>
                <i style={{ background: 'var(--participant)' }} />
                You
              </span>
              <span>
                <i style={{ background: 'var(--bad)' }} />
                Off the target
              </span>
            </span>
          </div>
          {result && <SourceTag kind="browser" />}
        </div>
        <div className="panel-pad">
          {result ? (
            <div className="mimic-stage">
              <ContourPlot r={result} />
              <div className="mimic-score">
                <span className="t-label">Mimic score</span>
                <span className="mimic-num num">{result.score}</span>
                <div className="mimic-metrics">
                  {metrics.map((m) => (
                    <div key={m.label} className="stack gap-4">
                      <div className="row between t-small">
                        <span>{m.label}</span>
                        <span className="mono num">{m.v}</span>
                      </div>
                      <div className="hbar">
                        <i style={{ width: `${m.v}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mimic-empty">
              <svg viewBox="0 0 600 120" aria-hidden="true" className="contour-plot">
                <path d="M10,70 C80,20 120,90 190,60 S300,20 360,70 S470,100 590,40" fill="none" stroke="var(--reference)" strokeWidth="1.5" />
                <path d="M10,78 C80,32 120,96 190,66 S300,34 360,74" fill="none" stroke="var(--participant)" strokeWidth="2.5" />
              </svg>
              <p className="muted">Load a target phrase and your imitation. Your line is drawn over the target after time-warping.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel panel-pad">
          <AudioInput id="mimic-ref" label="Target phrase" file={ref} onFile={(f) => { setRef(f); setResult(null) }} disabled={busy} />
        </div>
        <div className="panel panel-pad">
          <AudioInput id="mimic-part" label="Your imitation" file={part} onFile={(f) => { setPart(f); setResult(null) }} disabled={busy} />
        </div>
      </div>

      {error && (
        <p className="notice notice-bad">
          <CircleAlert size={15} />
          <span>{error}</span>
        </p>
      )}
      <div className="row gap-12 wrap">
        <button type="button" className="btn btn-primary btn-lg" disabled={!ref || !part || busy} onClick={() => void compare()}>
          {busy ? 'Comparing…' : 'Compare delivery'}
        </button>
        <span className="t-small muted">Clips up to {MAX_SECONDS} s. Nothing is uploaded; this runs in your browser.</span>
      </div>

      <p className="notice">
        <ShieldCheck size={15} />
        <span>
          Mimic Party scores delivery patterns only: cadence, pause placement, and the shape of pitch and energy. Each
          voice is z-scored against itself first, so timbre and absolute pitch can't raise or lower the score. The two
          clips are aligned by syllable rhythm with Dynamic Time Warping; score = max(0, 100 − mean contour distance ×{' '}
          {SCALE}).
        </span>
      </p>
    </div>
  )
}
