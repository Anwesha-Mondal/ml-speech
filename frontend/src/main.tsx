import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initSettings } from './lib/settings'
import './styles/tokens.css'
import './styles/globals.css'
import './styles/shell.css'
import './styles/ui.css'
import './styles/analysis.css'
import './styles/modes.css'
import './styles/arena.css'
import './styles/pages.css'

initSettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
