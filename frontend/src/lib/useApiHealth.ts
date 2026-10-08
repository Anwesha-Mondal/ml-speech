import { useSyncExternalStore } from 'react'
import { getHealth } from './api/client'

export type ApiState = 'checking' | 'online' | 'offline'

interface Health {
  state: ApiState
  checkedAt: number | null
  latencyMs: number | null
}

let health: Health = { state: 'checking', checkedAt: null, latencyMs: null }
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null
let inflight = false

export async function checkHealth() {
  if (inflight) return
  inflight = true
  const t0 = performance.now()
  try {
    await getHealth()
    health = { state: 'online', checkedAt: Date.now(), latencyMs: Math.round(performance.now() - t0) }
  } catch {
    health = { state: 'offline', checkedAt: Date.now(), latencyMs: null }
  } finally {
    inflight = false
    listeners.forEach((l) => l())
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!timer) {
    void checkHealth()
    timer = setInterval(() => void checkHealth(), 20000)
  }
  return () => {
    listeners.delete(cb)
    if (!listeners.size && timer) {
      clearInterval(timer)
      timer = null
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
