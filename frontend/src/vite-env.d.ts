/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the FastAPI backend, from frontend/.env. Required. */
  readonly VITE_API_URL: string
}

declare const __BUILD__: { commit: string; branch: string; time: string }
