// Shapes returned by the FastAPI backend in backend/api/routers/*.py.
// Optional fields are ones the frontend can use when present but must not depend on.

export type Mode = 'sandbox' | 'interviewer' | 'news_anchor' | 'storytelling' | 'public_speaking'

export type Bucket = 'pacing' | 'pitch' | 'pauses' | 'energy_clarity'

export interface ApiFlaw {
  type: string
  start_time: number
  end_time: number
  penalty: number
  explanation: string
  flaw_id?: string
  bucket?: Bucket
  confidence?: number
  word?: string
  evidence?: {
    metric: string
    reference_value: number
    participant_value: number
    delta_abs: number
    delta_rel: number
  }
}

export interface ApiAnalysisResult {
  mode: string
  score: { total: number; buckets: Partial<Record<Bucket, number>> }
  flaws: ApiFlaw[]
}

export interface ApiJob {
  job_id: string
  status: 'processing' | 'completed' | 'error' | 'not_found'
  result?: ApiAnalysisResult
  message?: string
}

export interface ApiHistory {
  user_id: string
  prompt_id: string
  history: { attempt: number; date: string; score: number; flaw_density: number }[]
  insights: string[]
}

export interface ApiBattlePlayer {
  user_id: string
  score: number
  metrics: { pacing_accuracy: number; pitch_stability: number; energy_control: number }
}

export interface ApiBattle {
  battle_id: string
  prompt_id: string
  winner: string
  players: ApiBattlePlayer[]
  insights: string[]
}

export interface ApiMimic {
  job_id: string
  reference_id: string
  score: number
  metrics: { melody_match: number; cadence_sync: number; emphasis_timing: number }
  highlights: string[]
  feedback: string
}

export interface ApiLeaderboard {
  prompt_id: string
  version: string
  last_updated: string
  rankings: { rank: number; user_id: string; score: number; flaw_density: number; mode: string }[]
}
