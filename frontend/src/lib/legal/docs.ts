// The legal documents, bundled from docs/legal/*.md at build time. The API reads the same
// files (backend/privacy/legal.py), so the text and versions can't drift apart.
import cookiesRaw from '../../../../docs/legal/cookies.md?raw'
import privacyRaw from '../../../../docs/legal/privacy.md?raw'
import termsRaw from '../../../../docs/legal/terms.md?raw'

export type LegalSlug = 'privacy' | 'terms' | 'cookies'

export interface LegalDoc {
  slug: LegalSlug
  title: string
  version: string
  effective: string
  body: string
}

function parse(slug: LegalSlug, raw: string): LegalDoc {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!m) throw new Error(`docs/legal/${slug}.md is missing its front-matter header`)
  const meta: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '')
  }
  return { slug, title: meta.title, version: meta.version, effective: meta.effective, body: m[2].trim() }
}

export const LEGAL: Record<LegalSlug, LegalDoc> = {
  privacy: parse('privacy', privacyRaw),
  terms: parse('terms', termsRaw),
  cookies: parse('cookies', cookiesRaw),
}
