# SPEECH ARENA: 14-BATTLES

## 1. Introduction

The multiplayer aspect of Speech Arena transforms it from a dry analytical tool into a compelling gamified platform. 

This document defines the mechanics and architectural requirements for the synchronous and asynchronous "Battle" modes (Section 4).

---

## 2. 1v1 Battle Mechanics (Asynchronous)

The most common battle mode is asynchronous. Player A issues a challenge on a specific transcript. Player B accepts and records their attempt.

### 2.1 The Fairness Problem
If Player A is a male with a naturally loud, deep voice, and Player B is a female with a naturally quieter, higher voice, the raw acoustic features will heavily favor whoever's absolute metrics happen to be closer to the reference. 

**This is unacceptable.** 

### 2.2 The Solution: Dual Normalization
To ensure a fair battle, the Scoring Engine MUST enforce the normalization protocols defined in `08-NORMALIZATION.md`.
1.  Player A's audio is Z-score normalized against Player A's own baseline.
2.  Player B's audio is Z-score normalized against Player B's own baseline.
3.  The system calculates the final scores (1-100) for both players based on their *normalized* deviations from the reference.
4.  The player with the higher score wins.

### 2.3 Battle Database Schema
```prisma
model Battle {
  id              String    @id @default(uuid())
  transcriptId    String
  referenceId     String
  playerAId       String
  playerBId       String
  perfAId         String?   // Links to Performance table
  perfBId         String?
  status          String    // PENDING, COMPLETED, FORFEIT
  winnerId        String?
  createdAt       DateTime
}
```

---

## 3. Debate Mode (Synchronous/Turn-Based)

Debate Mode requires a different architectural approach, focusing on pacing and stamina.

### 3.1 Mechanics
*   **Opening Statement (2 mins):** Evaluated strictly on clarity and pacing (avoiding rushing).
*   **Cross-Examination (1 min):** Evaluated on hesitation fillers. High penalty for "ums" and "ahs".
*   **Rebuttal (1 min):** Evaluated on pitch stability. If the speaker's pitch variance erratically spikes (indicating loss of composure or anger), they are heavily penalized.

### 3.2 NLP / Content Integration (Optional Bonus)
While Track C is about acoustics, integrating the IBM Debater API (Source B-11) to analyze the *content* of the rebuttal adds massive value. The system could score both *Delivery* (Acoustics) and *Relevance* (NLP/Text).

---

## 4. UI/UX for Battles

The dashboard (defined in `13-DASHBOARD.md`) must support a "Split Screen" or "Overlay" mode for battles.

*   **Waveform:** Render Player A's waveform on the top half of the track, and Player B's on the bottom half, mirrored.
*   **Flaw Comparison:** A bar chart showing who accumulated more penalties in which bucket (e.g., "Player A lost on Pacing, but Player B lost on Clarity").
*   **The Share Card:** When a battle ends, the UI generates a dynamic, highly-visual PNG summary card suitable for sharing on social media (e.g., "Alice beat Bob 92 to 85 on the JFK Moon Speech!").

*End of BATTLES.md*


> **Note:** This feature is tagged as POST-MVP. Privacy and consent considerations apply (opt-in only). API dependencies like IBM Debater are dropped.