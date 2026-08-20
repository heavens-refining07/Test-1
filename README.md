# 🎬 Movie Match (Movie Tinder)

A real-time, interactive web application that allows friends to swipe on movies together like Tinder and find a mutual movie match instantly.

---

## 🛠️ Tech Stack

* **Backend:** Python 3.10+, FastAPI, WebSockets, Uvicorn
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla ES6)
* **External API:** TMDB (The Movie Database) API for movie metadata and genres
* **Containerization:** Docker
* **Deployment:** Render

---

## ✨ Features

* **Real-time Syncing:** Instant room creation and live voting updates using WebSockets.
* **Movie Discovery:** Background movie caching and genre filtering powered by TMDB API.
* **Instant Match Alert:** Notifies room members immediately when a mutual match is made.

---

## 🚀 Free Deployment on Render (Step-by-Step)

Render provides free web hosting with native Docker and WebSocket support.

### Step 1: Push Code to GitHub
Ensure all project files and directories are present in your repository:
* `app/`
* `static/`
* `Dockerfile`
* `requirements.txt`
* `Procfile`
* `run.py`

### Step 2: Deploy on Render
1. Go to [Render Dashboard](https://dashboard.render.com) and sign in with GitHub.
2. Click **New +** in the top navigation bar and select **Web Service**.
3. Select and connect your **Test-1** GitHub repository.
4. Set configuration parameters:
   * **Runtime:** Docker
   * **Instance Type:** Free ($0 / month)
   * **Health Check Path:** Leave blank or set to `/`
5. Under **Environment Variables**, add:
   * `TMDB_API_KEY`: `845bec6c276b668f4048ae57ddb1e541`
   * `ENVIRONMENT`: `production`
6. Click **Deploy Web Service**.

### Step 3: Share Live Link
Within 1–2 minutes, Render will assign your app a live URL (e.g., `https://movie-tinder.onrender.com`). Share this URL with friends on any desktop or mobile browser!
