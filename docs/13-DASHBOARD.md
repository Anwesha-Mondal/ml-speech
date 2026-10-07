# SPEECH ARENA: 13-DASHBOARD

## 1. Introduction

The Dashboard is the user-facing realization of the scientific pipeline. It accounts for 15% of the judging priority. If the backend math is flawless but the UI is a confusing spreadsheet, the product fails.

Section 14 mandates a highly interactive "Analysis screen" capable of syncing audio, text, and time-series data seamlessly.

---

## 2. Core Dashboard Components (React / Next.js)

The UI must be built using modern web components capable of handling high-frequency updates (e.g., RequestAnimationFrame for smooth audio syncing).

### 2.1 The Synchronized Audio-Transcript Player
*   **Function:** As the audio plays, the corresponding word in the transcript text must be highlighted.
*   **Implementation:** The UI consumes the JSON output from the Forced Alignment module (`[{word: "The", start: 0.1, end: 0.3}]`). A React `useRef` tracks the HTMLAudioElement's `currentTime`. A rapid interval or `requestAnimationFrame` loop checks the current time against the JSON array and updates a CSS class on the active word `<span>`.
*   **Interactivity:** Clicking any word in the transcript immediately seeks the audio to that word's `start_time`.

### 2.2 The Waveform & Timeline
*   **Function:** Visualizing the raw audio and providing a temporal map.
*   **Implementation:** `wavesurfer.js` is highly recommended. It supports zoom, regions, and multiple tracks.
*   **Multi-Track:** The UI must display the Reference waveform (muted grey) and the Participant waveform (primary color) layered or stacked.

### 2.3 Feature Overlays
*   **Function:** Visualizing the math.
*   **Implementation:** Line charts (e.g., `Chart.js` or `uPlot`) placed on an absolute-positioned canvas *directly above* the waveform.
*   **Toggles:** The user can toggle switches for "Show Pitch (F0)" and "Show Energy (RMS)". This reveals the normalized contour lines, allowing the user to visually see where their pitch diverged from the reference.

### 2.4 Flaw Markers & The Explanation Card
*   **Function:** The interactive realization of the Temporal Grounding and Explainability modules.
*   **Implementation:** 
    *   Flaws are rendered as colored regions or icon pins on the `wavesurfer.js` timeline.
    *   **onClick Event:** Clicking a flaw pauses the audio, seeks to the `start_time`, highlights the corresponding transcript span in yellow, and opens the `FlawExplanationCard` modal.
    *   **The Card:** Renders the exact template strings defined in `10-EXPLAINABILITY.md` (e.g., "Normalized deviation: +34%. Action: slow down").

---

## 3. UI State Management

Because the UI is highly reactive (audio time dictates transcript highlighting, waveform position, and feature overlay rendering), state management must be extremely efficient to avoid React re-render lag.

*   **Global Store:** Use `Zustand` or `Redux`.
*   **State Atoms:**
    *   `isPlaying`: boolean
    *   `currentTime`: float (updated outside the main React render cycle if possible, or using refs).
    *   `selectedFlawId`: string | null
    *   `activeWordIndex`: int
*   **Performance:** Do NOT put `currentTime` in a top-level React state that re-renders the entire page every 16ms. Only re-render the specific components that need it (the active word span and the playhead line).

---

## 4. Export & Sharing
*   **Requirement:** "Export/shareable report."
*   **Implementation:** 
    *   A "Generate PDF" button that compiles the overall score, the radar chart of component scores (Pacing, Pitch, etc.), and the top 3 most severe flaws into a static PDF report.
    *   A "Share Link" button that generates a read-only UUID route (e.g., `speecharena.com/report/abc-123`) allowing a coach or teacher to review the interactive dashboard.

*End of DASHBOARD.md*
