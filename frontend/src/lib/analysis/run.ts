import { getJob, startAnalysis } from '../api/client'
import type { Mode } from '../api/types'
import { computeContours, computePeaks, decodeFile, encodeWav, type DecodedAudio } from '../audio/analyze'
import { uid } from '../format'
import { analysisFromApi, type Analysis } from './model'
import { saveAnalysis } from './store'

export type StageKey = 'upload' | 'server' | 'signals' | 'ready'
export type StageState = 'pending' | 'active' | 'done' | 'error'

export interface RunInput {
  participant: File
  reference?: File | null
  transcript: string
  mode: Mode
  title: string
  referenceLabel: string
}

export interface RunProgress {
  stage: StageKey
  states: Record<StageKey, StageState>
  jobId?: string
  serverSeconds?: number
  note?: string
}

const POLL_MS = 1000
const TIMEOUT_MS = 180_000

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(id)
      reject(new DOMException('Cancelled', 'AbortError'))
    })
  })

/**
 * Upload → server pipeline (polled) → browser-side waveform/contours → saved analysis.
 * The server reports a single "processing" state for all of its stages, so the UI
 * shows them as one step rather than inventing per-stage progress.
 */
export async function runAnalysis(
  input: RunInput,
  onProgress: (p: RunProgress) => void,
  signal?: AbortSignal,
  options: { save?: boolean } = {},
): Promise<Analysis> {
  const save = options.save ?? true
  const states: Record<StageKey, StageState> = { upload: 'active', server: 'pending', signals: 'pending', ready: 'pending' }
  const emit = (stage: StageKey, extra: Partial<RunProgress> = {}) => onProgress({ stage, states: { ...states }, ...extra })
  emit('upload')

  // Decode audio in the browser while the server works.
  const decodeP: Promise<{ part: DecodedAudio | null; ref: DecodedAudio | null }> = Promise.all([
    decodeFile(input.participant).catch(() => null),
    input.reference ? decodeFile(input.reference).catch(() => null) : Promise.resolve(null),
  ]).then(([part, ref]) => ({ part, ref }))

  let job
  try {
    job = await startAnalysis(input)
  } catch (e) {
    states.upload = 'error'
    emit('upload')
    throw e
  }
  states.upload = 'done'
  states.server = 'active'
  emit('server', { jobId: job.job_id, serverSeconds: 0 })

  const started = Date.now()
  let result = job.result
  while (!result) {
    await sleep(POLL_MS, signal)
    const elapsed = (Date.now() - started) / 1000
    if (Date.now() - started > TIMEOUT_MS) {
      states.server = 'error'
      emit('server', { jobId: job.job_id, serverSeconds: elapsed })
      throw new Error('The server did not finish within 3 minutes. Check the backend logs and try again.')
    }
    let status
    try {
      status = await getJob(job.job_id)
    } catch {
      emit('server', { jobId: job.job_id, serverSeconds: elapsed, note: 'Lost contact with the API. Retrying…' })
      continue
    }
    if (status.status === 'completed' && status.result) {
      result = status.result
    } else if (status.status === 'error') {
      states.server = 'error'
      emit('server', { jobId: job.job_id, serverSeconds: elapsed })
      throw new Error(status.message ? `The pipeline failed: ${status.message}` : 'The pipeline failed.')
    } else if (status.status === 'not_found') {
      states.server = 'error'
      emit('server', { jobId: job.job_id, serverSeconds: elapsed })
      throw new Error('The API lost this job, probably because the backend restarted. Submit the recording again.')
    } else {
      emit('server', { jobId: job.job_id, serverSeconds: elapsed })
    }
  }
  const serverSeconds = (Date.now() - started) / 1000
  states.server = 'done'
  states.signals = 'active'
  emit('signals', { jobId: job.job_id, serverSeconds })

  const { part, ref } = await decodeP
  const analysis = analysisFromApi({
    id: uid('a_'),
    jobId: job.job_id,
    result,
    mode: input.mode,
    title: input.title,
    referenceLabel: input.referenceLabel,
    transcript: input.transcript,
    duration: part?.duration ?? 0,
    participantFile: input.participant.name,
  })
  analysis.serverSeconds = serverSeconds
  analysis.audio = {
    participantUrl: URL.createObjectURL(input.participant),
    referenceUrl: input.reference ? URL.createObjectURL(input.reference) : undefined,
  }
  if (part) {
    analysis.peaks = { participant: computePeaks(part) }
    try {
      analysis.contours = await computeContours(part)
    } catch {
      /* contours are optional */
    }
  }
  if (ref && analysis.peaks) {
    analysis.peaks.reference = computePeaks(ref)
    analysis.referenceDuration = ref.duration
  }
  states.signals = 'done'
  states.ready = 'done'
  emit('ready', { jobId: job.job_id, serverSeconds })
  if (save) saveAnalysis(analysis)
  return analysis
}
