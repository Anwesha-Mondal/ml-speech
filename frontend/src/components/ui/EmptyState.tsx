import type { ReactNode } from 'react'

export default function EmptyState({
  title,
  children,
  action,
  compact = false,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`empty ${compact ? 'empty-compact' : ''}`}>
      <svg className="empty-mark" viewBox="0 0 120 24" aria-hidden="true">
        {Array.from({ length: 30 }, (_, i) => {
          const h = 3 + Math.abs(Math.sin(i * 0.7) * 9) + (i % 4)
          return <rect key={i} x={i * 4} y={12 - h / 2} width="2" height={h} rx="1" />
        })}
      </svg>
      <p className="empty-title">{title}</p>
      {children && <p className="empty-body">{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}
