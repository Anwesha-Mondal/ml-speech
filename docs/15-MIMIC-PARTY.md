# this is just a side fun activity feature and does not appear in the main features which are required and should'nt affect the main project
# SPEECH ARENA: 15-MIMIC-PARTY

## 1. Introduction

Mimic Party is the most restrictive and strictly defined game mode in the platform. The hackathon instructions (Section 4 and 14) explicitly mandate what this mode is, and more importantly, what it *cannot* be.

---

## 2. The Golden Rule of Mimic Party

**MIMIC PARTY IS NOT A VOICE CLONING TOOL.**

If the judges suspect that the platform evaluates "Biometric Voice Identity" (e.g., scoring a user higher because they physically sound exactly like Barack Obama's voice timbre), the project will be disqualified on ethical grounds related to deepfakes.

**Mimic Party strictly evaluates *Delivery Patterns*:**
1.  Cadence (Timing of words)
2.  Pause Placement
3.  Emphasis (Pitch and Energy Contours)

---

## 3. The DTW Similarity Algorithm

Because we are ignoring timbre (MFCCs) and absolute pitch, the deduction-based scoring model (`11-SCORING.md`) is replaced by a structural similarity model.

### 3.1 Step-by-Step Execution
1.  **Extract & Normalize:** Extract F0 and RMS Energy from both Reference and Participant. Z-score normalize both.
2.  **Dynamic Time Warping (DTW):** Run DTW to align the normalized Participant contour to the Reference contour.
3.  **Distance Calculation:** Calculate the Euclidean distance between the aligned, normalized contours.
4.  **Score Conversion:** Map the DTW distance to a 0-100 score. (e.g., `Score = max(0, 100 - (Distance * Scaling_Factor))`).

### 3.2 Visualizing the Game
The UI for Mimic Party is different from the main dashboard. It resembles a rhythm game (like Rock Band or Guitar Hero).

*   **The Target Line:** The reference's normalized pitch contour is drawn across the screen as a thick, glowing line.
*   **The Player Line:** As the player speaks, their normalized pitch contour is drawn over the target line in real-time (or near real-time post-processing).
*   **Feedback:** If the player's line stays within a visual "tolerance band" of the reference line, they accumulate points. If they deviate, the line turns red and a multiplier drops.

---

## 4. The "Style Transfer" Fallacy

Do NOT attempt to use Voice Conversion (VC) models to make the participant sound like the reference. The goal is to see how well the participant's *natural voice* can mimic the *musical melody* of the reference speech.

### 4.1 Required Ablation Proof
The final submission must include documentation proving that the Mimic Party algorithm is blind to identity.
*   **Test:** Run the algorithm using Audio A (Speaker 1, perfect delivery) and Audio B (Speaker 2, exact same delivery generated via synthetic voice). 
*   **Result:** The Mimic score MUST be 100, proving that the change in speaker identity did not lower the score.

*End of MIMIC-PARTY.md*
