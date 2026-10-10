/** Only allow same-app paths as a redirect target (no //evil.com or https:// open redirects). */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  if (next.startsWith('/login') || next.startsWith('/register')) return '/'
  return next
}
