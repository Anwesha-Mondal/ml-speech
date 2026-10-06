# SPEECH ARENA: 06-ALIGNMENT

## 1. Introduction

Forced Alignment is the absolute mathematical bedrock of Speech Arena. Without millisecond-accurate timestamps mapping the textual transcript to the acoustic audio wave, temporal flaw grounding is impossible. 

This document specifies the architecture, model selection, and fallback mechanisms for the Forced Alignment module.

---

## 2. The Alignment Problem

Given an audio file `A` and a transcript `T`, the goal of forced alignment is to generate a sequence of tuples `(word_i, start_time, end_time)`. 

### 2.1 Why Not Just Use ASR?
Standard Automatic Speech Recognition (ASR) systems (like standard Whisper or Google Speech-to-Text) are designed to *predict* what is being said. They often hallucinate, skip words, or heavily smooth timestamps to output clean text blocks. 

In Speech Arena, we already *know* the text (the user is reading a prompt). We need to force the acoustic model to align the known text to the audio, even if the user slurred the word. If we use a generic ASR, and the user mumbles "Gettysburg", the ASR might output "get his bird", ruining the temporal comparison against the reference.

---

## 3. Architecture & Tooling

We employ a dual-engine strategy for forced alignment to maximize accuracy and fault tolerance.

### 3.1 Primary Engine: Wav2Vec2 (CTC Alignment)
*   **Technology:** Deep learning, Connectionist Temporal Classification (CTC).
*   **Implementation:** Hugging Face `transformers` using a fine-tuned `wav2vec2-base-960h` model.
*   **Pros:** Extremely fast, robust to background noise, natively outputs character/frame emission probabilities.
*   **Cons:** Can drift on very long audio files (> 30 seconds).

**CTC Alignment Algorithm (Pseudocode):**
```python
def align_with_wav2vec2(audio_waveform, transcript_string):
    # 1. Normalize transcript to uppercase, no punctuation
    norm_text = normalize_for_ctc(transcript_string)
    
    # 2. Get frame-wise log probabilities from model
    emissions = wav2vec2_model(audio_waveform)
    
    # 3. Create a Trellis matrix (Time x Transcript Characters)
    trellis = build_viterbi_trellis(emissions, norm_text)
    
    # 4. Find the optimal path through the Trellis
    path = backtrack(trellis)
    
    # 5. Group character timestamps into word timestamps
    word_segments = merge_chars_to_words(path, norm_text)
    return word_segments
```

### 3.2 Secondary Engine: Montreal Forced Aligner (MFA)
*   **Technology:** Hidden Markov Models (HMM) + Gaussian Mixture Models (GMM) using Kaldi.
*   **Pros:** The gold standard for phonetic research. Incredibly precise phonetic boundaries. Handles long files well.
*   **Cons:** Very slow, requires complex acoustic/pronunciation dictionaries, hard to deploy in real-time serverless environments.
*   **Usage:** Used primarily during **Dataset Engineering (Phase 2)** to generate the absolute ground-truth labels for the reference audios.

---

## 4. Handling Edge Cases & Errors

### 4.1 The OOV (Out of Vocabulary) Problem
If the transcript contains a word the aligner doesn't know (e.g., a rare name "Xenocrates"), it fails.
*   **Solution (MFA):** We must run a G2P (Grapheme-to-Phoneme) model to generate the phonetic spelling on the fly before aligning.
*   **Solution (Wav2Vec2):** Since Wav2Vec2 operates on raw characters (a,b,c...), it inherently bypasses the OOV dictionary problem.

### 4.2 Disfluencies and Repetitions
If the user stutters: "Four score and... and seven years ago". 
*   The forced aligner is expecting "Four score and seven years ago". 
*   **Fallback Protocol:** If alignment confidence drops below `0.70`, the audio chunk is routed to an intermediate ASR (e.g., Whisper-timestamped) to detect the *actual* spoken text, update the transcript dynamically to reflect the stutter, and re-run forced alignment.

---

## 5. Required Output Schema

Regardless of the engine used, the `AlignmentService` must output a strict JSON array.

```json
[
  {"word": "Four", "start": 0.12, "end": 0.45, "confidence": 0.99},
  {"word": "score", "start": 0.48, "end": 0.85, "confidence": 0.98},
  {"word": "and", "start": 0.86, "end": 1.05, "confidence": 0.95},
  {"word": "seven", "start": 1.05, "end": 1.50, "confidence": 0.97}
]
```
*Note: Pauses are inferred by the gaps between `end` of word N and `start` of word N+1.*

*End of ALIGNMENT.md*
