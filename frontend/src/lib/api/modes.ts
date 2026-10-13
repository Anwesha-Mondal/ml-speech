import { request } from './client'

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// ---------- interviewer ----------
export interface Industry {
  id: string
  name: string
  scope: string
  roles: string[]
  question_types: string[]
}

export interface InterviewQuestion {
  question_id: string
  kind: 'question' | 'probe'
  question: string
  question_type: string
  rubric_hints: string[]
  star_criteria: string
  trigger?: string
}

export interface StarCoverage {
  parts: Record<'situation' | 'task' | 'action' | 'result', { present: boolean; cues: string[] }>
  covered: number
  of: number
}

export interface InterviewFeedback {
  star: StarCoverage
  keywords_mentioned: string[]
  keywords_not_mentioned: string[]
  length_note: string | null
  exemplar: string
}

export interface InterviewStart {
  industry: string
  industry_name: string
  role: string
  seniority: string
  interviewer_name: string
  turn_index: number
  max_turns: number
  next: InterviewQuestion
}

export interface InterviewNext {
  feedback: InterviewFeedback
  finished: boolean
  turn_index: number
  next: InterviewQuestion | null
}

// ---------- news ----------
export interface NewsScriptSummary {
  script_id: string
  title: string
  category: string
  target_wpm: number
  estimated_duration_sec: number
}

export interface NewsScript extends NewsScriptSummary {
  text: string
  teleprompter_text: string
  phonetics: { word: string; say: string }[]
  breaking_alert: { trigger_at_second: number; flash_text: string }
}

export interface NewsConfig {
  default_wpm: number
  wpm_range: [number, number]
  target_wpm_band: [number, number]
  font_size_px: { default: number; min: number; max: number }
}

// ---------- public speaking ----------
export interface StageTier {
  tier: number
  name: string
  rt60_sec: number
  crowd_level: number
  distractions: { at_sec: number; kind: string }[]
}

export interface DebateStage {
  id: string
  label: string
  seconds: number
}

export interface PublicConfig {
  projection_target_db: number
  breathing: { inhale_sec: number; hold_sec: number; exhale_sec: number; cycles: number }
  stage_tiers: StageTier[]
  debate_formats: Record<string, { label: string; stages: DebateStage[] }>
}

export interface Motion {
  motion_id: string
  title: string
  motion: string
  format: string
}

export interface Spar {
  motion_id: string
  motion: string
  user_stance: 'affirmative' | 'negative'
  opponent_stance: string
  rebuttal_text: string
  cross_examination: string
  point_of_information: string
}

// ---------- storytelling ----------
export interface StorySummary {
  script_id: string
  title: string
  format: string
  genre: string
}

export interface StoryScript extends StorySummary {
  text: string
  script_text: string
  target_pitch_range_st: number
  target_climax_sec: number
  characters: { name: string; semitone_shift: number; description: string }[]
}

export interface ArcResult {
  phases: { id: string; label: string; start_sec: number; end_sec: number; mean_energy_db: number | null }[]
  checks: Record<string, boolean>
  arc_match: number
  of: number
}

export const modesApi = {
  interviewCatalog: () =>
    request<{ industries: Industry[]; seniorities: string[]; max_turns: number }>('/api/modes/interview/catalog'),
  interviewStart: (body: { industry: string; role: string; seniority: string; interview_type: string }) =>
    request<InterviewStart>('/api/modes/interview/start', json(body)),
  interviewNext: (body: {
    industry: string
    last_question_id: string
    transcript: string
    asked_ids: string[]
    turn_index: number
    duration_sec?: number
  }) => request<InterviewNext>('/api/modes/interview/next', json(body)),

  newsConfig: () => request<NewsConfig>('/api/modes/news/config'),
  newsScripts: () => request<{ scripts: NewsScriptSummary[] }>('/api/modes/news/scripts'),
  newsScript: (id: string) => request<NewsScript>(`/api/modes/news/scripts/${encodeURIComponent(id)}`),

  publicConfig: () => request<PublicConfig>('/api/modes/public/config'),
  motions: () => request<{ motions: Motion[] }>('/api/modes/public/motions'),
  spar: (motion_id: string, user_stance: 'affirmative' | 'negative') =>
    request<Spar>('/api/modes/public/spar', json({ motion_id, user_stance })),

  storyScripts: () => request<{ scripts: StorySummary[] }>('/api/modes/story/scripts'),
  storyScript: (id: string) => request<StoryScript>(`/api/modes/story/scripts/${encodeURIComponent(id)}`),
  storyArc: (job_id: string) => request<ArcResult>('/api/modes/story/arc', json({ job_id })),
}

/** Teleprompter cue tags ([PAUSE 0.4s], [VOICE: Name], [CLIMAX]) split out of a script for display. */
export type ScriptSegment = { kind: 'text'; text: string; voice: string | null } | { kind: 'pause'; seconds: number } | { kind: 'climax' }

export function parseScript(script: string): ScriptSegment[] {
  const out: ScriptSegment[] = []
  let voice: string | null = null
  for (const part of script.split(/(\[[^\]]+\])/)) {
    if (!part.trim()) continue
    const pause = /^\[PAUSE ([\d.]+)s\]$/.exec(part)
    const v = /^\[VOICE: ([^\]]+)\]$/.exec(part)
    if (pause) out.push({ kind: 'pause', seconds: Number(pause[1]) })
    else if (v) voice = v[1]
    else if (part === '[CLIMAX]') out.push({ kind: 'climax' })
    else if (/^\[[A-Z]+\]$/.test(part)) continue
    else {
      out.push({ kind: 'text', text: part, voice })
      // A character's line ends at its closing quote; the narrator resumes after it.
      if (voice && /'\s*$/.test(part.trim())) voice = null
    }
  }
  return out
}
