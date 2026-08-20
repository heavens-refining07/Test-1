## 🚀 Free Deployment on Render (Step-by-Step)

Render provides free hosting with native Docker and WebSocket support.

## Step 1: Put Code on GitHub
1. Create a new repository on [GitHub](https://github.com) (e.g., `moviematch`).
2. Push or upload the required files to your repository:
   - `app/`
   - `static/`
   - `Dockerfile`
   - `requirements.txt`
   - `Procfile`
   - `run.py`

## Step 2: Deploy on Render
1. Go to [https://dashboard.render.com](https://dashboard.render.com) and sign in with GitHub.
2. Click **New +** in the top navigation bar and select **Web Service**.
3. Select and connect your **Test-1** GitHub repository.
4. Deployment settings:
   - **Runtime**: Docker
   - **Instance Type**: Free ($0 / month)
   - **Health Check Path**: Leave blank or set to `/`
5. Under **Environment Variables**, add:
   - `TMDB_API_KEY`: `845bec6c276b668f4048ae57ddb1e541`
   - `ENVIRONMENT`: `production`
6. Click **Deploy Web Service**.

## Step 3: Share Live Link
Within 1–2 minutes, Render will assign your app a live URL (e.g., `https://movie-tinder.onrender.com`).
Share this URL or your room code with friends on any mobile or desktop browser!
