import { useSyncExternalStore } from 'react'
import { getConsent, onConsentGranted } from '../consent'
import type { Analysis } from './model'
import { buildExample, EXAMPLE_ID } from './example'

/**
 * Analyses created in this browser. Full objects (with audio URLs and computed signals)
 * live in memory; a serializable copy is kept in localStorage so the list and scores
 * survive a reload. Audio itself is never stored.
 */
// Saved per account (`sa.analyses.v1:<userId>`), so people sharing a browser never see
// each other's results. Nothing is readable until a user is signed in.
const KEY_BASE = 'sa.analyses.v1'
const MAX_SAVED = 30

const mem = new Map<string, Analysis>()
const listeners = new Set<() => void>()
let userKey: string | null = null
let snapshot: Analysis[] = []
let example: Analysis | null = null

/** Switch the store to a signed-in user (or null on sign-out). Drops the previous user's data from memory. */
export function setStoreUser(userId: string | null) {
  const next = userId ? `${KEY_BASE}:${userId}` : null
  if (next === userKey) return
  mem.forEach((a) => {
    if (a.audio?.participantUrl) URL.revokeObjectURL(a.audio.participantUrl)
    if (a.audio?.referenceUrl) URL.revokeObjectURL(a.audio.referenceUrl)
  })
  mem.clear()
  userKey = next
  snapshot = readSaved()
  listeners.forEach((l) => l())
}

function readSaved(): Analysis[] {
  if (!userKey) return []
  try {
    const raw = localStorage.getItem(userKey)
    const parsed = raw ? (JSON.parse(raw) as Analysis[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function strip(a: Analysis): Analysis {
  const copy: Analysis = { ...a }
  delete copy.audio
  delete copy.peaks
  delete copy.contours
  return copy
}

function persist(list: Analysis[]) {
  // History is optional storage: without consent, results live only in memory for this tab.
  if (!userKey || !getConsent().history) return
  try {
    localStorage.setItem(userKey, JSON.stringify(list.slice(0, MAX_SAVED).map(strip)))
  } catch {
    /* storage full or blocked: the in-memory copy still works for this visit */
  }
}

onConsentGranted((c) => c.history && persist(snapshot))

export function saveAnalysis(a: Analysis) {
  mem.set(a.id, a)
  snapshot = [a, ...snapshot.filter((x) => x.id !== a.id)].slice(0, MAX_SAVED)
  persist(snapshot)
  listeners.forEach((l) => l())
}

export function deleteAnalysis(id: string) {
  const a = mem.get(id)
  if (a?.audio?.participantUrl) URL.revokeObjectURL(a.audio.participantUrl)
  if (a?.audio?.referenceUrl) URL.revokeObjectURL(a.audio.referenceUrl)
  mem.delete(id)
  snapshot = snapshot.filter((x) => x.id !== id)
  persist(snapshot)
  listeners.forEach((l) => l())
}

export function clearAnalyses() {
  ;[...mem.keys()].forEach(deleteAnalysis)
  snapshot = []
  persist(snapshot)
  listeners.forEach((l) => l())
}

export function getExample(): Analysis {
  if (!example) example = buildExample()
  return example
}

export function getAnalysis(id: string): Analysis | null {
  if (id === EXAMPLE_ID) return getExample()
  return mem.get(id) ?? snapshot.find((a) => a.id === id) ?? null
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Live list of the user's own analyses, newest first. */
export function useAnalyses(): Analysis[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
}
