import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import EmptyState from '../ui/EmptyState'

/** Shown instead of a blank page when a screen throws while rendering. */
export default function RouteError() {
  const err = useRouteError()
  const detail = isRouteErrorResponse(err)
    ? `${err.status} ${err.statusText}`
    : err instanceof Error
      ? err.message
      : 'Unknown error'
  return (
    <div className="panel" style={{ margin: 32 }}>
      <EmptyState
        title="This screen hit an error"
        action={
          <div className="row gap-8 wrap" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <Link to="/" className="btn" reloadDocument>
              Go to Overview
            </Link>
          </div>
        }
      >
        Your saved analyses are safe. Details: <span className="mono">{detail}</span>
      </EmptyState>
    </div>
  )
}
