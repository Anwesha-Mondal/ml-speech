import { useState } from 'react'
import { setLeaderboardOptIn } from '../../lib/api/client'
import { useAuth } from '../../lib/auth/context'

/** Join or leave the leaderboards. Off by default; leaving also deletes the stored scores. */
export default function OptInToggle({ onChange }: { onChange?: (optedIn: boolean) => void }) {
  const { user, updateUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  if (!user) return null

  return (
    <div className="stack gap-8">
      <label className="toggle">
        <input
          id="leaderboard-opt-in"
          type="checkbox"
          checked={user.leaderboard_opt_in}
          disabled={busy}
          onChange={async (e) => {
            const next = e.target.checked
            setBusy(true)
            setError(null)
            setNote(null)
            try {
              const r = await setLeaderboardOptIn(next)
              updateUser({ ...user, leaderboard_opt_in: r.leaderboard_opt_in })
              if (!next) setNote(r.removed_scores ? `Removed ${r.removed_scores} stored score(s).` : 'You are no longer listed.')
              onChange?.(r.leaderboard_opt_in)
            } catch (err) {
              setError((err as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        />
        <span>
          Show my display name and best scores on leaderboards. Only scores from reference passages are ranked;
          recordings are never stored.
        </span>
      </label>
      {note && <span className="t-small muted">{note}</span>}
      {error && <span className="t-small notice-bad">{error}</span>}
    </div>
  )
}
