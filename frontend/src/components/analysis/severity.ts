import type { FlawRegion } from '../../lib/analysis/model'

/** Marker colour: amber for a deviation, red when it costs 5 points or more. */
export function severityOf(f: FlawRegion): 'warn' | 'bad' {
  return Math.abs(f.penalty) >= 5 ? 'bad' : 'warn'
}
