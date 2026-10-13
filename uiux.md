# SPEECH ARENA — MASTER STITCH UI/UX REDESIGN PROMPT

## 0. ROLE

You are designing the complete production-quality frontend UI/UX for **Speech Arena**, a multimodal speech-analysis and competitive speaking platform built for the Multimodal AI Hackathon 2026, Track C.

Do NOT treat this as a generic AI dashboard.

Do NOT generate the typical "AI SaaS" aesthetic consisting of:
- excessive gradients
- purple/blue neon
- glassmorphism everywhere
- glowing cards
- oversized rounded containers
- excessive pills
- floating blobs
- generic AI sparkles
- huge hero illustrations
- unnecessary 3D objects
- excessive shadows
- visually noisy dashboards

The product should feel like a **real product designed by a strong human product designer**.

The visual direction is:

> **Minimal editorial interface + professional audio analysis workstation + subtle interactive motion.**

It should look sophisticated enough for a hackathon demo, but believable enough that it could become a real product.

---

# 1. CORE PRODUCT

Product name:

**Speech Arena**

Core idea:

Speech Arena does not primarily ask:

> "What did the speaker say?"

It asks:

> **"How was it said?"**

The platform objectively compares speech delivery using acoustic measurements, temporal grounding, normalization and deterministic scoring.

The product must never visually imply that it is reading emotions, personality, psychology or biometric identity.

The UI should communicate:

**measurement → comparison → evidence → improvement**

rather than:

**AI → magic → prediction**

This distinction is extremely important.

---

# 2. DESIGN PRINCIPLE

The entire interface should feel:

- clean
- calm
- precise
- technical
- modern
- human
- editorial
- trustworthy
- slightly experimental
- responsive
- alive without being flashy

Think of the visual language as somewhere between:

- a premium audio workstation
- a modern editorial publication
- a scientific visualization tool
- a refined developer product
- a minimalist productivity application

NOT:

- generic ChatGPT clone
- generic AI startup dashboard
- crypto dashboard
- cyberpunk dashboard
- neon gaming dashboard

---

# 3. PRIMARY VISUAL SYSTEM

## Base Theme

The default application theme is LIGHT.

### Background

Use predominantly white:

`#FFFFFF`

Supporting neutral surfaces:

- `#FAFAFA`
- `#F5F5F5`
- `#EEEEEE`
- `#E6E6E6`

### Primary

Buttons, important controls and major typography should use black:

`#111111`

Secondary dark:

`#222222`

Muted text:

`#707070`

Borders:

`#E5E5E5`

Very subtle secondary backgrounds:

`#F8F8F8`

The interface should primarily be:

**white + black + grayscale**

with very limited semantic accent colors.

---

# 4. ACCENT COLORS

Do NOT make the entire interface colorful.

Use accent colors only where they communicate meaning.

Suggested restrained semantic palette:

- Primary interaction: black
- Success / improvement: muted green
- Warning / deviation: muted amber
- Critical flaw: muted red
- Reference data: neutral gray
- Participant data: black or very dark neutral

Accent colors should appear mainly in:

- flaw markers
- score changes
- status indicators
- charts
- selected states
- battle results

Avoid rainbow charts.

Avoid gradient charts.

---

# 5. TYPOGRAPHY

Use a highly readable modern sans-serif.

Prefer:

- Inter
- Geist
- Manrope
- SF Pro-style system typography

Use typography hierarchy rather than decorative UI.

Large headings should be confident but restrained.

Avoid:

- giant futuristic typography
- excessive uppercase
- excessive letter spacing
- techno fonts
- decorative fonts

The application should look like a serious analytical product.

---

# 6. SHAPE LANGUAGE

Avoid excessive rounded UI.

Use:

- mostly 8px–12px radius
- occasional 14px radius for major interactive surfaces
- square-ish buttons where appropriate
- subtle borders

Do NOT make every component a floating rounded rectangle.

Some areas should simply be separated using:

- whitespace
- thin borders
- typography
- alignment

This is important for avoiding the "AI-generated UI" look.

---

# 7. SHADOWS

Use shadows extremely sparingly.

Most components should rely on:

- borders
- spacing
- contrast
- layering

rather than large drop shadows.

If a shadow is used, it should be subtle and almost imperceptible.

---

