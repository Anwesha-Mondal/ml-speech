import { Outlet } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'

export default function PracticeLayout() {
  return (
    <>
      <PageHeader
        title="Practice"
        description="Five practice workspaces. Each one changes the material and which parts of delivery count most."
        tabs={[
          { to: '/practice', label: 'Speech test', end: true },
          { to: '/practice/interviewer', label: 'Interviewer' },
          { to: '/practice/news-anchor', label: 'News anchor' },
          { to: '/practice/public-speaking', label: 'Public speaking' },
          { to: '/practice/storytelling', label: 'Storytelling' },
          { to: '/practice/progress', label: 'You vs You' },
        ]}
      />
      <Outlet />
    </>
  )
}
