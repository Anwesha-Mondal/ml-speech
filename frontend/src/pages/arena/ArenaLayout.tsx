import { Outlet } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'

export default function ArenaLayout() {
  return (
    <div className="arena">
      <PageHeader
        eyebrow="Arena"
        title="Compete on delivery, not voice"
        description="Every player is measured against their own baseline first, so a louder or deeper voice earns nothing by itself."
        tabs={[
          { to: '/arena/battle', label: '1v1 Battle' },
          { to: '/arena/debate', label: 'Debate' },
          { to: '/arena/mimic', label: 'Mimic Party' },
        ]}
      />
      <Outlet />
    </div>
  )
}
