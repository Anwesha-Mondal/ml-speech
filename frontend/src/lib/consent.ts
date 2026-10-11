import { useSyncExternalStore } from 'react'
import { LEGAL } from './legal/docs'

/**
 * The visitor's storage choice (see docs/legal/cookies.md).
 * Strictly necessary storage (the session cookie, this choice itself) is always on.
 * Optional categories are only written when allowed:
 *   preferences → sa.settings.v1
 *   history     → sa.analyses.v1:<account>, sa.battles.v1:<account>
 */
export interface ConsentChoice {
  preferences: boolean
  history: boolean
}

interface Stored extends ConsentChoice {
  /** Cookie Policy version the choice was made against; a new version asks again. */
  version: string
  at: string
}

const KEY = 'sa.consent.v1'
const OPTIONAL_PREFIXES: Record<keyof ConsentChoice, string[]> = {
  preferences: ['sa.settings.v1'],
  history: ['sa.analyses.v1', 'sa.battles.v1'],
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as Stored) : null
    return v && typeof v.preferences === 'boolean' && typeof v.history === 'boolean' ? v : null
  } catch {
    return null
  }
}

let current: Stored | null = read()
const listeners = new Set<() => void>()
const grantListeners = new Set<(c: ConsentChoice) => void>()

export function currentPolicyVersion(): string {
  return LEGAL.cookies.version
}

/** True when the visitor still has to choose (never chose, or the Cookie Policy changed). */
export function needsChoice(): boolean {
  return !current || current.version !== currentPolicyVersion()
}

export function getConsent(): ConsentChoice {
  return needsChoice() || !current ? { preferences: false, history: false } : { preferences: current.preferences, history: current.history }
}

function removeOptional(category: keyof ConsentChoice) {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && OPTIONAL_PREFIXES[category].some((p) => k === p || k.startsWith(`${p}:`))) doomed.push(k)
    }
    doomed.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* storage blocked: nothing to remove */
  }
}

export function setConsent(choice: ConsentChoice) {
  const before = getConsent()
  current = { ...choice, version: currentPolicyVersion(), at: new Date().toISOString() }
  try {
    localStorage.setItem(KEY, JSON.stringify(current)) // strictly necessary: remembers the choice
  } catch {
    /* storage blocked: the choice applies for this visit */
  }
  // Withdrawing consent deletes what was saved for that category.
  ;(Object.keys(OPTIONAL_PREFIXES) as (keyof ConsentChoice)[]).forEach((c) => {
    if (!choice[c]) removeOptional(c)
  })
  listeners.forEach((l) => l())
  if ((choice.preferences && !before.preferences) || (choice.history && !before.history)) {
    grantListeners.forEach((l) => l(choice))
  }
}

/** Called after any change to the choice. */
export function onConsentChanged(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Stores register here to save what they hold in memory once consent is granted. */
export function onConsentGranted(fn: (c: ConsentChoice) => void) {
  grantListeners.add(fn)
  return () => {
    grantListeners.delete(fn)
  }
}

// "Cookie settings" links reopen the banner in its detailed view.
let panelOpen = false
const panelListeners = new Set<() => void>()

export function openCookieSettings() {
  panelOpen = true
  panelListeners.forEach((l) => l())
}

export function closeCookieSettings() {
  panelOpen = false
  panelListeners.forEach((l) => l())
}

export function useCookieSettingsOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      panelListeners.add(cb)
      return () => panelListeners.delete(cb)
    },
    () => panelOpen,
    () => panelOpen,
  )
}

export function useConsent(): { choice: ConsentChoice; needsChoice: boolean } {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => current,
  )
  void snap
  return { choice: getConsent(), needsChoice: needsChoice() }
}
