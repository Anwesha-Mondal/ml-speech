## SPEECH ARENA

Track C — Contrastive Speech Analytics & Temporal Flaw Grounding

MASTER RESEARCH • DATASET • ENGINEERING • PRODUCT • RELEASE PROMPT

Purpose. A single source-of-truth prompt for researching, designing, implementing, validating, documenting and releasing a competitive speech-intelligence platform built around the Multimodal AI Hackathon 2026 Track C requirements.

Core idea. Measure speech delivery as a temporal signal, compare a participant against an ideal/reference delivery, identify exact flaw regions, explain the acoustic/mathematical reason, and turn the result into training, competition, leaderboard and Mimic Party experiences.

Research snapshot: 5 October 2026

Important: source availability and licensing can change. Re-check the live source and exact asset license before redistribution.


## 1. MASTER BUILD PROMPT

You are the lead research engineer, ML engineer, data engineer, backend engineer, frontend engineer, product architect, QA engineer and technical writer for Speech Arena.

Build a research-grade, reproducible and explainable speech-performance platform based on contrastive speech analytics and temporal flaw grounding. The scientific requirements come from Multimodal AI Hackathon 2026 Track C. Do not turn this into a generic speech-to-text application.

The central dataset must contain reference/ideal deliveries and intentionally flawed mirrors of the same linguistic content, with a severity gradient from almost perfect to severely flawed. External datasets are supporting resources; they do not automatically become our custom contrastive dataset.

The system must perform forced alignment, extract acoustic/temporal features, normalize speaker-dependent variation, detect temporal deviations, explain them causally in human-readable language, and generate transparent rubric-based scores. The same engine must support public speaking, interviews, anchoring, debate, creator/influencer formats, self-battle, 1v1 battle, team battle, leaderboards and Mimic Party.

## 2. Track C requirements to preserve

- Custom paired good/bad speech dataset using the same transcripts.

- Bad spectrum from egregiously wrong to almost perfect.

- Accurate temporal labels and paired recordings.

- Forced alignment from transcript to audio.

- FFT, MFCC, pitch/F0, speech rate, pauses, energy and vocal-clarity features.

- Temporal grounding of exact flaw start/end regions.

- Mathematical delta translated into structured causal explanation.

- Interactive dashboard accepting audio + transcript.

- Time-series baseline/participant overlay with highlighted flaws.

- Speaker-agnostic normalization of pitch and energy.

- Reproducibility across runs and environments.

- GitHub, custom dataset, dashboard, ≤6-page technical documentation and 3–10 minute demo.

## 3. Judging priorities

| Area | Weight | Engineering priority |
| --- | --- | --- |
| Data Engineering & Stress Testing | 30% | Clean paired data, temporal labels, robust flaw gradient. |
| Causal Explainability & Temporal Grounding | 25% | Accurate timestamps and mathematical-to-human rationale. |
| Feature Extraction | 20% | Rigorous acoustic processing and stress-point detection. |
| Visualization & Dashboard | 15% | Usable time-series overlays and explanations. |
| Reproducibility & Code Quality | 10% | Deterministic, documented, deployable system. |


## 6. DATASET STRATEGY

Do not download a huge collection and call it the final dataset. The challenge requires a custom contrastive corpus. External corpora are inputs to a controlled data-engineering pipeline.

## 6.1 Dataset families

- Reference corpus: high-quality public performances with verified provenance.

- Contrastive corpus: same transcript + controlled flaws + severity ladder.

- Acoustic benchmark corpora: LibriSpeech/LibriTTS/MLS/Bengali/TEDx for alignment, normalization and feature QA.

- Content/rhetorical resources: IBM Debate Speeches, IBM Debater resources, emphasis/rhetorical material.

- Mimic corpus: reference performance → participant reproduction, evaluated by normalized delivery-pattern similarity.

- Self-improvement corpus: repeated user attempts with stable task/transcript IDs.

## 6.2 Flaw taxonomy

- Too fast / too slow / irregular pacing

- Excessive, missing or misplaced pauses

- Monotone / excessive pitch movement / pitch instability

- Low / excessive / abruptly changing energy

- Weak / misplaced / excessive emphasis

- Reduced articulation / clarity / mumbling

- Fillers / hesitation

- Uneven phrase timing / cadence inconsistency

- Mixed multi-flaw variants

- Near-perfect control variants

## 6.3 Severity

Use a continuous or ordinal severity scale. Example: 0.0 ideal; 0.1–0.2 near-perfect; 0.3–0.5 mild/moderate; 0.6–0.8 strong; 0.9–1.0 severe. Store the exact injection method and affected region.

## 6.4 Record schema

identity: sample_id, parent_id, speaker_hash, transcript_id, version

source: provider, URLs, title, speaker, performance/recording dates, provenance

rights: license, jurisdiction, redistribution, derivatives, commercial use, verification timestamp

audio: file, codec, sample rate, channels, duration, SHA-256

transcript: raw/normalized text, source, normalization version

alignment: word/phoneme/phrase timestamps, method, confidence

variant: reference/flawed, flaw type, severity, injected interval

