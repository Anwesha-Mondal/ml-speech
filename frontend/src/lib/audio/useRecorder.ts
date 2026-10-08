import { useCallback, useEffect, useRef, useState } from 'react'

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return undefined
}

/** Microphone recording with the browser's MediaRecorder. Produces a File when stopped. */
export function useRecorder(onRecorded: (file: File) => void) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState(0)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const ctxRef = useRef<AudioContext | null>(null)
  const onRecordedRef = useRef(onRecorded)
  useEffect(() => {
    onRecordedRef.current = onRecorded
  }, [onRecorded])

  useEffect(() => {
    if (!recording) return
    const started = Date.now()
    const id = setInterval(() => setElapsed((Date.now() - started) / 1000), 200)
    return () => clearInterval(id)
  }, [recording])

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void ctxRef.current?.close()
    ctxRef.current = null
    setLevel(0)
  }, [])

  useEffect(() => cleanup, [cleanup])

  const start = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser cannot record audio. Upload a file instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm'
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        const blob = new Blob(chunks.current, { type })
        const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '')
        onRecordedRef.current(new File([blob], `recording-${stamp}.${ext}`, { type }))
        cleanup()
      }
      // Input level meter.
      const ctx = new AudioContext()
      ctxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Float32Array(analyser.fftSize)
      const tick = () => {
        analyser.getFloatTimeDomainData(buf)
        let s = 0
        for (const v of buf) s += v * v
        setLevel(Math.min(1, Math.sqrt(s / buf.length) * 6))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()

      rec.start()
      recRef.current = rec
      setElapsed(0)
      setRecording(true)
    } catch (e) {
      cleanup()
      const name = e instanceof DOMException ? e.name : ''
      setError(
        name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in the browser’s site settings, or upload a file.'
          : name === 'NotFoundError'
            ? 'No microphone was found. Connect one, or upload a file.'
            : 'The microphone could not start. Upload a file instead.',
      )
    }
  }, [cleanup])

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
    recRef.current = null
    setRecording(false)
  }, [])

  return { recording, elapsed, error, level, start, stop }
}
