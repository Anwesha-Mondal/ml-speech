import { ArrowRight, Check, CircleAlert, Loader2, Minus, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AudioInput from '../../../components/recording/AudioInput'
import ProcessingSteps from '../../../components/recording/ProcessingSteps'
import { useInlineRun } from '../../../lib/analysis/useInlineRun'
import { transcribeAudio } from '../../../lib/api/client'
import {
  modesApi,
  type Industry,
  type InterviewFeedback,
  type InterviewQuestion,
  type InterviewStart,
  type StarCoverage,
} from '../../../lib/api/modes'

interface Turn {
  question: InterviewQuestion
  transcript: string
  score: number
  analysisId: string
  feedback: InterviewFeedback
}

const STAR_LABELS: Record<keyof StarCoverage['parts'], string> = {
  situation: 'Situation',
  task: 'Task',
  action: 'Action',
  result: 'Result',
}

function StarChecklist({ star }: { star: StarCoverage | null }) {
  return (
    <ul className="star-list">
      {(Object.keys(STAR_LABELS) as (keyof StarCoverage['parts'])[]).map((k) => {
        const p = star?.parts[k]
        return (
          <li key={k} className={p?.present ? 'is-on' : ''}>
            {p?.present ? <Check size={14} /> : <Minus size={14} />}
            <span>{STAR_LABELS[k]}</span>
            {p?.present && <span className="t-small muted">“{p.cues[0]}”</span>}
          </li>
        )
      })}
    </ul>
  )
}

export default function InterviewWorkspace() {
  const [industries, setIndustries] = useState<Industry[]>([])
  const [seniorities, setSeniorities] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [industry, setIndustry] = useState('software_engineering')
  const [role, setRole] = useState('')
  const [seniority, setSeniority] = useState('mid')
  const [qType, setQType] = useState('')

  const [session, setSession] = useState<InterviewStart | null>(null)
  const [question, setQuestion] = useState<InterviewQuestion | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [finished, setFinished] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [transcript, setTranscript] = useState('')
  const [step, setStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inline = useInlineRun()

  useEffect(() => {
    modesApi
      .interviewCatalog()
      .then((c) => {
        setIndustries(c.industries)
        setSeniorities(c.seniorities)
      })
      .catch((e: Error) => setLoadError(e.message))
  }, [])

  const current = useMemo(() => industries.find((i) => i.id === industry), [industries, industry])

  const start = async () => {
    setError(null)
    try {
      const s = await modesApi.interviewStart({ industry, role, seniority, interview_type: qType })
      setSession(s)
      setQuestion(s.next)
      setTurns([])
      setFinished(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const submit = async () => {
    if (!session || !question || !file) return
    setError(null)
    try {
      let text = transcript.trim()
      if (!text) {
        setStep('Transcribing your answer…')
        const t = await transcribeAudio(file)
        if (t.error) throw new Error(t.error)
        text = t.transcript
        setTranscript(text)
      }
      setStep(null)
      const a = await inline.run({
        participant: file,
        transcript: text,
        mode: 'interviewer',
        title: `Interview · ${session.industry_name}`,
        referenceLabel: 'none',
      })
      if (!a) return
      setStep('Preparing the next question…')
      const next = await modesApi.interviewNext({
        industry: session.industry,
        last_question_id: question.question_id,
        transcript: text,
        asked_ids: [...turns.map((t) => t.question.question_id), question.question_id],
        turn_index: turns.length + 1,
        duration_sec: a.duration || undefined,
      })
      setTurns((prev) => [...prev, { question, transcript: text, score: a.score.total, analysisId: a.id, feedback: next.feedback }])
      setFile(null)
      setTranscript('')
      if (next.finished || !next.next) setFinished(true)
      else setQuestion(next.next)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setStep(null)
    }
  }

  const last = turns.at(-1)
  const average = turns.length ? turns.reduce((s, t) => s + t.score, 0) / turns.length : 0

  if (!session) {
    return (
      <div className="mode-grid">
        <div className="panel panel-pad stack gap-16">
          <div className="stack gap-4">
            <span className="t-section">Set up your interview</span>
            <span className="t-small muted">
              Questions come from a bank of {industries.length || 'many'} industries. Follow-ups are triggered by what
              you say.
            </span>
          </div>
          {loadError && (
            <p className="notice notice-bad">
              <CircleAlert size={15} />
              <span>{loadError}</span>
            </p>
          )}
          <div className="grid-2">
            <label className="field">
              <span>Industry</span>
              <select
                id="iv-industry"
                className="select"
                value={industry}
                onChange={(e) => {
                  setIndustry(e.target.value)
                  setRole('')
                  setQType('')
                }}
              >
                {industries.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Role</span>
              <select id="iv-role" className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Any role</option>
                {current?.roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Seniority</span>
              <select id="iv-seniority" className="select" value={seniority} onChange={(e) => setSeniority(e.target.value)}>
                {seniorities.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>First question type</span>
              <select id="iv-type" className="select" value={qType} onChange={(e) => setQType(e.target.value)}>
                <option value="">Start with the first</option>
                {current?.question_types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          {current && <p className="t-small muted">{current.scope}</p>}
          {error && (
            <p className="notice notice-bad">
              <CircleAlert size={15} />
              <span>{error}</span>
            </p>
          )}
          <div>
            <button type="button" className="btn btn-primary btn-lg" onClick={start} disabled={!industries.length}>
              Start interview <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <div className="focus">
          <span className="t-label">Measured with extra weight</span>
          <ul>
            <li>Hesitation and long pauses</li>
            <li>Filled pauses (“um”, “uh”)</li>
            <li>Rising pitch at the end of statements</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="mode-grid">
      <div className="panel panel-pad stack gap-16">
        {finished ? (
          <div className="stack gap-12">
            <span className="t-section">Interview complete</span>
            <p className="t-small muted">
              {turns.length} answers · average delivery score <span className="mono num">{average.toFixed(1)}</span>
            </p>
            <div>
              <button type="button" className="btn" onClick={() => setSession(null)}>
                <RotateCcw size={14} /> New interview
              </button>
            </div>
          </div>
        ) : inline.progress ? (
          <div className="stack gap-12">
            <span className="t-section">Scoring your answer</span>
            <ProcessingSteps progress={inline.progress} />
          </div>
        ) : (
          question && (
            <>
              <div className="question-card">
                <div className="row between wrap gap-8">
                  <span className="t-label">
                    {session.interviewer_name} · Turn {turns.length + 1} of {session.max_turns}
                  </span>
                  <span className="badge">{question.kind === 'probe' ? `Follow-up on “${question.trigger}”` : question.question_type}</span>
                </div>
                <p className="question-text">{question.question}</p>
                {question.rubric_hints.length > 0 && (
                  <p className="t-small muted">Strong answers often mention: {question.rubric_hints.join(', ')}</p>
                )}
              </div>
              <AudioInput id="iv-answer" file={file} onFile={setFile} label="Your answer" />
              <label className="field">
                <span>Answer as text (optional)</span>
                <textarea
                  id="iv-transcript"
                  className="textarea"
                  rows={3}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Leave empty to transcribe the recording automatically."
                />
              </label>
              {(error || inline.error) && (
                <p className="notice notice-bad">
                  <CircleAlert size={15} />
                  <span>{error || inline.error}</span>
                </p>
              )}
              <div className="row gap-12 wrap">
                <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={!file || Boolean(step)}>
                  {step ? <Loader2 size={15} className="spin" /> : null}
                  {step ?? 'Submit answer'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setFinished(true)} disabled={!turns.length}>
                  End interview
                </button>
              </div>
            </>
          )
        )}
      </div>

      <aside className="stack gap-16">
        <div className="panel panel-pad stack gap-8">
          <span className="t-section">STAR structure, last answer</span>
          <StarChecklist star={last?.feedback.star ?? null} />
          {last && (
            <>
              {last.feedback.keywords_mentioned.length > 0 && (
                <p className="t-small">Mentioned: {last.feedback.keywords_mentioned.join(', ')}</p>
              )}
              {last.feedback.length_note && <p className="t-small muted">{last.feedback.length_note}</p>}
              <details className="t-small">
                <summary>What a strong answer covers</summary>
                <p className="muted">{last.feedback.exemplar}</p>
              </details>
            </>
          )}
        </div>
        <div className="panel panel-pad stack gap-8">
          <span className="t-section">Turns</span>
          {turns.length === 0 && <span className="t-small muted">Your answers appear here.</span>}
          {turns.map((t, i) => (
            <div key={t.question.question_id} className="turn-row">
              <span className="t-small">
                {i + 1}. {t.question.kind === 'probe' ? 'Follow-up' : t.question.question_type}
              </span>
              <span className="row gap-8">
                <span className="mono num">{t.score.toFixed(1)}</span>
                <Link to={`/analysis/${t.analysisId}`} className="t-small">
                  Details
                </Link>
              </span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
