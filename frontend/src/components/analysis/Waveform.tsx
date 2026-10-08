import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Contours, FlawRegion } from '../../lib/analysis/model'
import { flawMeta } from '../../lib/analysis/model'
import type { PlaybackClock } from '../../lib/audio/playback'
import { fmtTime } from '../../lib/format'
import { severityOf } from './severity'

export interface Overlays {
  pitch: boolean
  energy: boolean
  pauses: boolean
  flaws: boolean
}

function cssVar(el: Element, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || '#111'
}

function drawPeaks(
  ctx: CanvasRenderingContext2D,
  peaks: number[],
  w: number,
  h: number,
  color: string,
  scaleX: number,
  mirrorAlpha: number,
) {
  const mid = h / 2
  const bar = 2
  const gap = 1
  const cols = Math.floor((w * scaleX) / (bar + gap))
  ctx.fillStyle = color
  for (let c = 0; c < cols; c++) {
    const from = Math.floor((c / cols) * peaks.length)
    const to = Math.max(from + 1, Math.floor(((c + 1) / cols) * peaks.length))
    let p = 0
    for (let i = from; i < to && i < peaks.length; i++) p = Math.max(p, peaks[i])
    const amp = Math.max(1, p * (mid - 4))
    const x = c * (bar + gap)
    ctx.globalAlpha = 1
    ctx.fillRect(x, mid - amp, bar, amp)
    ctx.globalAlpha = mirrorAlpha
    ctx.fillRect(x, mid, bar, amp * 0.85)
  }
  ctx.globalAlpha = 1
}

function drawContour(
  ctx: CanvasRenderingContext2D,
  t: number[],
  v: (number | null)[],
  duration: number,
  w: number,
  h: number,
  color: string,
  dashed: boolean,
  lineWidth: number,
) {
  const y = (z: number) => h / 2 - Math.max(-3, Math.min(3, z)) * (h / 7)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.setLineDash(dashed ? [4, 4] : [])
  ctx.beginPath()
  let pen = false
  for (let i = 0; i < t.length; i++) {
    const z = v[i]
    if (z == null) {
      pen = false
      continue
    }
    const x = (t[i] / duration) * w
    if (!pen) ctx.moveTo(x, y(z))
    else ctx.lineTo(x, y(z))
    pen = true
  }
  ctx.stroke()
  ctx.setLineDash([])
}

