import { useCallback, useEffect, useRef, useState } from 'react'
import type { Analysis } from './model'
import { runAnalysis, type RunInput, type RunProgress } from './run'

/**
 * Like useAnalysisRun, but stays on the page: multi-turn workspaces (interviewer, storyteller)
 * show the result inline and link to the full analysis instead of navigating away.
 */
export function useInlineRun() {
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => () => ctrl.current?.abort(), [])

  const run = useCallback(async (input: RunInput): Promise<Analysis | null> => {
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setError(null)
    setProgress({ stage: 'upload', states: { upload: 'active', server: 'pending', signals: 'pending', ready: 'pending' } })
    try {
      const a = await runAnalysis(input, (p) => !c.signal.aborted && setProgress(p), c.signal)
      if (c.signal.aborted) return null
      setProgress(null)
      return a
    } catch (e) {
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Something went wrong.')
      return null
    }
  }, [])

  const reset = useCallback(() => {
    ctrl.current?.abort()
    setProgress(null)
    setError(null)
  }, [])

  return { progress, error, busy: Boolean(progress) && !error, run, reset }
}
