# SPEECH ARENA: 16-LEADERBOARD

## 1. Introduction

Leaderboards drive engagement. In Speech Arena, leaderboards must be strictly managed to prevent gaming the system and to handle the complexities of versioned scoring algorithms.

---

## 2. Leaderboard Architecture

We cannot have a single global leaderboard. Scores are entirely dependent on the specific Reference Transcript being attempted.

### 2.1 The Hierarchy
1.  **Global Leaderboard (Aggregated):** Ranks users by Total XP or "Elo Rating" across all battles.
2.  **Transcript Leaderboard (Specific):** Ranks the top 100 highest scores for a specific reference (e.g., "JFK Moon Speech - Master Difficulty").
3.  **Friends/Cohort Leaderboard:** Filters the specific transcript leaderboard by the user's social graph.

### 2.2 Elo Rating System (For Battles)
For 1v1 Battles, a simple win/loss counter is insufficient. We implement a standard Elo rating system (similar to Chess).
*   New users start at 1200 Elo.
*   Beating a high-Elo player yields more points than beating a low-Elo player.
*   The Elo rating determines matchmaking in synchronous debate modes.

---

## 3. Anti-Cheat & Versioning

### 3.1 The Versioning Problem
If `ScoringEngine_v1.0` was overly generous, and `ScoringEngine_v2.0` introduces a strict new penalty for misplaced pauses, all old scores on the leaderboard are now invalid.

**Solution:**
*   Leaderboards are hard-locked to a specific `scoring_version`. 
*   When a major version updates, the primary leaderboard resets (Season 2).
*   *Optional:* If the raw audio files are retained in S3, a background cron job can asynchronously re-process all historical top-100 runs through the `v2.0` engine to backfill the new leaderboard.

### 3.2 Anti-Cheat (Audio Replay)
To prevent users from simply submitting a perfect, artificially synthesized audio file or re-submitting the reference audio itself:
1.  **Hash Checking:** Reject any upload where the audio SHA-256 matches the Reference audio hash.
2.  **Synthetic Detection:** Run a lightweight spoofing detector (e.g., ASVspoof models) on high-scoring submissions to flag suspected TTS/AI-generated audio.
3.  **Audit Trail:** The top 10 scores on any leaderboard MUST have their audio files publicly playable by other users. If a user cheats, the community will hear it.

---

## 4. Database Optimization

Leaderboards are read-heavy. Querying `SELECT * FROM Performance WHERE transcriptId = X ORDER BY score DESC` will cripple the PostgreSQL database at scale.

*   **Implementation:** Use **Redis Sorted Sets** (`ZADD`, `ZRANGE`) to maintain the top 1000 scores for every transcript in memory. The PostgreSQL database remains the source of truth, but the UI only queries Redis.

*End of LEADERBOARD.md*
