import { ArrowUpRight, Info, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import FlawPanel, { FlawList } from '../../components/analysis/FlawPanel'
import ScoreBlock from '../../components/analysis/ScoreBlock'
import Transcript from '../../components/analysis/Transcript'
import Waveform, { type Overlays } from '../../components/analysis/Waveform'
import EmptyState from '../../components/ui/EmptyState'
import SourceTag from '../../components/ui/SourceTag'
import type { FlawRegion } from '../../lib/analysis/model'
import { modeLabel } from '../../lib/analysis/model'
import { getAnalysis } from '../../lib/analysis/store'
import { useClock, useClockState, type PlaybackClock } from '../../lib/audio/playback'
import { fmtDateTime, fmtTime } from '../../lib/format'
import { useSettings } from '../../lib/settings'

function TimeReadout({ clock }: { clock: PlaybackClock }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => clock.onTick((t) => ref.current && (ref.current.textContent = fmtTime(t, true))), [clock])
  return (
    <span className="mono num time-readout">
      <span ref={ref}>0:00.0</span>
      <span className="faint"> / {fmtTime(clock.duration, true)}</span>
    </span>
  )
}

function Controls({ clock, zoom, setZoom }: { clock: PlaybackClock; zoom: number; setZoom: (z: number) => void }) {
  const st = useClockState(clock)
  return (
    <div className="ws-controls">
      <button
        type="button"
        className="btn btn-primary btn-icon"
        onClick={() => clock.toggle()}
        aria-label={st.playing ? 'Pause' : 'Play'}
        title={st.playing ? 'Pause (Space)' : 'Play (Space)'}
      >
        {st.playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => clock.seek(0)} aria-label="Back to start" title="Back to start">
        <RotateCcw size={15} />
      </button>
      <TimeReadout clock={clock} />
      <div className="ws-controls-right">
        <label className="row gap-8 t-small muted">
          <span>Speed</span>
          <select
            id="playback-rate"
            className="select ws-select"
            value={st.rate}
            onChange={(e) => clock.setRate(Number(e.target.value))}
          >
            {[0.5, 0.75, 1, 1.25, 1.5].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
        <label className="row gap-8 t-small muted" title={clock.hasAudio ? 'Volume' : 'No audio for this analysis'}>
          <span>Volume</span>
          <input
            id="playback-volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={st.volume}
            disabled={!clock.hasAudio}
            onChange={(e) => clock.setVolume(Number(e.target.value))}
            className="ws-range"
          />
        </label>
        <div className="row gap-4">
          <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={zoom <= 1} onClick={() => setZoom(zoom / 2)} aria-label="Zoom out">
            <ZoomOut size={15} />
          </button>
          <span className="mono t-small muted num" style={{ width: 26, textAlign: 'center' }}>
            {zoom}×
          </span>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={zoom >= 8} onClick={() => setZoom(zoom * 2)} aria-label="Zoom in">
            <ZoomIn size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  const { id = '' } = useParams()
  const analysis = useMemo(() => getAnalysis(id), [id])
  const { showConfidence } = useSettings()
  const clock = useClock(analysis?.duration ?? 1, analysis?.audio?.participantUrl)
  const [selected, setSelected] = useState<FlawRegion | null>(null)
  const [zoom, setZoom] = useState(1)
  const [overlays, setOverlays] = useState<Overlays>({ pitch: false, energy: false, pauses: false, flaws: true })

  const selectFlaw = useCallback(
    (f: FlawRegion) => {
      clock.pause()
      clock.seek(f.start)
      setSelected(f)
    },
    [clock],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName) || el.isContentEditable) return
      if (el.getAttribute('role') === 'button') return
      if (e.key === ' ') {
        e.preventDefault()
        clock.toggle()
      } else if (e.key === 'ArrowLeft') clock.seek(clock.time - 2)
      else if (e.key === 'ArrowRight') clock.seek(clock.time + 2)
      else if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clock])

  const pauses = useMemo(() => {
    const w = analysis?.words
    if (!w || analysis?.wordTimingEstimated) return []
    const out: { start: number; end: number }[] = []
    for (let i = 1; i < w.length; i++) if (w[i].start - w[i - 1].end > 0.25) out.push({ start: w[i - 1].end, end: w[i].start })
    return out
  }, [analysis])

  if (!analysis) {
    return (
      <div className="panel">
        <EmptyState
          title="This analysis isn't in this browser"
          action={
            <div className="row gap-8 wrap" style={{ justifyContent: 'center' }}>
              <Link to="/practice" className="btn btn-primary">
                Record an attempt
              </Link>
              <Link to="/analysis" className="btn">
                All analyses
              </Link>
            </div>
          }
        >
          Analyses are kept in the browser that created them. It may have been cleared in Settings.
        </EmptyState>
      </div>
    )
  }

  const a = analysis
  const hasPeaks = Boolean(a.peaks?.participant?.length)
  const hasContours = Boolean(a.contours)
  const overlayToggles: { key: keyof Overlays; label: string; disabled?: string }[] = [
    { key: 'pitch', label: 'Pitch F0', disabled: hasContours ? undefined : 'Needs the recording in this browser' },
    { key: 'energy', label: 'Energy RMS', disabled: hasContours ? undefined : 'Needs the recording in this browser' },
    { key: 'pauses', label: 'Pauses', disabled: pauses.length ? undefined : 'Needs word alignment from the API' },
    { key: 'flaws', label: 'Flaws' },
  ]

  return (
    <div className="analysis">
      <header className="an-header">
        <div className="stack gap-8 grow">
          <div className="row gap-8 wrap">
            <SourceTag kind={a.source === 'live' ? 'live' : 'example'} />
            <span className="badge">{modeLabel(a.mode)}</span>
            <span className="t-small faint">{a.source === 'live' ? fmtDateTime(a.createdAt) : 'Built-in example'}</span>
          </div>
          <h1 className="t-display">{a.title}</h1>
          <p className="muted">
            Reference: {a.referenceLabel} <span className="faint">·</span> Duration {fmtTime(a.duration)}
            {a.participantFile && (
              <>
                {' '}
                <span className="faint">·</span> <span className="mono t-small">{a.participantFile}</span>
              </>
            )}
          </p>
        </div>
        <div className="row gap-8 wrap">
          <Link to={`/analysis/${a.id}/data`} className="btn">
            Data view <ArrowUpRight size={14} />
          </Link>
          <Link to="/practice" className="btn btn-primary">
            New attempt
          </Link>
        </div>
      </header>

      {a.source === 'live' && !a.audio?.participantUrl && (
        <p className="notice" style={{ marginBottom: 16 }}>
          <Info size={15} />
          <span>
            Recordings aren't stored, so after a reload the waveform and playback are gone. The score, flaws and
            transcript are kept. Playback below runs as a silent timer.
          </span>
        </p>
      )}

      <div className="an-grid">
        <aside className="panel panel-pad an-score">
          <ScoreBlock total={a.score.total} buckets={a.score.buckets} version={a.scoringVersion} />
        </aside>

        <section className="panel an-workstation" aria-label="Waveform">
          <div className="ws-top">
            <div className="row gap-12 wrap">
              <span className="t-section">Waveform</span>
              <span className="legend">
                <span>
                  <i style={{ background: 'var(--participant)' }} />
                  Participant
                </span>
                {a.peaks?.reference && (
                  <span>
                    <i style={{ background: 'var(--reference)' }} />
                    Reference
                  </span>
                )}
                {overlays.pitch && a.contours?.pitchPart && (
                  <span>
                    <i style={{ background: 'var(--participant)', height: 3 }} />
                    F0
                  </span>
                )}
                {overlays.pitch && a.contours?.pitchRef && (
                  <span>
                    <i className="dashed" style={{ color: 'var(--reference)' }} />
                    Reference F0
                  </span>
                )}
                {overlays.energy && (
                  <span>
                    <i style={{ background: 'var(--warn)' }} />
                    Energy
                  </span>
                )}
              </span>
            </div>
            {a.source === 'live' && hasContours && (overlays.pitch || overlays.energy) && <SourceTag kind="browser" />}
          </div>
          {!hasPeaks && (
            <p className="ws-nopeaks t-small muted">No waveform: the recording isn't available in this browser.</p>
          )}
          <Waveform
            clock={clock}
            duration={a.duration}
            peaks={a.peaks}
            referenceDuration={a.referenceDuration}
            contours={a.contours}
            flaws={a.flaws}
            overlays={overlays}
            pauses={pauses}
            selectedId={selected?.id ?? null}
            onSelectFlaw={selectFlaw}
            zoom={zoom}
          />
          <Controls clock={clock} zoom={zoom} setZoom={setZoom} />
          <div className="ws-toggles" role="group" aria-label="Overlays">
            {overlayToggles.map((t) => (
              <label key={t.key} className={`toggle ${t.disabled ? 'is-disabled' : ''}`} title={t.disabled}>
                <input
                  id={`overlay-${t.key}`}
                  type="checkbox"
                  checked={overlays[t.key] && !t.disabled}
                  disabled={Boolean(t.disabled)}
                  onChange={(e) => setOverlays((o) => ({ ...o, [t.key]: e.target.checked }))}
                />
                <span>{t.label}</span>
              </label>
            ))}
            {(overlays.pitch || overlays.energy) && (
              <span className="t-small faint">Contours are z-scored per speaker (shape channel, ADR-001).</span>
            )}
          </div>
        </section>

        <section className="panel an-transcript" aria-label="Transcript">
          <div className="panel-head">
            <span className="t-section">Transcript</span>
            {a.words && a.wordTimingEstimated && (
              <span className="badge" title="The API doesn't return word alignment yet, so word times are spread evenly across the recording.">
                Word timing estimated
              </span>
            )}
          </div>
          <div className="panel-pad">
            {a.words ? (
              <Transcript words={a.words} clock={clock} flaws={a.flaws} selected={selected} onSelectFlaw={selectFlaw} />
            ) : (
              <EmptyState compact title="No transcript for this attempt">
                Add the text you read next time, and the words will follow the audio here.
              </EmptyState>
            )}
          </div>
        </section>

        <aside className="an-side">
          {selected ? (
            <div className="panel panel-pad flaw-drawer" key={selected.id}>
              <FlawPanel flaw={selected} onClose={() => setSelected(null)} showConfidence={showConfidence} />
            </div>
          ) : null}
          <div className="panel">
            <div className="panel-head">
              <span className="t-section">Flaws</span>
              <span className="t-small muted num">{a.flaws.length}</span>
            </div>
            {a.flaws.length ? (
              <FlawList flaws={a.flaws} selectedId={selected?.id ?? null} onSelect={selectFlaw} />
            ) : (
              <EmptyState compact title="No flaws detected">
                Every measured word stayed within the thresholds.
              </EmptyState>
            )}
            {!selected && a.flaws.length > 0 && (
              <p className="t-small faint an-hint">Select a flaw or a marker on the waveform to see the evidence.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