# 8. THE MOST IMPORTANT VISUAL FEATURE:
# CURSOR-REACTIVE BACKGROUND

The background should NOT be completely static.

However, the effect must be extremely subtle.

Implement a cursor-reactive ambient light.

Concept:

As the user moves the cursor, a very soft radial light follows the cursor.

Example:

`radial-gradient(circle at var(--mouse-x) var(--mouse-y), rgba(0,0,0,0.035), transparent 280px)`

The effect should feel like:

**paper reacting to light**

rather than:

**gaming RGB lighting**.

Requirements:

- smooth interpolation
- no visible cursor trail
- no particles
- no sparkles
- no huge glow
- no performance-heavy canvas
- no distracting animation

The light should follow the cursor with slight easing.

On mobile/touch devices:

disable the effect or replace it with a static ambient background.

---

# 9. MICRO-INTERACTIONS

The application should feel alive through small interactions.

Use subtle:

- hover transitions
- button compression
- opacity transitions
- underline animations
- chart transitions
- waveform movement
- score count-up
- active navigation transitions
- panel expansion
- audio playhead movement
- transcript word highlighting

Animation duration should generally be around:

150–250ms

Use slower motion only for major transitions.

Do NOT animate everything.

---

# 10. APPLICATION SHELL

Create one consistent application shell.

Structure:

```text
┌───────────────────────────────────────────────────────────────┐
│ Speech Arena                          Search     Profile       │
├───────────────┬───────────────────────────────────────────────┤
│               │                                               │
│ Navigation    │                                               │
│               │               Main Content                    │
│ Overview      │                                               │
│ Practice      │                                               │
│ Assessment   │                                               │
│ Arena         │                                               │
│ Leaderboard   │                                               │
│               │                                               │
│ ───────────   │                                               │
│               │                                               │
│ Data          │                                               │
│ Dataset       │                                               │
│ Pipeline      │                                               │
│ Analysis      │                                               │
│               │                                               │
│ System        │                                               │
│ Infrastructure│                                              │
│               │                                               │
│ Settings      │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

The sidebar should NOT be oversized.

It should feel like a professional navigation rail.

Use clear section grouping.

---

# 11. NAVIGATION INFORMATION ARCHITECTURE

Do not place every feature into one giant page.

Create distinct routes/pages.

## MAIN

### Overview

Purpose:

Personal home/dashboard.

Display:

- current score
- recent attempts
- improvement trend
- current streak
- recent battles
- recommended practice
- latest analysis
- quick actions

Quick actions:

- Start Speech Test
- Record Practice
- Enter Battle
- Mimic Party

---

# 12. TRAINING SECTION

Create a dedicated:

## `/practice`

Page.

Subsections:

### Speech Test

User chooses:

- reference speech
- transcript
- difficulty
- practice mode

Then:

Record / Upload.

After processing:

Open the Analysis screen.

---

### You vs You

Dedicated improvement page.

Display:

- first attempt
- latest attempt
- score progression
- flaw density
- pacing improvement
- pitch improvement
- pause improvement
- clarity improvement

Use comparison charts.

Keep it visually simple.

---

# 13. ASSESSMENT SECTION

Create:

## `/assessment`

Sub-pages:

### Interviewer

Dynamic interview practice.

UI should focus on:

- question
- recording state
- response timer
- hesitation
- pacing
- clarity

### News Anchor

Teleprompter-style interface.

Large readable script.

Minimal controls.

Scrolling text.

Recording indicator.

Post-analysis.

### Public Speaking

Long-form speaking interface.

Focus on:

- pacing
- energy
- pitch variation
- pauses
- storytelling delivery

---

# 14. ARENA SECTION

Create:

## `/arena`

This is the competitive part of the product.

Tabs:

### 1v1 Battle

### Debate

### Mimic Party

The Arena should have a slightly more energetic visual personality than the analytical pages, but still use the same design system.

Do NOT turn this into a neon gaming UI.

---

# 15. 1V1 BATTLE PAGE

Design a split-screen comparison.

Top:

Player A

Bottom:

Player B

Center:

VS

Display:

- score
- pacing
- pitch
- pauses
- energy / clarity
- flaw count

Waveforms:

Player A waveform

Player B waveform

They should be visually comparable.

Include:

**Fair comparison**

with a small explanation:

"Scores use speaker-normalized acoustic features."

This communicates the fairness principle without overloading the interface.

The backend specification requires both players' features to be normalized against their own baselines before comparison.

---

# 16. DEBATE PAGE

Design a turn-based interface.

Stages:

```text
OPENING
   ↓
