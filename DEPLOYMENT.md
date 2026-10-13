# Speech Guru: Production Deployment Guide (Vercel + Render)

This guide walks you through deploying **Speech Guru** to production with:
- **Frontend** on **Vercel** (`https://<your-app>.vercel.app`)
- **Backend API & ML Engine** on **Render** (`https://<your-api>.onrender.com`)
- **Database** on **MongoDB Atlas** (Free M0 Shared Tier)

---

## Architecture Overview & Error Prevention

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│        Vercel (Frontend)        │                 │        Render (Backend)         │
│  https://<your-app>.vercel.app  │                 │  https://<your-api>.onrender.com│
│                                 │                 │                                 │
│  - React 19 + Vite 8 SPA        │  CORS + Cookies │  - FastAPI + Python 3.11        │
│  - SPA Routing via vercel.json  ├────────────────►│  - Wav2Vec2 + Classical DSP     │
│  - credentials: 'include'       │  (SameSite=None)│  - MongoDB Atlas Session Store  │
│  - VITE_API_URL pointing to     │                 │  - CORS configured for Vercel   │
│    Render backend               │                 │                                 │
└─────────────────────────────────┘                 └────────────────┬────────────────┘
                                                                     │
                                                                     ▼
                                                    ┌─────────────────────────────────┐
                                                    │     MongoDB Atlas (Cloud M0)    │
                                                    │ accounts, sessions, leaderboards│
                                                    └─────────────────────────────────┘
```

### Key Error-Prevention Features Configured
1. **Zero Cookie Drops**: `COOKIE_SAMESITE=none` and `COOKIE_SECURE=1` ensure browser cross-origin requests (`vercel.app` ➔ `onrender.com`) persist login sessions.
2. **Wildcard Vercel Branch Support**: `CORS_ORIGIN_REGEX=https://.*\.vercel\.app` automatically authorizes production, staging, and PR preview deployments on Vercel without breaking CORS.
3. **No 404s on Refresh**: `vercel.json` provides client-side SPA fallback routing so refreshing `/sandbox` or `/practice/interview` loads cleanly.
4. **Render Free-Tier Cold-Start Handling**: Client timeouts have been extended to 30s with automatic exponential retry, preventing premature timeout errors while Render wakes up.
5. **Fast Cloud CPU Builds**: `render_build.sh` installs lightweight CPU-only PyTorch wheels (~180MB) instead of 2.5GB CUDA packages, preventing out-of-memory build failures on Render.

---

## Step 1: Set Up Free Cloud MongoDB (MongoDB Atlas)

Render does not include a free persistent database, so a cloud MongoDB cluster is required:

1. Sign up or log in at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a **New Cluster** and select the **M0 Free Shared Tier**.
3. Under **Security ➔ Database Access**:
   - Click **Add New Database User**.
   - Choose **Password Authentication**, set a username (e.g. `speech_admin`) and a strong password.
   - Set privileges to **Read and write to any database**.
4. Under **Security ➔ Network Access**:
   - Click **Add IP Address**.
   - Select **Allow Access From Anywhere** (`0.0.0.0/0`) so Render servers can connect dynamically.
5. Under **Deployment ➔ Database**:
   - Click **Connect ➔ Drivers (Python)**.
   - Copy the connection string. It looks like:
     ```
     mongodb+srv://speech_admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
     ```
   - Replace `<password>` with your database user password.

---

## Step 2: Deploy Backend to Render

### Method A: Web Service via Dashboard (Recommended)

