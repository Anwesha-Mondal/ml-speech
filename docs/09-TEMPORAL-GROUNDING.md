# SPEECH ARENA: 09-TEMPORAL-GROUNDING

## 1. Introduction

Temporal Grounding is the process of localizing a detected flaw to a specific, measurable time window within the audio and linking it to the corresponding text in the transcript.

The hackathon explicitly requires: *"Every flaw must carry timestamp range, transcript span... "* (Section 5).

This module sits between Feature Extraction and Explainability. It consumes the aligned text and the normalized acoustic features, and outputs exact `[start_time, end_time]` intervals where deviations occurred.

---

## 2. Deviation Localization Strategies

We cannot simply compare two 3-minute arrays frame-by-frame. The participant will never speak at the exact same speed as the reference. We must align the *time series* before detecting the flaw.

### 2.1 Dynamic Time Warping (DTW)
DTW is the primary algorithm for aligning two sequences that may vary in time or speed. 

*   **Input:** `Reference_F0_Normalized` and `Participant_F0_Normalized`.
*   **Process:** DTW constructs a cost matrix and finds the optimal path that minimizes the distance between the two contours.
*   **Warping Path:** The output is a path `[(ref_index_1, part_index_1), (ref_index_2, part_index_2), ...]`.

### 2.2 Finding the Flaw (The Threshold Mechanism)
Once aligned via DTW, we calculate the absolute difference between the aligned frames.

```python
def locate_flaws(ref_feature, part_feature, dtw_path, threshold, duration_min):
    flaws = []
    current_flaw_start = None
    
    for ref_idx, part_idx in dtw_path:
        delta = abs(ref_feature[ref_idx] - part_feature[part_idx])
        
        if delta > threshold:
            if current_flaw_start is None:
                current_flaw_start = part_idx
        else:
            if current_flaw_start is not None:
                # Flaw ended. Check if it lasted long enough to be significant.
                duration = (part_idx - current_flaw_start) * FRAME_DURATION_MS
                if duration >= duration_min:
                    flaws.append({
                        "start_frame": current_flaw_start,
                        "end_frame": part_idx,
                        "peak_delta": max_delta_in_window
                    })
                current_flaw_start = None
                
    return flaws
```

---

## 3. Grounding Specific Flaw Types

Different flaws require different grounding logic.

### 3.1 Pacing Flaws
*   **Logic:** Do not use DTW. Use the Forced Alignment timestamps.
*   **Method:** Calculate `syllables_per_second` for every 5-second rolling window in the reference and the participant.
*   **Grounding:** If the participant's window exceeds the reference window by > 20%, generate a flaw spanning that 5-second interval.

### 3.2 Pauses (Missing/Misplaced)
*   **Logic:** Compare silence intervals.
*   **Method:** 
    1. Identify all silence > 300ms in the Reference.
    2. Identify all silence > 300ms in the Participant.
    3. Use the transcript alignment to match the pauses to the text (e.g., "Pause after the word 'liberty'").
*   **Grounding:** If the reference paused for 1.5s after "liberty" and the participant paused for 0.1s, generate a `PAUSE_MISSING` flaw bounded to the end timestamp of the word "liberty".

### 3.3 Pitch/Energy Flaws
*   **Logic:** Use the DTW method outlined in Section 2.2.
*   **Thresholds:** Must be tuned during Dataset Engineering (Phase 2). A deviation must be visually obvious on the dashboard charts to warrant generating a flaw, preventing "ghost flaws" that confuse users.

---

## 4. Transcript Span Mapping

A flaw in audio time (e.g., `[12.5s - 14.2s]`) must be mapped back to the text.

**Algorithm:**
1.  Take the `start_time` and `end_time` of the acoustic flaw.
2.  Query the Forced Alignment JSON array (from `06-ALIGNMENT.md`).
3.  Find all words whose `(start, end)` intersect with the flaw's time window.
4.  Extract those words into a `context` string.
5.  Extract the array indices of the first and last word to populate `transcript_start` and `transcript_end`.

**Resulting Payload Fragment:**
```json
{
  "start_time": 12.5,
  "end_time": 14.2,
  "context": "dedicated to the proposition",
  "transcript_start": 14,
  "transcript_end": 17
}
```
This payload is required by the UI to highlight the text in yellow when the flaw marker is clicked on the waveform.

*End of TEMPORAL-GROUNDING.md*