RESPONSE
   ↓
REBUTTAL
```

Show:

- current speaker
- timer
- turn status
- recording state
- current round
- pacing
- hesitation
- pitch stability

At the end show:

## Debate Result

with objective breakdown.

---

# 17. MIMIC PARTY

This should be the most visually playful page.

But still stay within the overall visual language.

The core visual should be a large contour visualization.

Reference:

thin/neutral target line

Participant:

strong black line

Tolerance area:

very subtle shaded region

As the user performs:

- matching → smooth
- deviation → subtle red indication

Display:

**Mimic Score**

and:

- cadence match
- pause match
- pitch contour match
- energy contour match

Important:

This mode evaluates delivery patterns only.

Never show UI implying voice identity matching or voice cloning.

The specification explicitly defines Mimic Party around cadence, pause placement, pitch and energy contours, while ignoring biometric voice characteristics.

---

# 18. LEADERBOARD

Create:

## `/leaderboard`

Do NOT create a single generic leaderboard.

Provide tabs:

### Global

Aggregated XP / Elo.

### Transcript

Ranking for a specific reference speech.

### Friends

Friend/cohort rankings.

Display:

Rank

User

Score

Elo

Transcript

Accuracy

Trend

The backend specification requires transcript-specific leaderboards and version-aware scoring.

Include a small:

`SCORING v1.0`

indicator.

---

# 19. ANALYSIS PAGE

This is the most important screen in the entire product.

Create:

## `/analysis/[id]`

It should feel like a simplified professional audio-analysis workstation.

NOT a generic dashboard.

---

# 20. ANALYSIS SCREEN STRUCTURE

## HEADER

Show:

Speech title

Speaker/reference

Duration

Score

Scoring version

Example:

```text
Gettysburg Address

Reference: Abraham Lincoln
Duration: 2:41

82 / 100

SCORING v1.0
```

---

# 21. SCORE AREA

Use a large but restrained score.

Example:

`82`

`/100`

Below:

"Good delivery with several localized deviations."

Do not use a giant circular gauge.

Prefer a clean numerical presentation.

---

# 22. SCORE BREAKDOWN

Four primary buckets:

```text
Pacing             21 / 25
Pitch Control      19 / 25
Pauses             17 / 20
Energy & Clarity   25 / 30
```

Use horizontal bars.

Do NOT use 3D charts.

Do NOT use donut charts everywhere.

Keep data legible.

The scoring specification defines these four buckets and uses a deterministic deduction model.

---

# 23. SYNCHRONIZED TRANSCRIPT

Create a transcript panel.

As audio plays:

the active word is highlighted.

Example:

> Four score and seven years ago our fathers brought forth...

Active word:

subtle black background or underline.

Clicking a word:

seek audio to that timestamp.

This behavior is mandatory.

The dashboard specification explicitly requires audio/transcript synchronization and word-level seeking.

---

# 24. AUDIO WAVEFORM

Create a large waveform timeline.

Use two layers:

### Reference

Muted gray.

### Participant

Black / primary.

Show:

- playhead
- timestamps
- zoom controls
- play/pause
- volume
- playback speed

Do not make the waveform neon.

---

# 25. FLAW MARKERS

Temporal flaws must be visually grounded.

Markers appear directly on the waveform.

Examples:

```text
───────●────────────●──────────────
       ↑            ↑
     Rushed       Missing pause
```

Clicking a marker:

1. pauses audio
2. seeks to the flaw
3. highlights the relevant transcript text
4. opens the explanation panel

This is one of the most important interactions in the application.

---

# 26. FLAW EXPLANATION PANEL

Use a right-side drawer or contextual panel.

Example:

```text
PACING TOO FAST

21.4s — 25.8s

Reference
3.8 syllables/sec

Participant
5.1 syllables/sec

Deviation
+34%

What happened
Your delivery became rushed and may reduce
articulation clarity.