1. Push your repository to GitHub.
2. Sign in to [Render](https://dashboard.render.com/).
3. Click **New + ➔ Web Service**.
4. Connect your GitHub repository (`pushkarverse/orcter` or your fork).
5. Configure the service settings:
   - **Name**: `speech-guru-api` (or your choice)
   - **Region**: Choose a region close to your users (e.g. `Ohio (US East)` or `Frankfurt`)
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     chmod +x render_build.sh && ./render_build.sh
     ```
   - **Start Command**:
     ```bash
     uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type**: `Free`
6. Scroll down to **Environment Variables** and add the following:

| Key | Value | Explanation |
| --- | --- | --- |
| `PYTHON_VERSION` | `3.11.9` | Matches Python requirement |
| `MONGODB_URI` | `mongodb+srv://speech_admin:PASSWORD@...` | Your Atlas connection string |
| `MONGODB_DB` | `speech_guru` | Database name |
| `CORS_ORIGINS` | `https://<your-project>.vercel.app` | Your Vercel frontend URL (update once known) |
| `CORS_ORIGIN_REGEX` | `https://.*\.vercel\.app` | Auto-allows all Vercel previews & production |
| `COOKIE_SECURE` | `1` | Enables Secure flag for HTTPS |
| `COOKIE_SAMESITE` | `none` | Allows cross-origin session cookies from Vercel |
| `API_HOST` | `0.0.0.0` | Listen address |
| `API_PORT` | `10000` | Port default |
| `APP_URL` | `https://<your-project>.vercel.app` | Base web app URL for password reset links |
| `PASSWORD_RESET_DELIVERY` | `none` | Link delivery channel |
| `PRIVACY_CONTACT_URL` | `https://github.com/pushkarverse/orcter/issues` | Legal/contact URL |
| `ENABLE_DOCS` | `0` | Set `1` if you want `/docs` Swagger UI enabled |
| `HF_HUB_DISABLE_TELEMETRY` | `1` | Disables HF analytics pings |

7. Click **Create Web Service**.
8. Once deployment finishes and status turns to **Live**, copy your Render URL:
   `https://speech-guru-api.onrender.com`

---

## Step 3: Deploy Frontend to Vercel

1. Sign in to [Vercel](https://vercel.com/).
2. Click **Add New... ➔ Project**.
3. Import your GitHub repository.
4. Configure Project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Leave as `./` (or select `frontend` if deploying frontend alone)
   - **Build Command**: Default (`npm run build`)
   - **Output Directory**: Default (`frontend/dist` or `dist`)
5. Under **Environment Variables**, add:

| Key | Value | Explanation |
| --- | --- | --- |
| `VITE_API_URL` | `https://speech-guru-api.onrender.com` | **Your Render backend URL without trailing slash** |

6. Click **Deploy**.
7. Vercel will install dependencies, compile TypeScript, run Vite build, and provide your live URL:
   `https://<your-project>.vercel.app`

---

## Step 4: Final Connection Sync

Once you have your live Vercel URL (e.g. `https://speech-guru.vercel.app`):

1. Go back to your [Render Dashboard](https://dashboard.render.com/) ➔ `speech-guru-api` ➔ **Environment**.
2. Verify or update:
   - `CORS_ORIGINS` = `https://speech-guru.vercel.app`
   - `APP_URL` = `https://speech-guru.vercel.app`
3. Click **Save Changes** (Render will automatically redeploy in ~15 seconds).

---

## Verification & Sanity Checklist

Run through these checks to ensure complete error-free operation:

- [ ] **Health Endpoint**:
  Visit `https://speech-guru-api.onrender.com/api/health`.
  Expected response:
  ```json
  {"status":"ok","services":{"mongodb":"up"}}
  ```
- [ ] **Frontend Status Pill**:
  Open your Vercel site. The top-right API status indicator should show a green dot with low latency.
- [ ] **SPA Route Refresh**:
  Navigate to `/practice/interview` or `/sandbox` and press **F5 (Refresh)**. The page must reload smoothly without a 404 error (guaranteed by `vercel.json`).
- [ ] **Authentication & Sessions**:
  1. Click **Sign In** ➔ **Create an account**.
  2. Register a new user.
  3. Verify that your profile displays your name immediately.
  4. Refresh the page; verify that you remain signed in (guaranteed by `COOKIE_SAMESITE=none` + `COOKIE_SECURE=1`).
- [ ] **Audio Analysis**:
  Open the Sandbox, record 5-10 seconds of speech, and click **Analyze Speech**. Verify the job completes and renders the contrastive radar chart and acoustic flaws.
