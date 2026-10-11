import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initSettings } from './lib/settings'
// Self-hosted fonts: no request leaves the app for Google Fonts.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './styles/tokens.css'
import './styles/globals.css'
import './styles/shell.css'
import './styles/ui.css'
import './styles/analysis.css'
import './styles/modes.css'
import './styles/arena.css'
import './styles/pages.css'
import './styles/auth.css'
import './styles/legal.css'

initSettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
