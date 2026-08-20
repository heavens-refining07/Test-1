# 🎬 MovieMatch - Collaborative Movie Selection Platform

Tinder-style collaborative movie voting web app with real-time multiplayer WebSockets.

---

## 🚀 Free Deployment on Koyeb (Step-by-Step)

Koyeb provides 100% free hosting with native WebSocket support, no cold-start sleeps, and no credit card required.

### Step 1: Put Code on GitHub
1. Create a new repository on [GitHub](https://github.com/new) (e.g. `moviematch`).
2. Push or upload the files in this folder to your repository:
   - `app/`
   - `static/`
   - `Dockerfile`
   - `requirements.txt`
   - `Procfile`
   - `run.py`

### Step 2: Deploy on Koyeb
1. Go to **[https://app.koyeb.com](https://app.koyeb.com)** and sign in with GitHub (Free Tier, no credit card required).
2. Click **"Create Service"** -> Choose **"GitHub"**.
3. Select your `moviematch` repository.
4. Deployment settings:
   - **Builder**: `Dockerfile` (or `Buildpack` — both work automatically)
   - **Instance Type**: `Free (Nano / Eco)` (512MB RAM, 100% Free)
   - **Port**: `8000`
   - **Protocol**: `HTTP` (Koyeb handles SSL/HTTPS & WSS automatically)
5. Under **Environment Variables**, add:
   - `TMDB_API_KEY`: `845bec6c276b668f4048ae57ddb1e541` (or your own TMDB key)
   - `ENVIRONMENT`: `production`
6. Click **"Deploy"**.

### Step 3: Share Live Link
Within 1–2 minutes, Koyeb will give you a public URL (e.g., `https://moviematch-yourname.koyeb.app`).
Share this URL or the 4-digit room code with your friends on any phone or desktop browser!

---

## 💻 Local Development

```bash
pip install -r requirements.txt
python run.py
```
Open [http://localhost:8000](http://localhost:8000)