features: F0, energy, rate, pauses, MFCC, FFT/spectral, clarity proxies

annotations: human labels, confidence, agreement, explanation

split: train/dev/test, speaker-disjoint flag, leakage group


- LibriVox states that its Gettysburg Address recordings are public domain in the USA; the recording is a volunteer reading, not Abraham Lincoln's original voice.

Important source-discipline rule: if a page could not be independently verified during research, mark it UNVERIFIED rather than inventing metadata. This applies especially to individual archive records whose pages are inaccessible or sparse.


## 15. EVALUATION & BENCHMARKS

## Dataset metrics

- reference speakers

- transcripts

- contrastive variants

- flaw/severity coverage

- domain/language coverage

- alignment confidence

- annotation agreement

- rights completeness

## System metrics

- temporal boundary error / IoU

- flaw classification precision/recall/F1

- severity agreement/correlation

- speaker-disjoint generalization

- false-positive rate on clean speech

- score correlation with human ratings

- repeated-run reproducibility

- latency/throughput

## Ablations

- F0 only vs multi-feature

- with/without pauses

- MFCC/FFT contribution

- speaker normalization on/off

- alignment quality impact

- single-feature vs multi-feature detector

- rule-based vs learned explanation

- window-size sensitivity

## Human evaluation

Use human raters to validate severity, scoring, explanations and subjective delivery categories. Record agreement rather than pretending subjective judgments are absolute truth.


## 16. REPOSITORY & RELEASE STRUCTURE

- ├── apps/ frontend

- ├── services/ API + workers

- ├── packages/ schemas/utilities

- ├── datasets/ manifests, references, contrastive, annotations, rights

- ├── pipelines/ ingestion, alignment, features, normalization, grounding, scoring

- ├── benchmarks/ evaluation + ablations

- ├── experiments/ reproducible experiment configs

- ├── docs/ research + engineering docs

- ├── scripts/ acquisition/validation helpers

- ├── tests/ unit/integration/data-quality tests

- ├── configs/ versioned configuration

- ├── docker/ reproducible runtime

- └── README.md

## speech-arena/

## Release artifacts

- GitHub repository.

- Custom dataset or legally valid public-download manifest.

- Interactive dashboard.

- Technical documentation ≤6 pages for the hackathon.

- 3–10 minute YouTube demonstration.

- Dataset card + rights/provenance manifest.

- Model/system card.

- Benchmark report.

- Locked reproducible environment/container.

- Versioned release tag.

## Version every result

Every score/result must identify dataset_version, feature_version, alignment_version, model_version, scoring_version, code_commit and environment version.


- XP/ranks

- Self-battle

- 1v1

- Team battle

- Leaderboards

## Phase 6 — Mimic Party

- Reference library

- Pattern similarity

- Party rounds

- Similarity explanations

## Phase 7 — Release

- Freeze dataset

- Full benchmark

- Rights/security/privacy checks

- Containerize

- Write ≤6-page technical doc

- Record demo

- Tag release


## 18. FUTURE MULTI-MD SPLIT

After research, convert this master PDF into focused repository documents:

README.md — Overview + quickstart docs/00-VISION.md — Product vision and modes docs/01-TRACK-C-REQUIREMENTS.md — Challenge-to-implementation mapping docs/02-DATA-SOURCES.md — All sources and acquisition status docs/03-RIGHTS-PROVENANCE.md — Licensing and provenance docs/04-DATASET-SPEC.md — Dataset schema, taxonomy, severity, splits docs/05-INGESTION.md — Acquisition and validation docs/06-ALIGNMENT.md — Forced alignment docs/07-FEATURES.md — Acoustic feature engineering docs/08-NORMALIZATION.md — Speaker-agnostic normalization docs/09-TEMPORAL-GROUNDING.md — Deviation localization docs/10-EXPLAINABILITY.md — Mathematical → human explanation docs/11-SCORING.md — Rubrics and formulas docs/12-BENCHMARKS.md — Metrics and ablations docs/13-DASHBOARD.md — UI/UX docs/14-BATTLES.md — Competitive modes docs/15-MIMIC-PARTY.md — Mimic system docs/16-LEADERBOARD.md — Ranking docs/17-DEPLOYMENT.md — Deployment docs/18-REPRODUCIBILITY.md — Versioning docs/19-RELEASE.md — Release checklist

## 19. FIRST ACTION

- 1 Create the repository and source registry.

- 2 Add every supplied URL from this PDF.

- 3 Verify exact asset-level rights.

- 4 Select 3–5 high-confidence reference speeches.

- 5 Select one short transcript for the first controlled experiment.

- 6 Implement forced alignment + feature extraction.

- 7 Create controlled flaws with explicit labels and severity.

- 8 Implement temporal grounding and transparent scoring.

- 9 Build the first analysis dashboard.

10

First milestone: one speech → one controlled flawed version → exact temporal flaw → acoustic evidence → mathematical delta → human explanation → score.

Only then scale the dataset and add battles, leaderboards and Mimic Party.

## END OF MASTER PROMPT

External sources must be re-verified at acquisition/release time.
