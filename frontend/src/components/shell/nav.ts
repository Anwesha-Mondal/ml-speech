import {
  AudioWaveform,
  ClipboardCheck,
  Database,
  LayoutGrid,
  Mic,
  Server,
  Settings,
  Swords,
  Trophy,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Extra search words for the quick-jump box. */
  keywords?: string
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Main',
    items: [
      { to: '/', label: 'Overview', icon: LayoutGrid, keywords: 'home dashboard' },
      { to: '/practice', label: 'Practice', icon: Mic, keywords: 'speech test record upload you vs you progress' },
      {
        to: '/assessment',
        label: 'Assessment',
        icon: ClipboardCheck,
        keywords: 'interviewer news anchor teleprompter public speaking storytelling',
      },
      { to: '/arena', label: 'Arena', icon: Swords, keywords: 'battle 1v1 debate mimic party' },
      { to: '/leaderboard', label: 'Leaderboard', icon: Trophy, keywords: 'ranking elo' },
    ],
  },
  {
    label: 'Data',
    items: [
      { to: '/analysis', label: 'Analysis', icon: AudioWaveform, keywords: 'results waveform flaws' },
      { to: '/dataset', label: 'Dataset', icon: Database, keywords: 'variants references rights severity' },
      { to: '/pipeline', label: 'Pipeline', icon: Workflow, keywords: 'stages alignment features jobs' },
    ],
  },
  {
    label: 'System',
    items: [{ to: '/system', label: 'System', icon: Server, keywords: 'api health infrastructure devops' }],
  },
]

export const SETTINGS_ITEM: NavItem = { to: '/settings', label: 'Settings', icon: Settings, keywords: 'theme audio privacy' }

/** Sub-pages reachable from the quick-jump box. */
export const JUMP_TARGETS: { to: string; label: string; section: string }[] = [
  { to: '/', label: 'Overview', section: 'Main' },
  { to: '/practice', label: 'Speech test', section: 'Practice' },
  { to: '/practice/progress', label: 'You vs You', section: 'Practice' },
  { to: '/assessment/interviewer', label: 'Interviewer', section: 'Assessment' },
  { to: '/assessment/news-anchor', label: 'News anchor', section: 'Assessment' },
  { to: '/assessment/public-speaking', label: 'Public speaking', section: 'Assessment' },
  { to: '/assessment/storytelling', label: 'Storytelling', section: 'Assessment' },
  { to: '/arena/battle', label: '1v1 Battle', section: 'Arena' },
  { to: '/arena/debate', label: 'Debate', section: 'Arena' },
  { to: '/arena/mimic', label: 'Mimic Party', section: 'Arena' },
  { to: '/leaderboard', label: 'Leaderboard', section: 'Main' },
  { to: '/analysis', label: 'All analyses', section: 'Analysis' },
  { to: '/analysis/example-gettysburg', label: 'Example analysis: Gettysburg', section: 'Analysis' },
  { to: '/dataset', label: 'Dataset overview', section: 'Dataset' },
  { to: '/dataset/references', label: 'References', section: 'Dataset' },
  { to: '/dataset/variants', label: 'Variants', section: 'Dataset' },
  { to: '/dataset/flaws', label: 'Flaw taxonomy', section: 'Dataset' },
  { to: '/dataset/severity', label: 'Severity', section: 'Dataset' },
  { to: '/dataset/rights', label: 'Rights & provenance', section: 'Dataset' },
  { to: '/pipeline', label: 'Pipeline', section: 'Data' },
  { to: '/system', label: 'API & services', section: 'System' },
  { to: '/system/architecture', label: 'Architecture', section: 'System' },
  { to: '/system/scoring', label: 'Scoring', section: 'System' },
  { to: '/system/devops', label: 'DevOps', section: 'System' },
  { to: '/settings', label: 'Settings', section: 'Settings' },
]
