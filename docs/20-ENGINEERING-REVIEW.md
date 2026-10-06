# SPEECH ARENA: 20-ENGINEERING-REVIEW

> **Status:** Binding. Where this document conflicts with docs 00–19, **this document wins** until the older doc is updated.
> **Scope:** Covers the master prompt (`Speech_Master_Research_Build_Prompt.md`) and `docs/00`–`docs/19`, read line by line.
> **Reviewer role:** Senior developer and ML engineer.
> **Date:** 2026-10-06 (Session 1)

---

## 0. Executive Summary

| Area | Verdict |
| --- | --- |
| Vision, invariants, ethics (00) | **Strong.** Keep it. Remove the psychological wording ("composure", "anger") that slipped into 00 and 14. |
| Track C mapping (01) | Good checklist. Several targets are internally contradictory (IoU 0.85 vs 5 s pacing windows; 60 fps with Recharts). |
| Data sources and rights (02, 03) | Solid protocol. Some sources have licensing traps (ND, SA, broadcaster-owned recordings). |
| Dataset spec (04) | Good taxonomy. Missing items: a filler/transcript rule, per-flaw severity calibration, and a split algorithm. |
| Ingestion and injection (05) | **Has real defects.** Whole-file time-stretch, digital-zero silence, and artifact leakage. |
| Alignment (06) | Reasonable. It should derive ground truth from the injection time-map, not from MFA. |
| Features (07) | A 25 ms window is too short for F0. The hesitation classifier is trained on the wrong dataset. |
| Normalization (08) | **Critical bug:** per-file z-score and min-max erase the monotone and low-energy flaws. |
| Grounding (09) | DTW is unnecessary for the core path because the transcript is identical. 5 s pacing windows wreck IoU. The pseudocode has bugs. |
| Explainability (10) | **Strong.** Deterministic templates and an approved dictionary. Keep it. |
| Scoring (11) | Good idea. Bucket caps aren't enforced, two flaw types are missing, overlapping flaws get double-counted. |
| Benchmarks (12) | Testing FPR on reference-vs-itself is trivial. Ablation results are pre-committed. Stress testing is missing. |
| Dashboard (13) | Good. Swap Recharts (SVG) for a canvas plotter to hit 60 fps. |
| Battles, Mimic, Leaderboard (14–16) | Out of the judged scope. Mimic is a side feature only (per the user's note in doc 15). Public audio playback is a privacy problem. |
| DevOps, Roadmap, Release (17–19) | **Enterprise SaaS, not a hackathon.** EKS, ArgoCD, Kafka and Airflow are overkill. Doc 18 drifts into "pronunciation/native accent" scoring, which contradicts doc 00. |
| **Stress Testing** (30% criterion) | **Absent across all docs**, apart from one line in 01 §4.3. This is the biggest gap. |

---

## 1. Structural and Cross-Document Issues

| # | Issue | Where | Resolution |
| --- | --- | --- | --- |
| S1 | Master prompt is a lossy PDF→MD conversion (sections 4, 5, 7–14 and 17 lost; orphan lists at L130, L253; bare `10` at L316) | Master prompt | docs/00–19 now replace the missing sections. The master prompt stays as historical input only |
| S2 | Docs cite "Section 13 / Requirement 2.8 / Section 12 / Section 5" of the hackathon brief, but **the official Track C brief isn't in the repo** | 07, 08, 09, 10, 11, 15 | Add the official brief as `docs/TRACK-C-BRIEF.md` (verbatim) — **user action** |
| S3 | 01 §3.12 says "follow `19-RELEASE.md`", but 19 covers SaaS GitOps, not hackathon deliverables | 01, 19 | Hackathon deliverables live in `ROADMAP.md` Phase 10 and §9 of this doc |
| S4 | Master prompt §18 planned `17-DEPLOYMENT.md`; the repo has `17-DEVOPS.md` (enterprise AWS) | 17 | Deployment target for the hackathon = **Docker Compose on one machine** (ADR-009) |
| S5 | Stack inconsistency: Python (Celery, mypy) vs Prisma (Node ORM) in 14 | 01, 05, 14 | ADR-008: Python backend with SQLAlchemy; Prisma removed |
| S6 | Section-number references between docs (e.g. "Section 4" for modes, "Section 10" for explainability) point at the *master prompt's* numbering, not doc numbers | 11, 12, 14 | Use doc IDs (`10-EXPLAINABILITY`) going forward |

---

## 2. Critical Technical Findings (must fix before coding)

### C1. Normalization erases the flaws we detect (08, 14, 15, 01 §3.10)
- 08 §2.2 z-scores F0 **per file**, so every clip ends up with std = 1. After that, `PITCH_MONOTONE` ("low F0 variance", 04 §2.3) can't be detected. The explanation "pitch variation decreased by 40%" (00 §2.1) also becomes impossible.
- 08 §3.2 min-max scales energy into [0, 1] per file. That makes `ENERGY_LOW` (04 §2.4) undetectable.

**Resolution → ADR-001 (Two-channel normalization):**
- **Magnitude channel** (used for flaw detection):
  - F0 is converted to **semitones relative to the speaker's median F0**: `st = 12·log2(f0 / median_f0)`. The log scale is already speaker-agnostic: a 2-semitone range means the same thing for a bass and a soprano. **Variance is preserved.** Semitones are mandatory, not optional as 08 §2.3 says.
  - Energy is converted to **dB relative to the recording's integrated speech loudness** (computed over VAD-voiced frames). The absolute level is then used only against the noise floor (SNR) for `ENERGY_LOW`.
- **Shape channel** (used for contour overlays, Mimic, DTW): z-scored semitones and z-scored dB, as in 08.
- Monotone metric = `std_st(participant segment) / std_st(reference segment)`.
- Ablation (12 §4.2) becomes: raw Hz vs semitone-relative vs z-score.
- Both channels and the raw values are persisted (keeps the 08 §4 auditability rule).

### C2. The transcript is identical, so the main path doesn't need DTW (09)
- Reference and participant read the **same `transcript_id`**, so word *i* ↔ word *i* is already known from forced alignment.
- DTW on F0 (09 §2.1) brings in NaN handling for unvoiced frames, warping that *absorbs* the very deviation we want to measure, and non-determinism in tie-breaks.

**Resolution → ADR-002 (Alignment-anchored comparison):**
- The primary unit is **word (and phrase)**. Compare per-word duration, the pause after each word, word-level ST mean/range and word-level dB.
- Run DTW only *inside* a word, or for the Mimic shape score.
- Phrases come from punctuation in the canonical transcript (05 §3.4 already keeps punctuation).

### C3. 5-second pacing windows make IoU > 0.85 impossible (09 §3.1 vs 01 §3.3, 12 §3.1)
A 2 s injected rush detected with a 5 s window gives IoU ≤ 0.4.

**Resolution:** use a **local word-rate ratio**: `r_i = dur_ref(word_i) / dur_part(word_i)`, smoothed over a 3-word window. Flaw regions = maximal runs where `r > 1 + τ_fast` (or `< 1 − τ_slow`), snapped to word boundaries. Keep the 5 s window only as a display aggregate.

### C4. Flaw-injection defects (05 §4)
| Defect | Why it matters | Fix |
| --- | --- | --- |
| `time_stretch` on the whole audio | The flaw interval becomes the whole file. No temporal grounding to test | **Segment-local** injection (word span) with 10–20 ms crossfades |
| librosa phase-vocoder stretch | Phasiness artifacts → the detector learns the artifact | WORLD or Praat PSOLA (`parselmouth`) or Rubber Band |
| Inserted **digital-zero** silence | Trivially detectable (real pauses contain room tone) | Insert **room tone** sampled from the file's own noise floor |
| Only flawed variants are resynthesized | Shortcut learning: "vocoded = flawed" | Run **every reference through the same chain with null parameters** (identity resynthesis) and use *that* as the comparison reference |
| No ground-truth timestamps for the variant | 06 §3.2 uses MFA as "ground truth", but MFA is just another estimator | The injector emits a **time-map** (piecewise-linear ref→variant). Variant word timestamps = reference alignment pushed through the time-map. That's exact ground truth |

### C5. F0 analysis window too short (07 §2)
At 16 kHz, a 25 ms window is 400 samples. pYIN needs about 2 periods of the lowest F0 (65 Hz ≈ 31 ms → ~1024 samples). Also, librosa `pyin` is slow, which threatens the < 30 s/1-min latency target (01 §3.8).

**Resolution → ADR-004:** keep the **10 ms hop** everywhere. Window sizes are per-feature: F0 via **Praat (parselmouth)** autocorrelation, with floor/ceiling set from a speaker pre-pass (default 75–500 Hz). MFCC/RMS use a 25 ms window. Benchmark pYIN vs Praat on the dataset and record the choice in config.

### C6. Hesitation classifier trained on the wrong data (07 §2.6)
LibriSpeech is read audiobooks. It has almost no fillers, and its transcripts leave them out.

**Resolution:** use **rule-based detection first**. Since the transcript is known, a filler = a **VAD-voiced region not covered by any aligned word** (an inter-word gap with speech energy). Optionally confirm with Whisper (with a filler prompt) as a secondary check. Learned detection is a stretch goal; candidate data such as the PodcastFillers dataset needs a license check first.

### C7. Fillers break "same transcript" (04 §2.5 vs 01 §2.2)
**Resolution → ADR-005:** the canonical transcript never changes. Fillers, repetitions and stutters are stored as **insertion events** (`inserted_tokens[]` with times). 06 §4.2 rewrites the transcript dynamically; we narrow that so the rewritten transcript is used **only for alignment**, and the canonical word indices are kept for comparison.

### C8. Split leakage (04 §5)
"Group by transcript" and "speaker-disjoint" can conflict when speakers read several transcripts and transcripts have several speakers.

**Resolution → ADR-006:** build a bipartite graph (speakers ↔ transcripts). Split by **connected components**, with all variants inheriting their parent's split. If a component is too large, sacrifice transcript-disjointness *only* in dev and record it. Note that DSP variants share their reference's speaker, so speaker-disjointness is a property of **references**.

### C9. Stress testing is missing (30% criterion)
**Resolution → ADR-007 and new benchmark suite** (see §6). Perturbations: additive noise (white, babble, café) at SNR 30/20/10/5 dB, reverb (RT60 0.3/0.6/1.0 s), codecs (Opus 16 kbps, MP3 64 kbps, 8 kHz telephone), clipping, gain ±12 dB, mic EQ tilt. Report detection F1, IoU and score drift against clean.

---

## 3. Medium Findings

| # | Finding | Where | Resolution |
| --- | --- | --- | --- |
| M1 | Pause threshold: 250 ms (07) vs 300 ms (09) | 07, 09 | One config key `pause.min_ms = 250` (versioned) |
| M2 | Pacing thresholds absolute (4.5/2.5 syl/s) vs relative (20%) | 04, 09 | **Relative to reference** is primary. Absolute bands only for reference-free modes (later) |
| M3 | Syllables via CMUDict: OOV words, English only | 07 | CMUDict → fallback `pyphen`/heuristic counter. **v1 = English only**; Bengali is future work |
| M4 | wav2vec2-base-960h is English-only, upper-case characters, drifts > 30 s | 06 | Use **torchaudio `MMS_FA` + `torchaudio.functional.forced_align`** (multilingual, maintained). Chunk with VAD at ≤ 30 s |
| M5 | "Alignment confidence > 90%" isn't defined | 01, 06 | Define as the mean per-word CTC posterior; calibrate on clean refs and report the distribution |
| M6 | Clarity proxy relies on aligner confidence alone | 07 | Composite: aligner confidence + CPP + HNR + spectral tilt + articulation rate. Report each component |
| M7 | "Prove MFCC is required for clarity" pre-commits the result | 12 §4.3 | Reframe as a hypothesis and report whatever the ablation shows |
| M8 | Scoring: bucket max penalties not enforced in code; `ENERGY_EXCESSIVE` and `ENERGY_ABRUPT` not in any bucket; overlapping flaws double-count | 11 | Clamp per bucket, add the missing types, merge overlapping same-bucket flaws before penalizing |
| M9 | Mimic "SSIM" is an image metric | 11 §3 | Use normalized DTW distance with an exponential map: `100·exp(−d/d0)` |
| M10 | FPR test = reference vs itself (delta is trivially 0) | 12 §3.3 | FPR = reference vs **another clean reading** of the same transcript (different speaker or take) |
| M11 | Human eval: 3 raters + Pearson on ordinal 1–5 | 12 §5 | Spearman ρ + Krippendorff's α (ordinal) for agreement. ≥ 3 raters |
| M12 | Severity "uniform distribution" with no calibration | 01, 04, 12 | Per-flaw injection-parameter → severity table, then calibrate with human ratings (isotonic regression) |
| M13 | Recharts (SVG) can't hold 60 fps with thousands of points | 01 §3.9, 13 | **uPlot** (canvas) for overlays + **wavesurfer.js v7** (regions plugin) |
| M14 | Reproducibility "same SHA-256 of the result JSON" | 01 §3.11 | Canonical JSON: sorted keys, floats rounded to fixed decimals, no wall-clock or UUID inside the hashed payload. CPU-deterministic inference path |
| M15 | 14 §3.2 relies on the "IBM Debater API", but 02 says it was sunset in 2024. B-11 is a *dataset* | 14, 02 | Drop the API dependency |
| M16 | Psychological claims: "composure", "anger", "lost attention" | 00 §3.3.2, 00 §4.1, 14 §3.1 | Reword to acoustic facts (pillar 1 of 00) |
| M17 | Interview mode needs a "professional standard baseline" with no data source | 00 §3.2.1 | Out of MVP scope |

---

## 4. Rights and Privacy Findings

| # | Finding | Resolution |
| --- | --- | --- |
| R1 | TED/TEDx sources (B-07, B-08, and "well-delivered TED talks" in 00 §3.1.1) are **CC BY-NC-ND**. ND forbids flawed derivatives | `RESEARCH_ONLY`, acoustic benchmarking only. **Never** a reference for variants |
| R2 | B-05/B-06 are **CC BY-SA**. Any derivative dataset must also be CC BY-SA | Track it in the manifest. Bengali isn't in v1 anyway |
| R3 | Federal works are PD in the USA (17 U.S.C. §105), but **broadcaster-made recordings** of presidential speeches may not be | Item-level verification (03 protocol). Prefer NARA, presidential libraries, Miller Center items with explicit statements |
| R4 | B-01 Miller Center `.tgz` is likely **transcripts only** (text) | Verify. Use it for transcripts; get audio per item |
| R5 | Mirror links (`2016.ares-conference.eu`, `c.enwp.org`) | Replace with canonical `commons.wikimedia.org` URLs |
| R6 | Movie monologues (Mimic persona, 00 §4.3) are copyrighted | Not in the bundled library |
| R7 | 16 §3.2: top-10 audio "publicly playable" = publishing biometric data | Opt-in consent only. Default private |
| R8 | 18 §2.1: fine-tuning on user audio, "accent clustering" | Contradicts 00 §7. Removed from the roadmap unless there's explicit consent and an ethics review |
| R9 | User recordings = personal/biometric data (India DPDP Act 2023, GDPR if EU users) | Consent screen, retention TTL, delete-my-data, salted `speaker_hash` |

**Recommended v1 corpus (rights-clean):**
1. **Team-recorded references and acted flaws** with signed consent. These are the only source that gives *multiple speakers per transcript* (needed for normalization fairness and FPR).
2. **LibriVox PD readings** of PD texts (e.g. Gettysburg). Speaker = the volunteer, never the historical figure (03 §4).
3. **Verified PD federal recordings** (NARA, presidential libraries).
4. **LibriTTS-R / LibriSpeech (CC BY 4.0)** for aligner and feature QA and stress-test bases.

---

## 5. Scope Findings

- Judged criteria (01 §4) give **0%** to battles, leaderboards, XP, Elo, anti-cheat, Kafka, EKS, canary releases.
- **The user has decided:** Mimic Party is a side feature and must not affect the main project (doc 15, line 1).
- **Resolution → ADR-010:** the MVP is the *analysis engine + dataset + benchmark + dashboard*. Battles, Mimic and Leaderboard are **post-MVP** (Phase 11), built on the same engine with no changes to core contracts.
- Docs 17, 18 and 19 become **"Post-hackathon production architecture"** reference material.

---

## 6. Additions Required (not in any doc)

1. **Stress-test suite** (§2 C9) → `benchmarks/stress/`.
2. **Injection time-map + identity resynthesis** (§2 C4).
3. **Canonical result serialization** (M14).
4. **Split algorithm** (C8).
5. **Consent and data-retention policy** (R9).
6. **Official Track C brief in the repo** (S2).
7. **Dataset card + system card** (master prompt §16, not yet a doc).
8. **Config registry:** every threshold (pause ms, τ_fast, severity maps, bucket weights) lives in versioned YAML, not in code.

---

## 7. Architecture Decision Records (summary)

| ADR | Decision |
| --- | --- |
| ADR-001 | Two-channel normalization: magnitude (semitone-relative, dB-relative) + shape (z-score) |
| ADR-002 | Alignment-anchored word/phrase comparison. DTW only intra-word or for Mimic |
| ADR-003 | Injector emits a time-map; variant ground truth = transformed reference alignment. Identity resynthesis for references |
| ADR-004 | 10 ms hop global. Per-feature windows. F0 via Praat/parselmouth (pYIN benchmarked) |
| ADR-005 | Canonical transcript immutable. Disfluencies = insertion events |
| ADR-006 | Connected-component splits over the speaker↔transcript graph |
| ADR-007 | Stress-test suite is a first-class benchmark |
| ADR-008 | Python 3.11 backend (FastAPI + SQLAlchemy). TypeScript React frontend. No Prisma |
| ADR-009 | Hackathon deploy = Docker Compose, CPU-only default, optional GPU profile |
| ADR-010 | MVP = engine + dataset + benchmarks + dashboard. Gamification post-MVP |
| ADR-011 | Explanations are deterministic templates (keeps doc 10). No LLM in the scoring or explanation path |
| ADR-012 | All thresholds and weights live in versioned YAML configs. Every result carries all version stamps |

---

## 8. Doc-by-Doc Action List

| Doc | Action |
| --- | --- |
| 00 | Remove "composure"/"lost attention" wording. Mark Interview/Debate as post-MVP. TED → research-only |
| 01 | Replace 5 s-window-incompatible IoU note. Recharts → uPlot. Fix the `19-RELEASE` reference |
| 02 | Fix mirror URLs. Mark B-01 as transcripts. Mark rights status per item |
| 03 | Add `consent` fields for team/user recordings |
| 04 | Add `inserted_tokens`, `time_map_path`, `resynth_chain`, `severity_params`. Add the split algorithm |
| 05 | Rewrite §4 per C4 |
| 06 | MMS_FA primary. Time-map ground truth. Define confidence |
| 07 | Per-feature windows. Praat F0. Rule-based hesitation. Composite clarity |
| 08 | Rewrite per ADR-001 |
| 09 | Rewrite per ADR-002 / C3. Fix the pseudocode bugs (`max_delta_in_window` undefined; open flaw not closed at end of loop; repeated DTW indices) |
| 11 | Clamp buckets. Add missing types. Merge overlaps. Mimic metric |
| 12 | Add the stress suite. Fix the FPR protocol. Spearman + α |
| 13 | uPlot. Keep the rest |
| 14–16 | Tag post-MVP. Privacy fix (R7). Drop the Debater API |
| 17–19 | Re-title as post-hackathon production reference. Hackathon deploy lives in `ARCHITECTURE.md` |

---

## 9. Hackathon Deliverables Checklist (Track C)

- [ ] Public GitHub repo with locked environment (Docker Compose)
- [ ] Custom contrastive dataset, or a legally valid download manifest + rights manifest
- [ ] Interactive dashboard (audio + transcript in → overlays + grounded flaws out)
- [ ] ≤ 6-page technical documentation
- [ ] 3–10 minute demo video
- [ ] Dataset card, system card, benchmark report (incl. stress + ablations)
- [ ] Versioned release tag

*End of 20-ENGINEERING-REVIEW.md*
