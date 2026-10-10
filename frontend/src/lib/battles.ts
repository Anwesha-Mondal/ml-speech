import { useSyncExternalStore } from 'react'
import { getConsent, onConsentGranted } from './consent'
import type { Bucket } from './api/types'

export interface BattleRecord {
  id: string
  createdAt: string
  passage: string
  players: { name: string; score: number; buckets: Record<Bucket, number>; flaws: number }[]
  /** Index of the winner, or null for a draw. */
  winner: number | null
}

// Saved per account, like analyses (see analysis/store.ts).
const KEY_BASE = 'sa.battles.v1'
const listeners = new Set<() => void>()
let userKey: string | null = null
let snapshot: BattleRecord[] = []

export function setBattleUser(userId: string | null) {
  const next = userId ? `${KEY_BASE}:${userId}` : null
  if (next === userKey) return
  userKey = next
  snapshot = read()
  listeners.forEach((l) => l())
}

function read(): BattleRecord[] {
  if (!userKey) return []
  try {
    const raw = localStorage.getItem(userKey)
    const v = raw ? (JSON.parse(raw) as BattleRecord[]) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function saveBattle(b: BattleRecord) {
  snapshot = [b, ...snapshot].slice(0, 20)
  persist()
  listeners.forEach((l) => l())
}

function persist() {
  // History is optional storage (see lib/consent.ts).
  if (!userKey || !getConsent().history) return
  try {
    localStorage.setItem(userKey, JSON.stringify(snapshot))
  } catch {
    /* keep in memory */
  }
}

onConsentGranted((c) => c.history && persist())

export function clearBattles() {
  snapshot = []
  try {
    if (userKey) localStorage.removeItem(userKey)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function useBattles(): BattleRecord[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => snapshot,
    () => snapshot,
  )
}
