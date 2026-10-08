import { useEffect, useMemo, useRef } from 'react'
import type { FlawRegion, Word } from '../../lib/analysis/model'
import type { PlaybackClock } from '../../lib/audio/playback'
import { severityOf } from './severity'

function findWord(words: Word[], t: number): number {
  let lo = 0
  let hi = words.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (words[mid].start <= t) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  if (ans >= 0 && t > words[ans].end + 0.15) return -1
  return ans
}

export default function Transcript({
  words,
  clock,
  flaws,
  selected,
  onSelectFlaw,
}: {
  words: Word[]
  clock: PlaybackClock
  flaws: FlawRegion[]
  selected: FlawRegion | null
  onSelectFlaw: (f: FlawRegion) => void
}) {
  const spans = useRef<(HTMLSpanElement | null)[]>([])
  const activeRef = useRef(-1)

  const flawOf = useMemo(
    () =>
      words.map((w) => {
        const mid = (w.start + w.end) / 2
        return flaws.find((f) => mid >= f.start - 0.05 && mid <= f.end + 0.05) ?? null
      }),
    [words, flaws],
  )

  useEffect(() => {
    return clock.onTick((t) => {
      const i = findWord(words, t)
      if (i === activeRef.current) return
      spans.current[activeRef.current]?.classList.remove('is-active')
      if (i >= 0) spans.current[i]?.classList.add('is-active')
      activeRef.current = i
    })
  }, [clock, words])

  return (
    <p className="transcript">
      {words.map((w, i) => {
        const f = flawOf[i]
        const inSel = selected && f?.id === selected.id
        return (
          <span key={i}>
            <span
              ref={(el) => {
                spans.current[i] = el
              }}
              role="button"
              tabIndex={0}
              className={`tw ${f ? `has-flaw sev-${severityOf(f)}` : ''} ${inSel ? 'in-selected' : ''}`}
              onClick={() => {
                clock.seek(w.start)
                if (f && f.id !== selected?.id) onSelectFlaw(f)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  clock.seek(w.start)
                }
              }}
              title={`${w.start.toFixed(2)}s`}
            >
              {w.text}
            </span>{' '}
          </span>
        )
      })}
    </p>
  )
}
