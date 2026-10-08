import { useId } from 'react'

export interface Series {
  values: number[]
  label: string
  /** CSS colour, normally a token like var(--participant). */
  color: string
  dashed?: boolean
}

/**
 * Small SVG line chart: one shared y scale, labelled ticks, an emphasised last point.
 * Used for score trends and comparisons. Not for time-series audio data.
 */
export default function LineChart({
  series,
  xLabels,
  yMin,
  yMax,
  height = 180,
  yTicks = 4,
  unit = '',
}: {
  series: Series[]
  xLabels: string[]
  yMin: number
  yMax: number
  height?: number
  yTicks?: number
  unit?: string
}) {
  const id = useId()
  const W = 560
  const H = height
  const pad = { l: 36, r: 16, t: 12, b: 26 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const n = Math.max(xLabels.length, 1)
  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => pad.t + ih - ((v - yMin) / (yMax - yMin || 1)) * ih
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="linechart" role="img" aria-labelledby={`${id}-t`}>
      <title id={`${id}-t`}>{series.map((s) => `${s.label}: ${s.values.join(', ')}${unit}`).join('; ')}</title>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="lc-grid" />
          <text x={pad.l - 8} y={y(t)} className="lc-tick" textAnchor="end" dominantBaseline="middle">
            {Math.round(t)}
          </text>
        </g>
      ))}
      {xLabels.map((l, i) => (
        <text key={`${l}-${i}`} x={x(i)} y={H - 6} className="lc-tick" textAnchor="middle">
          {l}
        </text>
      ))}
      {series.map((s) => {
        const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
        const last = s.values.length - 1
        return (
          <g key={s.label}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="1.75" strokeDasharray={s.dashed ? '4 4' : undefined} />
            {s.values.map((v, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(v)}
                r={i === last ? 3.5 : 2}
                fill={i === last ? s.color : 'var(--surface)'}
                stroke={s.color}
                strokeWidth="1.5"
              />
            ))}
          </g>
        )
      })}
    </svg>
  )
}
