import { ArrowRight, ArrowUpRight, Mic, PartyPopper, Swords, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import LineChart from '../../components/ui/LineChart'
import { EXAMPLE_ID } from '../../lib/analysis/example'
import { BUCKETS, modeLabel, type Analysis } from '../../lib/analysis/model'
import { useAnalyses } from '../../lib/analysis/store'
import { useBattles } from '../../lib/battles'
import { fmtDateTime, fmtSigned } from '../../lib/format'

const QUICK = [
  { to: '/practice', label: 'Start speech test', icon: Upload, sub: 'Read a passage against a reference' },
  { to: '/assessment/interviewer', label: 'Record practice', icon: Mic, sub: 'Answer an interview question' },
  { to: '/arena/battle', label: 'Enter battle', icon: Swords, sub: 'Same passage, two speakers' },
  { to: '/arena/mimic', label: 'Mimic Party', icon: PartyPopper, sub: 'Match the melody of a phrase' },
]

function streakDays(list: Analysis[]): number {
  const days = new Set(list.map((a) => new Date(a.createdAt).toDateString()))
  let n = 0
  const d = new Date()
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1)
  while (days.has(d.toDateString())) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

function Hero() {
  return (
    <section className="hero">
      <svg className="hero-wave" viewBox="0 0 800 80" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 160 }, (_, i) => {
          const h = 4 + Math.abs(Math.sin(i * 0.21) * Math.cos(i * 0.053)) * 60 + ((i * 37) % 7)
          return <rect key={i} x={i * 5} y={40 - h / 2} width="2" height={h} rx="1" />
        })}
      </svg>
      <h1 className="hero-title">
        Train how you speak.
        <br />
        Measure how you deliver.
      </h1>
      <p className="hero-sub">
        Speech Arena compares your delivery with a reference, word by word: pace, pauses, pitch and energy. Every
        deduction points to the exact moment it happened and says why.
      </p>
      <div className="row gap-8 wrap">
        <Link to="/practice" className="btn btn-primary btn-lg">
          Start practicing <ArrowRight size={15} />
        </Link>
        <Link to="/arena" className="btn btn-lg">
          Explore the Arena
        </Link>
        <Link to={`/analysis/${EXAMPLE_ID}`} className="btn btn-ghost btn-lg">
          See an example analysis <ArrowUpRight size={15} />
        </Link>
      </div>
    </section>
  )
}

