import { useSyncExternalStore } from 'react'
import type { Bucket } from './api/types'

export interface BattleRecord {
  id: string
  createdAt: string
  passage: string
  players: { name: string; score: number; buckets: Record<Bucket, number>; flaws: number }[]
  /** Index of the winner, or null for a draw. */
  winner: number | null
}

const KEY = 'sa.battles.v1'
const listeners = new Set<() => void>()
let snapshot: BattleRecord[] = read()

function read(): BattleRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as BattleRecord[]) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function saveBattle(b: BattleRecord) {
  snapshot = [b, ...snapshot].slice(0, 20)
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    /* keep in memory */
  }
  listeners.forEach((l) => l())
}

export function clearBattles() {
  snapshot = []
  try {
    localStorage.removeItem(KEY)
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
