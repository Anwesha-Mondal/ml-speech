# Privacy & risk review (2026-10-10, updated 2026-10-11)

Scope: the web app (`frontend/`), the API (`backend/`) and the data they handle. The user-facing policies are in [`docs/legal/`](legal/) and shown at `/privacy`, `/terms` and `/cookies`. Authentication details are in [SECURITY.md](SECURITY.md).

## What the app collects (data minimisation)

| Data | Kept where | Retention | Needed for |
| --- | --- | --- | --- |
| Email, display name, scrypt password hash, role, leaderboard opt-in | `users` (MongoDB) | Until account deletion | Sign-in |
| Sessions: token hash, IP, user agent, times | Redis (`sa:sess:*`) | Deleted when the session ends (sign-out, 24 h idle, 7 days max) | Staying signed in, device list |
| Security events with IP | `audit_events` | 90 days; anonymised on account deletion | Detecting attacks |
| Agreement records (document, version, time) | `consent_records` | Until account deletion | Proof of consent |
| Leaderboard: user ID and best score per passage (no name, no email) | Redis sorted sets | Until opt-out or account deletion | Rankings, only for users who opt in |
| Recordings | Server memory only; Whisper temp file deleted in `finally` | Not stored | Analysis |
| Analysis results | Server memory | 60 minutes | Showing results |
| Preferences, history | Browser local storage, per account | Only with consent; deleted when consent is withdrawn | Convenience |

Not collected: date of birth (age is a self-declared checkbox), phone, location, analytics, voice identity.

All limits live in [`configs/privacy/privacy.yaml`](../configs/privacy/privacy.yaml).

## Fixed in this review

| Risk | Fix |
| --- | --- |
| Google Fonts loaded on every page, sending visitors' IPs to Google before consent | Fonts self-hosted via `@fontsource` (OFL-1.1); production builds carry a CSP that only allows the app's own origin and the API |
| Analysis history and settings written to browser storage without consent | Cookie banner ("Essential only" and "Allow all" equally prominent, nothing pre-ticked); optional storage written only with consent and deleted on withdrawal; choice recorded server-side for signed-in users |
| No Terms or Privacy Policy, no record of acceptance | Versioned documents in `docs/legal/`; sign-up requires two explicit checkboxes; acceptance stored per version; new versions block app features (server-side) until accepted |
| No way to get or delete one's data | Settings → Download my data (JSON) and Delete account (password + typed DELETE) |
| Sessions and audit logs kept forever | Retention purge at start-up and hourly on sign-in |
| Analysis results kept in memory forever; admins could read anyone's | 60-minute expiry; owner-only access, admins included |
| Whisper temp file left on disk when transcription failed | Deleted in `finally` |
| Unbounded uploads read into memory; any file type accepted | 50 MB cap, audio types only, 415/413 errors; per-user hourly limits on analysis, transcription and generation |
| Raw exception text returned to users | Generic messages; details stay in the server log |
| Lockout response revealed which emails are registered | Unknown emails lock after the same number of attempts |
| `/docs` loaded Swagger UI from a third-party CDN | Disabled unless `ENABLE_DOCS=1` |
| `python backend/api/main.py` listened on all network interfaces | Host and port come from `API_HOST`/`API_PORT` in `.env`; the template uses `127.0.0.1` |
| Hugging Face telemetry | `HF_HUB_DISABLE_TELEMETRY=1` set by default |
| Retention purge crashed inside sign-in (aware vs naive datetimes) | Fixed, with a regression test |
| Retention depended on the API running (2026-10-11) | Sessions expire in Redis and old audit events via a MongoDB TTL index, both without the API; the explicit audit purge stays as a backstop. Ended sessions are no longer kept for 30 days |
| Server addresses and settings hardcoded in code and YAML (2026-10-11) | Moved to gitignored `.env` files with tracked `.env.example` templates; the API and the frontend build refuse to start without them |
| Deleted accounts' IP addresses stayed in audit events (2026-10-11) | IPs are cleared along with name and email on deletion |

## Open risks: need a decision or work before a public launch

1. **The legal text is a starting draft, not legal advice.** It was written to match what the code does, referencing India's DPDP Act 2023 and the GDPR. Have someone qualified review it.
2. **There's no private privacy contact.** The policies point to the public GitHub issue tracker. Add a dedicated email address before launch.
3. **No email verification and no password reset.** Anyone can register with someone else's email, and a user who forgets their password can't get back in. Both need an email service.
4. **Lockout can be abused.** Anyone who knows an email can lock that account for 15 minutes. Consider progressive delays or a CAPTCHA later.
5. **Registration reveals existing emails** (409 "already exists"), limited by the 20-per-hour rate limit. Closing registration (`registration.open: false`) removes it.
6. **Model downloads at runtime.** The server fetches Whisper, Wav2Vec2 and distilgpt2 from Hugging Face on first use. No user data is sent, but for production, pre-download the models and set `HF_HUB_OFFLINE=1`.
7. **Generated practice scripts are unfiltered.** `/api/generate-script` uses distilgpt2, which can produce inappropriate text. Use curated passages for a public demo.
8. **HTTPS is required in production.** Recordings and session cookies travel in plain HTTP on localhost. Set `COOKIE_SECURE=1` (which also turns on HSTS) behind HTTPS.
9. **Clickjacking protection for the frontend** needs a `frame-ancestors 'none'` or `X-Frame-Options: DENY` header from whatever hosts the built site. A CSP `<meta>` tag can't set it. The API already sends both.
10. **Single-process state.** Rate limits and analysis results are in memory, so they reset on restart and don't work across several workers.
11. **The databases aren't encrypted at rest, and local installs run without authentication.** MongoDB holds emails and IPs. Bind MongoDB and Redis to localhost (the default installs do), turn on authentication before any shared deployment, and protect backups.
12. **Raw audio is committed to the repository** (`test.wav` at the root), against AGENTS.md. Remove it, and check its rights.
13. **The classifier source is missing.** `ml/models/flaw_classifier.py` was never committed, so analysis fails on a clean clone.
14. **The age check is self-declared.** That's normal for this kind of service; note it if the audience includes schools.
15. **Leaderboard scores aren't verified against the passage.** A user can pick a ranked passage and read something else. Scores come from the server, but the text read isn't checked. Compare the recognised transcript with the passage before ranking if the board matters.
