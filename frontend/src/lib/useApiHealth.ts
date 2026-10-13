import { useSyncExternalStore } from 'react'
import { getHealth } from './api/client'

export type ApiState = 'checking' | 'online' | 'offline'

export type ServiceState = 'up' | 'down'

interface Health {
  state: ApiState
  checkedAt: number | null
  latencyMs: number | null
  /** Databases behind the API, as the API reports them. */
  services: { mongodb?: ServiceState; redis?: ServiceState }
}

let health: Health = { state: 'checking', checkedAt: null, latencyMs: null, services: {} }
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null
let inflight = false
/** How many consecutive failures before we switch to 'offline'. */
let failStreak = 0
const FAIL_THRESHOLD = 2

export async function checkHealth() {
  if (inflight) return
  inflight = true
  const t0 = performance.now()
  try {
    const body = await getHealth()
    failStreak = 0
    health = {
      state: 'online',
      checkedAt: Date.now(),
      latencyMs: Math.round(performance.now() - t0),
      services: body.services ?? {},
    }
  } catch {
    failStreak += 1
    // Only flip to offline after FAIL_THRESHOLD consecutive failures.
    if (failStreak >= FAIL_THRESHOLD) {
      health = { state: 'offline', checkedAt: Date.now(), latencyMs: null, services: {} }
    } else {
      // First failure: retry quickly in 1.5s rather than waiting for the 15s interval
      setTimeout(() => void checkHealth(), 1500)
    }
  } finally {
    inflight = false
    listeners.forEach((l) => l())
  }
}

function onWindowActive() {
  void checkHealth()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!timer) {
    void checkHealth()
    timer = setInterval(() => void checkHealth(), 15000)
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onWindowActive)
      window.addEventListener('online', onWindowActive)
    }
  }
  return () => {
    listeners.delete(cb)
    if (!listeners.size && timer) {
      clearInterval(timer)
      timer = null
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onWindowActive)
        window.removeEventListener('online', onWindowActive)
      }
    }
  }
}


/** Shared /api/health poller (one request every 20 s, however many components use it). */
export function useApiHealth(): Health {
  return useSyncExternalStore(
    subscribe,
    () => health,
    () => health,
  )
}