Action
Slow down before the key phrase and restore
the reference pause.
```

Do not use AI-generated prose.

The project specification explicitly requires deterministic, auditable explanation templates rather than LLM-generated explanations.

---

# 27. FEATURE VISUALIZATION

Below the waveform provide toggles:

```text
[ ] Pitch F0
[ ] Energy RMS
[ ] Pauses
[ ] Flaws
```

When enabled:

overlay the normalized reference and participant contours.

Keep the chart technical but understandable.

Do not overload the screen.

---

# 28. DATA / SCIENTIFIC VIEW

Create a separate:

## `/analysis/[id]/data`

page.

This is where technical users can inspect:

- F0
- RMS
- MFCC
- FFT
- speech rate
- syllables/sec
- pauses
- alignment confidence
- normalization
- DTW information

This prevents the main analysis screen from becoming cluttered.

---

# 29. DATASET SECTION

Create:

## `/dataset`

Tabs:

### Dataset Overview

Show:

- transcript count
- reference recordings
- variants
- severity distribution
- flaw distribution
- speaker count

### References

Reference audio.

### Variants

Flawed recordings.

### Flaws

Flaw taxonomy.

### Severity

0.0 → 1.0 distribution.

### Rights

Provenance / license state.

The dataset specification requires matched reference/flawed recordings and severity coverage.

The rights specification also requires provenance for individual audio assets.

---

# 30. PIPELINE SECTION

Create:

## `/pipeline`

This is the operational view of the backend processing pipeline.

Show the pipeline visually:

```text
UPLOAD
   ↓
RIGHTS GATE
   ↓
NORMALIZATION
   ↓
QUALITY CONTROL
   ↓
TRANSCRIPT
   ↓
VAD / SEGMENTATION
   ↓
ALIGNMENT
   ↓
FEATURE EXTRACTION
   ↓
NORMALIZATION
   ↓
TEMPORAL GROUNDING
   ↓
SCORING
   ↓
EXPLANATION
```

Each stage should be a separate interactive component.

Clicking a stage opens:

- status
- duration
- input
- output
- errors
- confidence
- service name

This should look like an engineering observability tool, not a decorative flowchart.

The ingestion specification explicitly defines a staged asynchronous pipeline from acquisition through rights verification, normalization, QC, transcript normalization, VAD/segmentation and storage.

---

# 31. BACKEND / SYSTEM SECTION

Create:

## `/system`

This is the technical backend control center.

Do NOT expose backend functionality as one giant page.

Use tabs:

### API

- API health
- endpoints
- request volume
- latency
- errors

### Ingestion

- jobs
- queue
- failures
- processing time

### Alignment

- Wav2Vec2
- MFA
- alignment confidence
- failed jobs

### Features

- F0
- RMS
- MFCC
- FFT
- extraction jobs

### Temporal Grounding

- DTW jobs
- flaw detection
- timestamps
- confidence

### Scoring

- current scoring version
- weights
- recent scoring jobs
- score distributions

### Leaderboard

- Redis status
- ranking updates
- cache status

### Storage

- S3
- PostgreSQL
- Redis
- object counts
- storage usage

### Infrastructure

- services
- containers
- deployment status
- environment
- uptime

---

# 32. BACKEND ARCHITECTURE VISUALIZATION

Create an architecture view:

```text
                    FRONTEND
                       │
                       ▼
                 API GATEWAY
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
   INGESTION       ANALYSIS         BATTLES
       │               │                │
       ▼               ▼                ▼
     S3            ALIGNMENT         SCORING
                       │                │
                       ▼                ▼
                  FEATURES         LEADERBOARD
                       │                │
                       └──────┬─────────┘
                              ▼
                         PostgreSQL
                              +
                            Redis
```

Use clean architectural lines.

No futuristic glowing infrastructure.

---

# 33. SERVICE HEALTH UI

Create a compact service-health component.

Example:

```text
SERVICE              STATUS

API Gateway          ● Operational
Ingestion            ● Operational
Alignment            ● Operational
Feature Extraction   ● Operational
Scoring              ● Operational
Leaderboard          ● Operational
Storage              ● Operational
```

Use tiny status indicators.

Do not use giant colored cards.

---

# 34. DEVOPS VIEW

Create:

## `/system/devops`

Show:

- Development
- Staging
- Production

Deployment pipeline:

```text
Commit
 ↓
CI
 ↓
Docker
 ↓
ECR
 ↓
ArgoCD
 ↓
Kubernetes
 ↓
