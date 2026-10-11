import { useSyncExternalStore } from 'react'
import { getConsent, onConsentGranted } from './consent'

export type Theme = 'light' | 'dark' | 'system'

export interface Settings {
  theme: Theme
  sidebarCollapsed: boolean
  defaultMode: string
  showConfidence: boolean
  keepHistory: boolean
}

const KEY = 'sa.settings.v1'
const DEFAULTS: Settings = {
  theme: 'light',
  sidebarCollapsed: false,
  defaultMode: 'sandbox',
  showConfidence: true,
  keepHistory: true,
}

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

let current: Settings = read()
const listeners = new Set<() => void>()

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

function persist() {
  // Preferences are optional storage: saved only with consent (see lib/consent.ts).
  if (!getConsent().preferences) return
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* ignore: settings still apply for this visit */
  }
}

onConsentGranted((c) => c.preferences && persist())

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  persist()
  if (patch.theme) applyTheme(patch.theme)
  listeners.forEach((l) => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => current,
  )
}

export function initSettings() {
  applyTheme(current.theme)
}
