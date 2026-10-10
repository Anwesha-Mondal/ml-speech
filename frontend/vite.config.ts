import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, searchForWorkspaceRoot, type Plugin } from 'vite'

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Production builds get a Content-Security-Policy: only the app's own files and the API may
 * load. No third-party scripts, fonts, frames or trackers can run, even if one is added by
 * mistake. (Dev mode skips it because Vite's hot reload injects inline scripts.)
 */
function contentSecurityPolicy(apiOrigin: string): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // React style attributes
    "img-src 'self' data: blob:",
    "media-src 'self' blob:", // playback of your own recording
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}`,
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'speech-arena-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The API address lives in frontend/.env (gitignored); see frontend/.env.example.
  if (!env.VITE_API_URL) {
    throw new Error('VITE_API_URL is not set. Copy frontend/.env.example to frontend/.env and fill it in.')
  }
  const api = new URL(env.VITE_API_URL).origin
  return {
    plugins: [react(), contentSecurityPolicy(api)],
    define: {
      __BUILD__: JSON.stringify({
        commit: git('rev-parse --short HEAD'),
        branch: git('rev-parse --abbrev-ref HEAD'),
        time: new Date().toISOString(),
      }),
    },
    server: {
      fs: {
        // The legal pages are bundled from ../docs/legal (the same files the API serves).
        allow: [searchForWorkspaceRoot(process.cwd()), resolve(__dirname, '../docs/legal')],
      },
    },
  }
})