Production
```

Include:

- deployment version
- commit SHA
- deployment time
- health
- rollback action

The architecture documentation defines containerized services, GitHub Actions CI, ECR, ArgoCD/GitOps and Kubernetes deployment workflows.

---

# 35. RIGHTS / PROVENANCE

Create:

## `/dataset/rights`

Use a clean table.

Columns:

- Asset
- Provider
- License
- Redistribution
- SHA-256
- Verification
- Status

Statuses:

`VERIFIED`

`RESEARCH ONLY`

`REJECTED`

Do not make this visually intimidating.

This is a scientific/legal data-management surface.

---

# 36. SETTINGS

Create:

## `/settings`

Sections:

- Profile
- Audio
- Appearance
- Notifications
- Privacy
- Data
- Scoring information

Keep settings extremely clean.

---

# 37. COMPONENT ARCHITECTURE

The generated UI must NOT be implemented as one giant file.

Create reusable components.

Suggested structure:

```text
src/
│
├── app/
│   ├── overview/
│   ├── practice/
│   ├── assessment/
│   ├── arena/
│   ├── leaderboard/
│   ├── analysis/
│   ├── dataset/
│   ├── pipeline/
│   ├── system/
│   └── settings/
│
├── components/
│   ├── shell/
│   │   ├── AppShell
│   │   ├── Sidebar
│   │   ├── Topbar
│   │   └── PageHeader
│   │
│   ├── analysis/
│   │   ├── AudioPlayer
│   │   ├── Waveform
│   │   ├── Transcript
│   │   ├── Timeline
│   │   ├── FeatureOverlay
│   │   ├── FlawMarker
│   │   ├── FlawExplanation
│   │   └── ScoreBreakdown
│   │
│   ├── arena/
│   │   ├── BattleCard
│   │   ├── BattleWaveform
│   │   ├── DebateRound
│   │   └── MimicContour
│   │
│   ├── dataset/
│   │   ├── DatasetStats
│   │   ├── ReferenceTable
│   │   ├── VariantTable
│   │   ├── SeverityChart
│   │   └── RightsTable
│   │
│   ├── pipeline/
│   │   ├── PipelineGraph
│   │   ├── PipelineStage
│   │   └── JobInspector
│   │
│   ├── system/
│   │   ├── ServiceHealth
│   │   ├── Metrics
│   │   ├── InfrastructureGraph
│   │   └── DeploymentStatus
│   │
│   └── ui/
│       ├── Button
│       ├── Tabs
│       ├── Card
│       ├── Badge
│       ├── Drawer
│       ├── Modal
│       ├── Table
│       └── Tooltip
│
├── features/
│   ├── recording/
│   ├── analysis/
│   ├── battles/
│   ├── leaderboard/
│   ├── dataset/
│   └── system/
│
├── lib/
│   ├── api/
│   ├── audio/
│   ├── charts/
│   └── utils/
│
└── styles/
    ├── tokens
    ├── globals
    └── animations
```

Adapt the exact folder structure to the existing codebase, but preserve the principle:

> ONE FEATURE = ONE MODULE.

Do not keep unrelated features in a single component.

---

# 38. BACKEND MODULARIZATION

The backend should similarly be represented as independent modules.

Suggested conceptual structure:

```text
backend/
│
├── api/
│
├── ingestion/
│   ├── downloader
│   ├── rights
│   ├── normalization
│   └── qc
│
├── alignment/
│   ├── wav2vec
│   ├── mfa
│   └── timestamps
│
├── features/
│   ├── pitch
│   ├── energy
│   ├── mfcc
│   ├── fft
│   ├── pacing
│   └── pauses
│
├── normalization/
│
├── grounding/
│   ├── dtw
│   ├── pacing
│   ├── pauses
│   └── flaw_detection
│
├── scoring/
│   ├── rules
│   ├── weights
│   └── versions
│
├── explainability/
│
├── battles/
│
├── leaderboard/
│
├── dataset/
│
├── storage/
│
└── infrastructure/
```

The UI should visually correspond to these backend domains.

---

# 39. IMPORTANT:
# DO NOT FAKE AI

Do not create fake "AI insights" such as:

"AI thinks you sound confident."

Do not show:

"Emotion: 87% confident."

Do not use psychological interpretations.

Instead use factual statements:

"Speech rate increased by 34%."

"Pitch variance decreased by 40%."

"Pause duration exceeded the reference by 0.8 seconds."

"This deviation may reduce articulation clarity."

The product specification explicitly establishes acoustic determinism over psychological inference.

---

# 40. SCORE VISUALIZATION

Never make the score look like an AI prediction probability.

It is a deterministic score.

Show:

```text
82 / 100
```

Then:

```text
Pacing             -8
Pitch              -6
Pauses             -4
Energy & Clarity   -0
```

The scoring engine uses measurable components and a deterministic deduction model.

---

# 41. EMPTY STATES

Design meaningful empty states.

Examples:

No analysis:

"Record an attempt to begin analysis."

No battles:

"No active battles."

No dataset:

"No reference recordings have been added."

No pipeline jobs:

"All processing queues are clear."

Do not use cartoon illustrations.

---

# 42. LOADING STATES

Use skeletons and progressive states.

For audio analysis:

```text
Uploading
   ↓
