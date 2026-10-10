# Authentication and authorization

Every page and API route except `/api/health`, sign-in, registration and the legal documents (`/privacy`, `/terms`, `/cookies`, `/api/legal`) requires a signed-in account. See also [PRIVACY_REVIEW.md](PRIVACY_REVIEW.md). Settings live in [`configs/auth/auth.yaml`](../configs/auth/auth.yaml); the code is in [`backend/auth/`](../backend/auth/) and [`frontend/src/components/auth/`](../frontend/src/components/auth/).

## First-time setup

1. Install and start **MongoDB** (accounts, consent, audit log) and **Redis** (sign-in sessions and leaderboards; on Windows use Memurai). Both are required: without Redis nobody can sign in, and the API answers `503`.
2. Copy `.env.example` to `.env` in the repo root, and `frontend/.env.example` to `frontend/.env`. Both `.env` files are gitignored; every server address and setting lives there and nothing has a fallback in the code. The API refuses to start and names the missing key if one is absent.
3. Start the API. It creates the collections and indexes (including the retention TTL indexes) on first start.

Create the first administrator from the repo root. The password is prompted for and never echoed:

```bash
python -m backend.auth.cli create-admin --email you@example.com --name "Your Name"
```

Other commands:

```bash
python -m backend.auth.cli promote --email teammate@example.com   # make an existing account an admin
python -m backend.auth.cli unlock --email teammate@example.com    # clear a lockout and re-enable
```

Everyone else creates an account at `/register`. Admins manage roles and access at **Users & access** (`/admin`).

## How it works

| Concern | What the app does |
| --- | --- |
| Passwords | scrypt (N=2^17, r=8, p=1, 16-byte salt), stored as `scrypt$n$r$p$salt$key`. Raising the parameters re-hashes each password at its owner's next sign-in. |
| Password rules | 12–128 characters; not on the blocklist (`configs/auth/common_passwords.txt`, including digit-padded variants); no repeated characters, and no run of 5 sequential characters such as `12345` or `qwert`; can't contain the email name or display name, or any 5-character part of them (NIST SP 800-63B: length and blocklist, no composition rules). Checked on the server; the UI mirrors it live. |
| Sessions | 256-bit random token in an `HttpOnly`, `SameSite=Strict`, `Path=/api` cookie. Only its SHA-256 is stored, in Redis (`sa:sess:tok:<hash>`), with a Redis expiry that enforces the 24 h idle timeout and never runs past the 7-day absolute lifetime. Sign-out, password change, disabling or deleting an account delete the session keys at once. Redis down → `503`, never a silent sign-out. |
| CSRF | Every state-changing request needs `X-Requested-With: SpeechArena` (forces a CORS preflight) and, when signed in, the per-session `X-CSRF-Token`. CORS allows credentials only from the configured origins. |
| Brute force | Account locks for 15 minutes after 5 wrong passwords. Per-IP limits: 10 sign-ins per minute, 20 registrations per hour. |
| Enumeration | Wrong password and unknown email return the same message, and unknown emails still run a full scrypt check so timing matches. |
| Password change | Requires the current password, signs out every other session. |
| Roles | `user` and `admin`. Admin endpoints check the role on the server; the UI only hides links. Admins can't demote or disable themselves, and the last active admin can't be removed. Disabling an account signs it out everywhere. |
| Data isolation | Analysis jobs record their owner; another user gets the same `not_found` as for a missing job. Browser-saved analyses and battles are stored per account. |
| Audit log | Sign-ins, failures, lockouts, sign-outs, password changes and admin actions, with IP, at `/admin/audit`. |
| Consent | Sign-up needs two explicit checkboxes (Terms + Privacy, age 16+). Each acceptance is stored with the document version; publishing a new version blocks app endpoints with `403 CONSENT_REQUIRED` until accepted. |
| Your data | `GET /api/privacy/export` (JSON download), `POST /api/privacy/delete-account` (password + `DELETE`). Deletion ends all sessions first (so a Redis outage leaves nothing half-deleted), then removes the account, consent records and leaderboard scores and anonymises audit events. |
| Retention | Sessions are deleted the moment they end (Redis expiry or sign-out); audit events after 90 days (MongoDB TTL index); analysis results after 60 minutes (`configs/privacy/privacy.yaml`). |
| Uploads | Audio only, 50 MB max; per-user hourly limits on analysis, transcription and script generation. |
| Third parties | None at runtime in the browser: fonts are self-hosted and production builds carry a CSP limited to the app and the API. `/docs` (third-party CDN) is off unless `ENABLE_DOCS=1`. |
| Storage | MongoDB: `users` (unique email index), `consent_records`, `audit_events`. Redis: sessions (`sa:sess:*`, prefix in `configs/auth/auth.yaml`). Failed sign-ins are counted with an atomic `$inc`, so parallel guesses can't slip past the lockout. Leaderboards: one Redis sorted set per passage and scoring version (`sa:lb:<version>:<passage>`), holding user IDs and best scores only. |
| Leaderboard | Opt-in (off by default). Scores are computed on the server, only for whitelisted passages, and only ever raised (`ZADD GT`). Names are read from MongoDB at display time for accounts that currently opt in, so opting out or deleting the account hides the name at once even if Redis still holds the ID. Redis down → `503` for the board; analyses still complete. |
| Configuration | Deployment values (MongoDB and Redis URLs, CORS origins, cookie flag, host and port, contact link, API URL for the frontend) are read from gitignored `.env` files only. Thresholds stay in versioned YAML under `configs/`. |
| Headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` on auth routes. |

## Before deploying anywhere public

- Serve over HTTPS and set `COOKIE_SECURE=1` in `.env` so the cookie is never sent over plain HTTP.
- Set `CORS_ORIGINS` in `.env` to the real frontend origin(s), comma-separated.
- Enable authentication on MongoDB and Redis and put the credentials in the `.env` URLs (`mongodb://user:pass@host/…`, `redis://:pass@host:6379/0`). Never bind either to a public interface without it.
- Rate limits and lockout counters for IPs live in process memory: run one API worker, or move the limiter to Redis before scaling out.
- If the API sits behind a reverse proxy, `client_ip()` in `backend/auth/sessions.py` sees the proxy's address. Read the forwarded header only from a proxy you trust.
- Back up the MongoDB database. Redis holds only leaderboard scores; enable persistence (AOF or RDB) if losing them on restart matters.
- Consider closing open registration (`registration.open: false`) for a private deployment.

## Tests

```bash
python -m pytest tests/api -q
```

Tests run against in-memory MongoDB (mongomock) and Redis (fakeredis) with placeholder settings, never your `.env`. The suite (`tests/api/test_auth.py`, `test_privacy.py`, `test_leaderboard.py`) covers hashing, the policy, cookie flags, CSRF, generic errors, lockout, rate limiting, Redis session expiry and outages, session revocation, password change, role checks and audit entries.
