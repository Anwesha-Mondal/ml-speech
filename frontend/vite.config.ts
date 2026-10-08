import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD__: JSON.stringify({
      commit: git('rev-parse --short HEAD'),
      branch: git('rev-parse --abbrev-ref HEAD'),
      time: new Date().toISOString(),
    }),
  },
})
