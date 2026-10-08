# Speech Arena frontend

Vite + React 19 + TypeScript dashboard for Speech Arena. The design follows `uiux.md`: light, minimal editorial interface with a cursor-reactive ambient light, black controls, and semantic colour only where it carries meaning.

## Run it

Requires Node 20+.

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The app expects the API at `http://localhost:8000`. Start it from the repo root:

```bash
python -m uvicorn backend.api.main:app --port 8000
```

To point at another API, set `VITE_API_URL` (for example in `frontend/.env.local`).

Other scripts: `npm run build` (type-check and production build), `npm run lint` (oxlint), `npm run preview` (serve the build).

## Where things are

```text
src/
  App.tsx                 routes (Arena, Dataset, Pipeline, System load lazily)
  components/
    shell/                AppShell, Sidebar, Topbar, CursorLight, RouteError
    analysis/             Waveform, Transcript, ScoreBlock, FlawPanel
    recording/            AudioInput (upload / mic), AttemptForm, ProcessingSteps
    arena/                MiniWave
    ui/                   PageHeader, SourceTag, EmptyState, LineChart
  pages/                  one folder per section in uiux.md §11
  lib/
    api/                  typed client for backend/api/routers/*.py
    analysis/             model (flaw labels, bucket caps), example data, store, run flow
    audio/                decoding, waveform peaks, pitch/energy contours, playback clock,
                          recorder, Mimic Party DTW
    data/                 dataset.generated.ts (from scripts/sync_frontend_data.py)
    pipeline.ts           which server stages /api/analyze runs today
  styles/                 tokens.css (design tokens, light + dark), then per-area CSS
```

## Where the data comes from

Every number in the UI is labelled with its source:

| Tag | Meaning |
| --- | --- |
| **Live** | Returned by the API for this recording (`/api/analyze`, `/api/jobs`). |
| **Example** | The built-in Gettysburg example, so the analysis screen works without the backend. |
| **Sample data** | The endpoint returns a fixed response today (`/api/leaderboard`, `/api/progress/history`). |
| **In browser** | Computed in the browser from the user's own recording (waveform, pitch and energy contours, Mimic Party). Display only; never used for the score. |
| **From repo** | Generated from `datasets/` at build time. |

Notes for the team:

- **Battles** score both readings with `/api/analyze` and compare the results; `/api/battle/1v1` (fixed winner) isn't used.
- **Mimic Party** runs fully in the browser, per `docs/15-MIMIC-PARTY.md`: per-speaker z-scored pitch and energy, DTW aligned on the energy envelope, `score = max(0, 100 − distance × 50)`. Same delivery in a 140 Hz vs 220 Hz voice scores 97; a different melody scores about 54. `/api/mimic-party` (always 94) isn't used.
- **Word timing** is estimated (spread evenly) because the API doesn't return alignment yet. The transcript shows a "Word timing estimated" badge until it does.
- When a pipeline stage gets connected on the server, update its `status` in `src/lib/pipeline.ts`.
- After changing `datasets/`, run `python scripts/sync_frontend_data.py` from the repo root.

Analyses and battles are kept in the browser's local storage (never the recordings). Settings → Data clears them.
