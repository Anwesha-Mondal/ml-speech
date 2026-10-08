import { Outlet } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'

export default function PracticeLayout() {
  return (
    <>
      <PageHeader
        title="Practice"
        description="Read a passage, record it, and see exactly where your delivery differs from the reference."
        tabs={[
          { to: '/practice', label: 'Speech test', end: true },
          { to: '/practice/progress', label: 'You vs You' },
        ]}
      />
      <Outlet />
    </>
  )
}