export default function Waveform({
  clock,
  duration,
  peaks,
  referenceDuration,
  contours,
  flaws,
  overlays,
  pauses,
  selectedId,
  onSelectFlaw,
  zoom,
}: {
  clock: PlaybackClock
  duration: number
  peaks?: { participant?: number[]; reference?: number[] }
  referenceDuration?: number
  contours?: Contours
  flaws: FlawRegion[]
  overlays: Overlays
  pauses: { start: number; end: number }[]
  selectedId: string | null
  onSelectFlaw: (f: FlawRegion) => void
  zoom: number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const waveRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [themeTick, setThemeTick] = useState(0)

  // Track container width.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Redraw when the theme changes.
  useEffect(() => {
    const mo = new MutationObserver(() => setThemeTick((n) => n + 1))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onMq = () => setThemeTick((n) => n + 1)
    mq.addEventListener('change', onMq)
    return () => {
      mo.disconnect()
      mq.removeEventListener('change', onMq)
    }
  }, [])

  const innerW = Math.max(1, Math.floor(width * zoom))
  const H = 148

  // Waveform layers.
  useEffect(() => {
    const cv = waveRef.current
    if (!cv || !innerW) return
    const dpr = window.devicePixelRatio || 1
    cv.width = innerW * dpr
    cv.height = H * dpr
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, innerW, H)
    if (peaks?.reference?.length) {
      const share = referenceDuration ? Math.min(1, referenceDuration / duration) : 1
      drawPeaks(ctx, peaks.reference, innerW, H, cssVar(cv, '--reference'), share, 0.35)
    }
    if (peaks?.participant?.length) {
      drawPeaks(ctx, peaks.participant, innerW, H, cssVar(cv, '--participant'), 1, 0.22)
    }
    // centre line
    ctx.fillStyle = cssVar(cv, '--line')
    ctx.fillRect(0, H / 2, innerW, 1)
  }, [peaks, innerW, duration, referenceDuration, themeTick])

  // Feature overlays.
  useEffect(() => {
    const cv = overlayRef.current
    if (!cv || !innerW) return
    const dpr = window.devicePixelRatio || 1
    cv.width = innerW * dpr
    cv.height = H * dpr
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, innerW, H)
    if (!contours) return
    const ink = cssVar(cv, '--participant')
    const ref = cssVar(cv, '--reference')
    const warn = cssVar(cv, '--warn')
    if (overlays.energy) {
      if (contours.energyRef) drawContour(ctx, contours.t, contours.energyRef, duration, innerW, H, warn, true, 1)
      if (contours.energyPart) drawContour(ctx, contours.t, contours.energyPart, duration, innerW, H, warn, false, 1.4)
    }
    if (overlays.pitch) {
      if (contours.pitchRef) drawContour(ctx, contours.t, contours.pitchRef, duration, innerW, H, ref, true, 1.5)
      if (contours.pitchPart) drawContour(ctx, contours.t, contours.pitchPart, duration, innerW, H, ink, false, 2)
    }
  }, [contours, overlays.pitch, overlays.energy, innerW, duration, themeTick])

  // Playhead follows the clock without React renders; keep it in view when zoomed.
  useEffect(() => {
    return clock.onTick((t) => {
      const x = (t / duration) * innerW
      if (headRef.current) headRef.current.style.transform = `translateX(${x}px)`
      const sc = scrollRef.current
      if (sc && zoom > 1 && clock.getState().playing) {
        if (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth - 40) sc.scrollLeft = x - 40
      }
    })
  }, [clock, duration, innerW, zoom])

  const seekFromEvent = (clientX: number) => {
    const rect = innerRef.current?.getBoundingClientRect()
    if (!rect) return
    clock.seek(((clientX - rect.left) / rect.width) * duration)
  }

  const pxPerSec = innerW / Math.max(duration, 0.1)
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => s * pxPerSec >= 64) ?? 600
  const ticks: number[] = []
  for (let i = 0; i * step <= duration + 1e-6; i++) ticks.push(i * step)

  const pct = (t: number) => `${(t / duration) * 100}%`

  // Stack marker labels that would collide onto extra rows.
  const markerRow = new Map<string, number>()
  const markerShift = new Map<string, number>()
  const rowEnds: number[] = []
  ;[...flaws]
    .sort((x, y) => x.start + x.end - (y.start + y.end))
    .forEach((f) => {
      const raw = ((f.start + f.end) / 2 / duration) * innerW
      const half = (flawMeta(f.type).marker.length * 6.5 + 14) / 2
      // Keep labels inside the waveform; the pin stays at the true time.
      const cx = Math.min(Math.max(raw, half), Math.max(half, innerW - half))
      markerShift.set(f.id, cx - raw)
      let row = rowEnds.findIndex((end) => cx - half > end + 4)
      if (row < 0) row = rowEnds.length
      rowEnds[row] = cx + half
      markerRow.set(f.id, row)
    })
  const rows = Math.max(1, rowEnds.length)
  const ROW_H = 18

  return (
    <div className="wave">
      <div className="wave-scroll" ref={scrollRef} style={{ overflowX: zoom > 1 ? 'auto' : 'hidden' }}>
        <div
          className="wave-inner"
          ref={innerRef}
          style={{ width: innerW || '100%', paddingTop: overlays.flaws ? 30 + (rows - 1) * ROW_H : 8 }}
        >
          <div
            className={`wave-canvas-wrap ${contours && (overlays.pitch || overlays.energy) ? 'has-overlay' : ''}`}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('.wave-marker')) return
              seekFromEvent(e.clientX)
            }}
          >
            {overlays.pauses &&
              pauses.map((p, i) => (
                <div key={i} className="wave-pause" style={{ left: pct(p.start), width: pct(p.end - p.start) }} />
              ))}
            {overlays.flaws &&
              flaws.map((f) => (
                <div
                  key={f.id}
                  className={`wave-region sev-${severityOf(f)} ${f.id === selectedId ? 'is-selected' : ''}`}
                  style={{ left: pct(f.start), width: `max(3px, ${pct(f.end - f.start)})` }}
                />
              ))}
            <canvas ref={waveRef} className="wave-canvas" style={{ width: innerW, height: H }} />
            <canvas ref={overlayRef} className="wave-canvas wave-overlay" style={{ width: innerW, height: H }} />
            <div ref={headRef} className="wave-head" aria-hidden="true" />
          </div>
          {overlays.flaws && (
            <div className="wave-markers" style={{ height: 30 + (rows - 1) * ROW_H }}>
              {flaws.map((f) => {
                const meta = flawMeta(f.type)
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`wave-marker sev-${severityOf(f)} ${f.id === selectedId ? 'is-selected' : ''}`}
                    style={
                      {
                        left: pct((f.start + f.end) / 2),
                        '--lift': `${(markerRow.get(f.id) ?? 0) * ROW_H}px`,
                        '--shift': `${markerShift.get(f.id) ?? 0}px`,
                      } as CSSProperties
                    }
                    onClick={() => onSelectFlaw(f)}
                    aria-label={`${meta.label} at ${fmtTime(f.start, true)}`}
                    aria-pressed={f.id === selectedId}
                  >
                    <span className="wave-marker-pin" />
                    <span className="wave-marker-label">{meta.marker}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="wave-axis" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t.toFixed(3)} style={{ left: pct(t) }}>
                {fmtTime(t, step < 1)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
