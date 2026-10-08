import type { ComponentType } from 'react'
import { createBrowserRouter, Link, Navigate, RouterProvider } from 'react-router-dom'
import AppShell from './components/shell/AppShell'
import RouteError from './components/shell/RouteError'
import EmptyState from './components/ui/EmptyState'
import AnalysisData from './pages/analysis/AnalysisData'
import AnalysisIndex from './pages/analysis/AnalysisIndex'
import AnalysisPage from './pages/analysis/AnalysisPage'
import { AssessmentLayout, Interviewer, NewsAnchor, PublicSpeaking, Storytelling } from './pages/assessment/AssessmentPages'
import Leaderboard from './pages/leaderboard/Leaderboard'
import Overview from './pages/overview/Overview'
import PracticeLayout from './pages/practice/PracticeLayout'
import SpeechTest from './pages/practice/SpeechTest'
import YouVsYou from './pages/practice/YouVsYou'
import Settings from './pages/settings/Settings'

// Less-visited sections load on first visit to keep the first download small.
// Each section is one module, so its pages share a single chunk.
const arena = () => import('./pages/arena/arenaRoutes')
const dataset = () => import('./pages/dataset/Dataset')
const system = () => import('./pages/system/System')
const pipeline = () => import('./pages/pipeline/Pipeline')
function lazy<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  return async () => ({ Component: pick(await load()) })
}

function NotFound() {
  return (
    <div className="panel">
      <EmptyState
        title="This page doesn't exist"
        action={
          <Link to="/" className="btn btn-primary">
            Go to Overview
          </Link>
        }
      >
        Check the address, or use the search box in the top bar.
      </EmptyState>
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        // Errors inside a page keep the sidebar and top bar on screen.
        errorElement: <RouteError />,
        children: [
          { index: true, element: <Overview /> },
          {
            path: 'practice',
            element: <PracticeLayout />,
            children: [
              { index: true, element: <SpeechTest /> },
              { path: 'progress', element: <YouVsYou /> },
            ],
          },
          {
            path: 'assessment',
            element: <AssessmentLayout />,
            children: [
              { index: true, element: <Navigate to="interviewer" replace /> },
              { path: 'interviewer', element: <Interviewer /> },
              { path: 'news-anchor', element: <NewsAnchor /> },
              { path: 'public-speaking', element: <PublicSpeaking /> },
              { path: 'storytelling', element: <Storytelling /> },
            ],
          },
          {
            path: 'arena',
            lazy: lazy(arena, (m) => m.ArenaLayout),
            children: [
              { index: true, element: <Navigate to="battle" replace /> },
              { path: 'battle', lazy: lazy(arena, (m) => m.Battle) },
              { path: 'debate', lazy: lazy(arena, (m) => m.Debate) },
              { path: 'mimic', lazy: lazy(arena, (m) => m.Mimic) },
            ],
          },
          { path: 'leaderboard', element: <Leaderboard /> },
          { path: 'analysis', element: <AnalysisIndex /> },
          { path: 'analysis/:id', element: <AnalysisPage /> },
          { path: 'analysis/:id/data', element: <AnalysisData /> },
          {
            path: 'dataset',
            lazy: lazy(dataset, (m) => m.DatasetLayout),
            children: [
              { index: true, lazy: lazy(dataset, (m) => m.DatasetOverview) },
              { path: 'references', lazy: lazy(dataset, (m) => m.DatasetReferences) },
              { path: 'variants', lazy: lazy(dataset, (m) => m.DatasetVariants) },
              { path: 'flaws', lazy: lazy(dataset, (m) => m.DatasetFlaws) },
              { path: 'severity', lazy: lazy(dataset, (m) => m.DatasetSeverity) },
              { path: 'rights', lazy: lazy(dataset, (m) => m.DatasetRights) },
            ],
          },
          { path: 'pipeline', lazy: lazy(pipeline, (m) => m.default) },
          {
            path: 'system',
            lazy: lazy(system, (m) => m.SystemLayout),
            children: [
              { index: true, lazy: lazy(system, (m) => m.SystemApi) },
              { path: 'architecture', lazy: lazy(system, (m) => m.SystemArchitecture) },
              { path: 'scoring', lazy: lazy(system, (m) => m.SystemScoring) },
              { path: 'devops', lazy: lazy(system, (m) => m.SystemDevops) },
            ],
          },
          { path: 'settings', element: <Settings /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
