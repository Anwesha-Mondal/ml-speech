# SPEECH ARENA: 05-INGESTION

## 1. Introduction

The Ingestion Pipeline is the automated software layer responsible for acquiring raw data, performing quality control, normalizing formats, and persisting the data into the structured schema defined in `04-DATASET-SPEC.md`.

This pipeline bridges the gap between raw web URLs and clean, alignment-ready audio/text pairs.

---

## 2. Ingestion Architecture

The ingestion pipeline runs as a series of asynchronous worker jobs (e.g., Celery tasks) to handle heavy media downloading and processing.

```mermaid
graph TD
    A[Crawler / API Client] --> B[Raw Download Buffer]
    B --> C[Rights Verification Gate]
    C -->|Pass| D[Audio Normalizer]
    C -->|Fail| Z[Quarantine / Reject]
    D --> E[Quality Control (QC)]
    E -->|Pass| F[Transcript Normalizer]
    E -->|Fail| Z
    F --> G[VAD / Segmentation]
    G --> H[Storage (S3 / DB)]
```

---

## 3. Pipeline Stages

### 3.1 Raw Download & Rights Gate
*   **Action:** A script reads `DATA_SOURCES.md`, navigates to the URL, and executes a download (via `yt-dlp`, requests, or native APIs).
*   **Hashing:** Immediately computes `SHA-256` of the binary file.
*   **Rights Check:** Cross-references the source URL with the rules in `03-RIGHTS-PROVENANCE.md`. If the license restricts derivatives and we need to generate flawed variants, the file is rejected or flagged `RESEARCH_ONLY`.

### 3.2 Audio Normalization
Speech processing requires a strict, uniform audio format. Raw MP3s, OGGs, or MP4s are unacceptable for scientific analysis.

*   **Format:** Convert all audio to uncompressed `WAV` or `FLAC`.
*   **Sample Rate:** Resample all audio to exactly **16,000 Hz** (16kHz). This is standard for most ASR and forced-alignment models (e.g., Wav2Vec2).
*   **Channels:** Mixdown all stereo/multi-channel audio to **Mono** (1 channel).
*   **Bit Depth:** 16-bit PCM.

*Implementation Note (FFmpeg):*
```bash
ffmpeg -i input_raw.mp3 -ac 1 -ar 16000 -sample_fmt s16 output_normalized.wav
```

### 3.3 Quality Control (QC)
Before we spend compute on alignment, we must ensure the audio isn't garbage.

*   **SNR Check:** Estimate Signal-to-Noise Ratio. If the audio is completely drowned in static, reject it.
*   **Clipping Check:** Detect if the audio is consistently peaking at 0dBFS (digital clipping). Severely clipped audio destroys MFCC and F0 extraction.
*   **Length Check:** Reject audio shorter than 3 seconds or longer than 30 minutes (to prevent OOM errors during alignment).

### 3.4 Transcript Normalization
Transcripts scraped from the web are dirty. They contain formatting, speaker tags, and non-speech events.

*   **Action:** Strip all HTML. Remove speaker tags (e.g., `[JFK]:`). 
*   **Number Normalization:** Convert "1962" to "nineteen sixty two" or vice versa, depending on the requirements of the forced aligner. (Most modern aligners prefer spoken-form text).
*   **Punctuation:** Retain punctuation! Punctuation is absolutely critical for evaluating `PAUSE_MISSING` and `PAUSE_MISPLACED` flaws.

### 3.5 VAD (Voice Activity Detection) & Segmentation
Historical speeches can contain long periods of silence, applause, or crowd noise.

*   **Action:** Run a robust VAD (e.g., Silero VAD) to detect human speech.
*   **Segmentation:** Split monolithic 30-minute speeches into manageable chunks (e.g., 10 to 30-second phrases) based on VAD boundaries.
*   **Text Mapping:** (Hard Problem) If we chunk the audio, we must chunk the transcript to match. If we cannot reliably align the chunked text to the chunked audio at this stage, we pass the monolithic file to the Forced Alignment stage, which handles the chunking internally.

---

## 4. Variant Generation (The "Flaw" Injector)

To build the Contrastive Dataset, the Ingestion Pipeline must also contain a **Flaw Injector** module.

Since we don't have human actors recording 10,000 flawed speeches, we programmatically synthesize them from the Reference audio using Digital Signal Processing (DSP).

### 4.1 Programmatic Injection Examples
*   **Create PACING_TOO_FAST:** Use `sox` or `librosa.effects.time_stretch` to speed up the audio by 1.5x without altering the pitch.
*   **Create PAUSE_EXCESSIVE:** Randomly split the audio at non-punctuation word boundaries and insert 1.5 seconds of digital silence.
*   **Create PITCH_MONOTONE:** Use a vocoder (e.g., WORLD or librosa) to extract the F0 contour, flatten the variance by 80%, and resynthesize the audio.

**Logging:** Every programmatic injection must write exactly *what* it did, the `severity` level, and the `injected_interval` timestamps to the database schema defined in Section 4 of the Dataset Spec.

*End of INGESTION.md*
