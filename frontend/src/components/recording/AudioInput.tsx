import { FileAudio, Mic, Square, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useRecorder } from '../../lib/audio/useRecorder'
import { fmtTime } from '../../lib/format'

const MAX_MB = 50

export default function AudioInput({
  file,
  onFile,
  label = 'Your recording',
  allowRecord = true,
  disabled = false,
  id,
}: {
  file: File | null
  onFile: (f: File | null) => void
  label?: string
  allowRecord?: boolean
  disabled?: boolean
  id: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const rec = useRecorder((f) => onFile(f))

  const accept = (f: File | undefined) => {
    setErr(null)
    if (!f) return
    if (!f.type.startsWith('audio/') && !/\.(wav|mp3|m4a|flac|ogg|webm|aac)$/i.test(f.name)) {
      setErr('That file isn’t audio. Use WAV, MP3, M4A, FLAC, OGG or WebM.')
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setErr(`That file is over ${MAX_MB} MB. Trim it or export at a lower bitrate.`)
      return
    }
    onFile(f)
  }

  const error = err ?? rec.error

  return (
    <div className="field">
      <span>{label}</span>
      <div
        className={`dropzone ${over ? 'is-over' : ''} ${file ? 'has-file' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (!disabled) accept(e.dataTransfer.files[0])
        }}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.webm"
          hidden
          onChange={(e) => {
            accept(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {rec.recording ? (
          <>
            <span className="rec-dot" aria-hidden="true" />
            <div className="grow stack gap-4">
              <span className="t-section">Recording</span>
              <span className="mono t-small muted num">{fmtTime(rec.elapsed)}</span>
            </div>
            <div className="level-meter" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => (
                <i key={i} style={{ height: `${Math.max(12, Math.min(100, rec.level * 100 * (0.6 + ((i * 7) % 5) / 6)))}%` }} />
              ))}
            </div>
            <button type="button" className="btn btn-danger" onClick={rec.stop}>
              <Square size={13} fill="currentColor" /> Stop
            </button>
          </>
        ) : file ? (
          <>
            <FileAudio size={20} strokeWidth={1.6} />
            <div className="grow stack">
              <span className="t-section" style={{ overflowWrap: 'anywhere' }}>
                {file.name}
              </span>
              <span className="t-small muted">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => onFile(null)}
              disabled={disabled}
              aria-label="Remove recording"
            >
              <X size={15} />
            </button>
          </>
        ) : (
          <>
            <div className="grow stack gap-4">
              <span className="t-section">Drop an audio file here</span>
              <span className="t-small muted">WAV, MP3, M4A, FLAC, OGG or WebM, up to {MAX_MB} MB</span>
            </div>
            <div className="row gap-8 wrap">
              <button type="button" className="btn" onClick={() => inputRef.current?.click()} disabled={disabled}>
                <Upload size={14} /> Upload
              </button>
              {allowRecord && (
                <button type="button" className="btn btn-primary" onClick={() => void rec.start()} disabled={disabled}>
                  <Mic size={14} /> Record
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {error && <p className="t-small" style={{ color: 'var(--bad)' }}>{error}</p>}
    </div>
  )
}
