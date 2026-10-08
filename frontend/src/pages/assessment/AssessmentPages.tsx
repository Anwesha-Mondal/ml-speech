import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import AttemptForm from '../../components/recording/AttemptForm'
import PageHeader from '../../components/ui/PageHeader'
import Teleprompter from './Teleprompter'

export function AssessmentLayout() {
  return (
    <>
      <PageHeader
        title="Assessment"
        description="Situation-specific practice. Each mode changes which parts of delivery the analysis focuses on."
        tabs={[
          { to: '/assessment/interviewer', label: 'Interviewer' },
          { to: '/assessment/news-anchor', label: 'News anchor' },
          { to: '/assessment/public-speaking', label: 'Public speaking' },
          { to: '/assessment/storytelling', label: 'Storytelling' },
        ]}
      />
      <Outlet />
    </>
  )
}

function Focus({ items }: { items: string[] }) {
  return (
    <div className="focus">
      <span className="t-label">Measured with extra weight</span>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  )
}

const QUESTIONS = [
  'Tell me about a project where the plan changed halfway through. What did you do?',
  'Describe a time you had to explain something technical to a non-technical audience.',
  'What is a decision you made with incomplete information, and how did it turn out?',
  'Walk me through how you prepare for an important presentation.',
  'Tell me about a disagreement with a teammate and how it was resolved.',
]

export function Interviewer() {
  const [q, setQ] = useState(0)
  return (
    <div className="mode-grid">
      <div className="panel panel-pad">
        <AttemptForm
          mode="interviewer"
          showReferencePicker={false}
          initialTranscript=""
          transcriptLabel="Your answer as text"
          transcriptHelp="Optional. Interview answers are improvised, so there is usually no script."
          stage={() => (
            <div className="question-card">
              <div className="row between">
                <span className="t-label">
                  Question {q + 1} of {QUESTIONS.length}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQ((q + 1) % QUESTIONS.length)}>
                  <RefreshCw size={13} /> Next question
                </button>
              </div>
              <p className="question-text">{QUESTIONS[q]}</p>
              <p className="t-small muted">Aim for 60–90 seconds. The timer shows while you record.</p>
            </div>
          )}
          submitLabel="Analyze answer"
        />
      </div>
      <Focus items={['Hesitation and long pauses', 'Pacing', 'Clarity and energy at sentence ends']} />
    </div>
  )
}

export function NewsAnchor() {
  return (
    <div className="mode-grid">
      <div className="panel panel-pad">
        <AttemptForm
          mode="news_anchor"
          transcriptLabel="Script"
          transcriptHelp="The teleprompter reads from this script. It is also the transcript for word timing."
          stage={(text) => <Teleprompter text={text} />}
          submitLabel="Analyze broadcast"
        />
      </div>
      <Focus items={['Steady pacing', 'Articulation', 'No rising terminals (up-talk)']} />
    </div>
  )
}

export function PublicSpeaking() {
  return (
    <div className="mode-grid">
      <div className="panel panel-pad">
        <AttemptForm mode="public_speaking" submitLabel="Analyze speech" />
      </div>
      <Focus items={['Pacing over long passages', 'Energy', 'Pitch variation', 'Pause placement']} />
    </div>
  )
}

const STORY_PROMPT =
  'Tell a two-minute story about a moment that changed your mind. Build to one key line, and slow down for it.'

export function Storytelling() {
  return (
    <div className="mode-grid">
      <div className="panel panel-pad">
        <AttemptForm
          mode="storytelling"
          defaultReference="custom"
          stage={() => (
            <div className="question-card">
              <span className="t-label">Prompt</span>
              <p className="question-text">{STORY_PROMPT}</p>
            </div>
          )}
          submitLabel="Analyze story"
        />
      </div>
      <Focus items={['Dynamic range in pitch', 'Dynamic range in energy', 'Pauses before key lines']} />
    </div>
  )
}