Normalizing
   ↓
Aligning
   ↓
Extracting features
   ↓
Grounding flaws
   ↓
Calculating score
   ↓
Ready
```

Make the processing state feel informative rather than decorative.

---

# 43. RESPONSIVE DESIGN

Desktop is the primary experience.

Support:

- 1440px
- 1280px
- 1024px
- tablet
- mobile

On smaller screens:

sidebar collapses into a compact navigation.

Analysis screen reorganizes:

```text
Score
↓
Waveform
↓
Transcript
↓
Flaws
↓
Metrics
```

Do not simply shrink the desktop layout.

---

# 44. ACCESSIBILITY

Use:

- strong contrast
- keyboard navigation
- visible focus states
- semantic buttons
- accessible labels
- reduced-motion support

The cursor-reactive background must respect:

`prefers-reduced-motion`

---

# 45. PERFORMANCE

The application contains real-time audio synchronization.

Do not trigger a full React render every 16ms.

Use efficient state management and refs for high-frequency audio position updates.

The analysis specification specifically calls for efficient synchronization using requestAnimationFrame-style updates and localized rendering.

The waveform/playhead and active transcript word should update independently.

---

# 46. DATA VISUALIZATION PRINCIPLES

Charts should answer a question.

Good:

"Did pacing improve?"

"Where did pitch deviate?"

"Which flaw caused the score deduction?"

Bad:

"Here are seven random charts."

Avoid dashboard chart spam.

Prefer:

- line charts
- horizontal bars
- timelines
- sparklines
- waveform overlays
- compact tables

Avoid:

- 3D charts
- gauges everywhere
- pie charts everywhere
- unnecessary radial graphs

---

# 47. CURSOR EFFECT IMPLEMENTATION DIRECTION

Create one global background layer.

Pseudo-behavior:

```text
mouse moves
     ↓
capture pointer coordinates
     ↓
smooth interpolation
     ↓
update CSS variables
     ↓
subtle radial ambient light
```

Keep it GPU-friendly.

Do not use a giant JavaScript canvas unless genuinely necessary.

The effect should remain almost invisible until the user notices it.

---

# 48. PAGE TRANSITIONS

Use extremely subtle transitions.

When switching between sections:

- fade
- 4–8px translate
- 150–220ms

No:

- dramatic zoom
- page rotation
- particle transitions
- cinematic wipes

---

# 49. SIDEBAR BEHAVIOR

Desktop:

expanded sidebar.

Collapsed state:

icons + tooltips.

Active section:

black text / subtle background / thin indicator.

Do not use giant filled active pills.

Navigation should feel like a high-quality productivity application.

---

# 50. HEADER

Keep the header simple.

Left:

page title / breadcrumb

Right:

search

notifications

profile

Do not place huge gradients or marketing slogans inside the app.

---

# 51. LANDING / ENTRY SCREEN

If a landing page is needed, use:

white background

large typography

short explanation:

**Train how you speak.  
Measure how you deliver.**

Then:

`Start Practicing`

Secondary:

`Explore the Arena`

A subtle waveform or speech contour can be used as the visual motif.

Do not use a giant AI orb.

---

# 52. DESIGN MOTIF

The recurring visual motif should be:

**speech waveform + timeline + measurement**

Not:

AI brain

robot

neural network

sparkles

magic

Use thin waveform lines, timeline ticks, word highlights and data traces.

This gives the project a distinctive identity.

---

# 53. HACKATHON DEMO PRIORITY

Optimize the UI for judges.

Within the first 30 seconds they should understand:

1. What Speech Arena is.
2. What makes it different.
3. How a speech is analyzed.
4. Where the score comes from.
5. Where the exact flaw occurred.
6. How the system explains the flaw.
7. How battles work.

The primary demo path should therefore be:

```text
Overview
   ↓