function QuickActions() {
  return (
    <div className="quick">
      {QUICK.map((q) => {
        const Icon = q.icon
        return (
          <Link key={q.to} to={q.to} className="quick-item">
            <Icon size={18} strokeWidth={1.6} />
            <span className="stack">
              <span className="quick-label">{q.label}</span>
              <span className="t-small muted">{q.sub}</span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}

export default function Overview() {
  const analyses = useAnalyses()
  const battles = useBattles()

  if (!analyses.length) {
    return (
      <div className="stack gap-32">
        <Hero />
        <QuickActions />
      </div>
    )
  }

  const latest = analyses[0]
  const prev = analyses[1]
  const streak = streakDays(analyses)
  const delta = prev ? latest.score.total - prev.score.total : null
  const series = [...analyses].reverse().slice(-12)
  const worst = BUCKETS.map((b) => ({ ...b, share: Math.abs(latest.score.buckets[b.key]) / b.cap })).sort(
    (a, b) => b.share - a.share,
  )[0]
  const recommend =
    worst.share === 0
      ? { text: 'No deductions last time. Try a longer passage in Public speaking.', to: '/assessment/public-speaking' }
      : worst.key === 'pacing'
        ? { text: 'Pacing cost the most. The News anchor teleprompter holds a steady rate.', to: '/assessment/news-anchor' }
        : worst.key === 'pauses'
          ? { text: 'Pauses cost the most. Interviewer mode trains answers without long gaps.', to: '/assessment/interviewer' }
          : worst.key === 'pitch'
            ? { text: 'Pitch range cost the most. Storytelling rewards wider pitch movement.', to: '/assessment/storytelling' }
            : { text: 'Energy cost the most. Public speaking keeps volume up through sentence ends.', to: '/assessment/public-speaking' }

  return (
    <div className="stack gap-24">
      <header className="row between wrap gap-16">
        <div className="stack gap-4">
          <span className="t-label">Overview</span>
          <h1 className="t-display">Your delivery</h1>
        </div>
        <Link to="/practice" className="btn btn-primary">
          New attempt <ArrowRight size={14} />
        </Link>
      </header>

      <div className="grid-4">
        <div className="panel panel-pad stat">
          <span className="t-label">Current score</span>
          <span className="stat-value">
            {latest.score.total.toFixed(1)}
            <small>/100</small>
          </span>
          {delta != null &&
            (Math.abs(delta) < 0.05 ? (
              <span className="stat-delta muted">Same as previous</span>
            ) : (
              <span className={`stat-delta ${delta > 0 ? 'up' : 'down'}`}>{fmtSigned(delta, 1)} vs previous</span>
            ))}
        </div>
        <div className="panel panel-pad stat">
          <span className="t-label">Attempts</span>
          <span className="stat-value">{analyses.length}</span>
          <span className="t-small muted">saved in this browser</span>
        </div>
        <div className="panel panel-pad stat">
          <span className="t-label">Current streak</span>
          <span className="stat-value">
            {streak}
            <small>{streak === 1 ? 'day' : 'days'}</small>
          </span>
          <span className="t-small muted">days in a row with an attempt</span>
        </div>
        <div className="panel panel-pad stat">
          <span className="t-label">Battles</span>
          <span className="stat-value">{battles.length}</span>
          <span className="t-small muted">{battles.length ? `last: ${fmtDateTime(battles[0].createdAt)}` : 'none yet'}</span>
        </div>
      </div>

      <div className="overview-grid">
        <section className="panel">
          <div className="panel-head">
            <span className="t-section">Improvement trend</span>
            <span className="t-small muted">last {series.length} attempts</span>
          </div>
          <div className="panel-pad">
            <LineChart
              series={[{ label: 'Score', values: series.map((a) => Number(a.score.total.toFixed(1))), color: 'var(--participant)' }]}
              xLabels={series.map((_, i) => `#${analyses.length - series.length + i + 1}`)}
              yMin={0}
              yMax={100}
              height={200}
            />
          </div>
        </section>

        <section className="stack gap-16">
          <Link to={`/analysis/${latest.id}`} className="panel panel-pad latest-card">
            <span className="t-label">Latest analysis</span>
            <span className="t-section">{latest.title}</span>
            <span className="t-small muted">
              {modeLabel(latest.mode)} · {latest.flaws.length} flaws · {fmtDateTime(latest.createdAt)}
            </span>
            <span className="latest-open">
              Open <ArrowUpRight size={14} />
            </span>
          </Link>
          <Link to={recommend.to} className="panel panel-pad latest-card">
            <span className="t-label">Recommended practice</span>
            <span className="t-small">{recommend.text}</span>
            <span className="latest-open">
              Go <ArrowUpRight size={14} />
            </span>
          </Link>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <span className="t-section">Recent attempts</span>
            <Link to="/analysis" className="t-small muted">
              All
            </Link>
          </div>
          <ul className="list">
            {analyses.slice(0, 5).map((a) => (
              <li key={a.id}>
                <Link to={`/analysis/${a.id}`} className="list-row">
                  <span className="grow stack">
                    <span>{a.title}</span>
                    <span className="t-small muted">
                      {modeLabel(a.mode)} · {fmtDateTime(a.createdAt)}
                    </span>
                  </span>
                  <span className="mono num">{a.score.total.toFixed(1)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <div className="panel-head">
            <span className="t-section">Recent battles</span>
            <Link to="/arena/battle" className="t-small muted">
              Arena
            </Link>
          </div>
          {battles.length ? (
            <ul className="list">
              {battles.slice(0, 5).map((b) => (
                <li key={b.id} className="list-row">
                  <span className="grow">
                    {b.players[0].name} <span className="faint">vs</span> {b.players[1].name}
                  </span>
                  <span className="mono num t-small">
                    {b.players[0].score.toFixed(1)} – {b.players[1].score.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-pad t-small muted">No active battles.</p>
          )}
        </section>
      </div>

      <QuickActions />
    </div>
  )
}
