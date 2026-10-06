# Agent Rules: Speech Arena

These rules apply to every AI agent session in this repository.

## 1. Session protocol (mandatory)
1. **At the start of every session**, read `SESSION_LOG.md` (Quick State + Decision Register + the latest entry) before doing anything else. Then skim `ROADMAP.md` → "Current Status".
2. **At the end of every session**, or after any significant milestone, append a new entry to `SESSION_LOG.md` using the template at the bottom of that file. Also:
   - update the **Quick State** table,
   - add any new decisions to the **Decision Register** (next `D-xxx` ID),
   - tick completed boxes and update "Current Status" in `ROADMAP.md`.
3. Never delete or rewrite past log entries. Correct them by adding a new entry.

## 2. Source-of-truth precedence
Latest `SESSION_LOG.md` decisions > `docs/20-ENGINEERING-REVIEW.md` > `PRD.md` / `ARCHITECTURE.md` > `docs/00`–`19` > `Speech_Master_Research_Build_Prompt.md`.

## 3. Engineering rules
- Work phase by phase as `ROADMAP.md` lays out; finish M1 (the vertical slice) before scaling.
- Every threshold and weight goes in versioned YAML under `configs/`. No magic numbers in code.
- Core pipeline functions are pure and deterministic, with fixed seeds; results are serialized canonically.
- No LLMs in the scoring or explanation path.
- No psychological or emotional claims in user-facing text. Report acoustic facts only.
- Never commit raw audio, model weights or personal recordings. Every asset needs a rights manifest.
- Python: typed (mypy), ruff, pytest. TypeScript: strict mode.
- Keep existing comments and docstrings that are unrelated to your change.
