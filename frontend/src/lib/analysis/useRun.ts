import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { runAnalysis, type RunInput, type RunProgress } from './run'

export function useAnalysisRun() {
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctrl = useRef<AbortController | null>(null)
  const navigate = useNavigate()

  useEffect(() => () => ctrl.current?.abort(), [])

  const submit = useCallback(
    async (input: RunInput) => {
      ctrl.current?.abort()
      const c = new AbortController()
      ctrl.current = c
      setError(null)
      setProgress({
        stage: 'upload',
        states: { upload: 'active', server: 'pending', signals: 'pending', ready: 'pending' },
      })
      try {
        const a = await runAnalysis(input, (p) => !c.signal.aborted && setProgress(p), c.signal)
        if (!c.signal.aborted) navigate(`/analysis/${a.id}`)
      } catch (e) {
        if (c.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      }
    },
    [navigate],
  )

  const reset = useCallback(() => {
    ctrl.current?.abort()
    setProgress(null)
    setError(null)
  }, [])

  return { progress, error, running: Boolean(progress) && !error, submit, reset }
}