Choose Speech
   ↓
Record / Upload
   ↓
Processing
   ↓
Analysis
   ↓
Score
   ↓
Waveform
   ↓
Flaw Marker
   ↓
Exact Explanation
```

This should be the smoothest flow in the entire application.

---

# 54. DEMO DATA

Use realistic demo data rather than placeholder lorem ipsum.

Example:

Reference:

"Gettysburg Address"

Score:

82 / 100

Pacing:

21 / 25

Pitch:

19 / 25

Pauses:

17 / 20

Energy & Clarity:

25 / 30

Example flaw:

```text
PACING_TOO_FAST

21.4s – 25.8s

Reference: 3.8 syllables/sec
Participant: 5.1 syllables/sec
Deviation: +34%
```

Use this type of realistic structured data throughout the UI.

---

# 55. FINAL DESIGN TEST

Before finalizing the interface, ask:

### Does this look like an AI-generated dashboard?

If yes:

REMOVE:

- gradients
- excessive rounded cards
- glass
- glowing borders
- random icons
- excessive color
- decorative blobs
- unnecessary shadows

### Does it look too boring?

Add:

- better typography
- stronger hierarchy
- subtle cursor light
- waveform motion
- precise micro-interactions
- elegant transitions
- meaningful data visualization

The target is:

**minimal but alive.**

---

# 56. CRITICAL INSTRUCTION TO STITCH

Do NOT generate only a single dashboard screen.

Generate the **complete modular application system**.

The design must clearly show separate pages/sections for:

- Overview
- Practice
- Assessment
- Arena
- Leaderboard
- Analysis
- Dataset
- Pipeline
- System
- Settings

And separate internal modules for:

- Speech Test
- You vs You
- Interviewer
- News Anchor
- Public Speaking
- Storytelling
- 1v1 Battle
- Debate
- Mimic Party
- Dataset
- Rights / Provenance
- Ingestion
- Alignment
- Features
- Normalization
- Temporal Grounding
- Scoring
- Explainability
- Infrastructure
- DevOps

Do NOT put all of these into one enormous screen.

Use navigation, routes, tabs, drawers and contextual panels appropriately.

---

# 57. IMPORTANT IMPLEMENTATION PHILOSOPHY

The UI should mirror the actual architecture.

Frontend:

```text
Feature
    ↓
Page
    ↓
Components
    ↓
API hooks
    ↓
Backend service
```

Backend:

```text
API
 ↓
Domain Service
 ↓
Processing Worker
 ↓
Storage / Queue
```

Avoid a monolithic frontend.

Avoid a monolithic backend.

Avoid giant files.

Avoid components containing unrelated business logic.

---

# 58. STITCH OUTPUT EXPECTATION

Produce a polished high-fidelity UI system rather than a loose collection of mockups.

The result should include:

- full application shell
- navigation
- reusable component system
- responsive layouts
- analysis workspace
- battle interface
- mimic interface
- dataset management
- pipeline monitoring
- backend/system dashboard
- leaderboard
- settings
- empty states
- loading states
- error states
- realistic demo data
- interaction states

Maintain one coherent visual language across every page.

---

# 59. FINAL VISUAL DIRECTION

The final result should feel like:

> **"A serious scientific speech-analysis product that happens to be fun."**

Not:

> "An AI dashboard generated by an AI."

White background.

Black controls.

Precise typography.

Subtle gray structure.

Minimal accent colors.

Fine borders.

Excellent spacing.

Responsive waveform visualizations.

Interactive transcript.

Meaningful charts.

Tiny motion.

Cursor-reactive ambient light.

Strong information hierarchy.

No visual clutter.

No unnecessary decoration.

No generic AI aesthetics.

The product should look **human-designed, technically credible, modern and competition-ready.**

Build the interface around the core promise:

# Measure how you speak.
# See exactly where you deviate.
# Improve deliberately.
# Compete fairly.