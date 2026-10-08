/** Compact SVG waveform from normalised peaks. Optional mirroring for the battle split view. */
export default function MiniWave({
  peaks,
  color = 'var(--participant)',
  flip = false,
  height = 56,
  label,
}: {
  peaks: number[]
  color?: string
  flip?: boolean
  height?: number
  label: string
}) {
  const cols = 160
  const W = cols * 3
  const bars = Array.from({ length: cols }, (_, c) => {
    const from = Math.floor((c / cols) * peaks.length)
    const to = Math.max(from + 1, Math.floor(((c + 1) / cols) * peaks.length))
    let p = 0
    for (let i = from; i < to && i < peaks.length; i++) p = Math.max(p, peaks[i])
    return p
  })
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="miniwave" preserveAspectRatio="none" role="img" aria-label={label}>
      {bars.map((p, i) => {
        const h = Math.max(1, p * (height - 2))
        return <rect key={i} x={i * 3} y={flip ? 0 : height - h} width={2} height={h} fill={color} rx={0.5} />
      })}
    </svg>
  )
}
