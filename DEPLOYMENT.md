# 🚀 Deployment Guide

This guide covers how to deploy the **RepoRAG** application. We recommend a hybrid approach for the best performance and stability.

## 🏗️ Architecture

- **Frontend (Client):** Deployed on **Vercel** (Best for React/Vite).
- **Backend (Server):** Deployed on **Render** or **Railway** (Best for Python FastAPI with long-running tasks).

> **Why not Vercel for Backend?**
> The backend performs heavy repository indexing which takes time. Vercel Serverless functions have a **10-60 second timeout**, which will cause indexing to fail. Render/Railway allow long-running processes.

---

## 1️⃣ Deploying Backend (Render)

1. **Push your code to GitHub.**
2. Sign up at [render.com](https://render.com).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. **Configure Settings:**
   - **Root Directory:** `server`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. **Environment Variables:**
   Add these in the "Environment" tab:
   - `GROQ_API_KEY`: ...
   - `GEMINI_API_KEY`: ...
   - `PINECONE_API_KEY`: ...
   - `PINECONE_INDEX_NAME`: `reporag-index`
7. Click **Deploy**.
8. **Copy your Backend URL** (e.g., `https://reporag-api.onrender.com`).

---

## 2️⃣ Deploying Frontend (Vercel)

1. Sign up at [vercel.com](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. **Configure Project:**
   - **Framework Preset:** Vite
   - **Root Directory:** `client` (Click "Edit" next to Root Directory and select `client`)
5. **Environment Variables:**
   - Create a file `.env.production` in your `client` folder or add variables in Vercel dashboard:
   - `VITE_API_URL`: Your Render Backend URL (e.g., `https://reporag-api.onrender.com`)
     *(Note: Ensure your code uses this variable. If hardcoded to localhost, update it to use `import.meta.env.VITE_API_URL`)*
6. Click **Deploy**.

---

## 3️⃣ Verification

1. Open your Vercel URL.
2. The Chat UI should load.
3. Try indexing a small repo.
   - If it works, the backend connection is successful!

---

## ⚡ Option 3: Vercel Backend (⚠️ Not Recommended)

You *can* deploy the backend to Vercel, but **indexing will fail** for large repositories due to the 10-second timeout (Hobby Plan).

1. **Create `vercel.json`** inside the `server/` directory:
   ```json
   {
     "builds": [
       {
         "src": "main.py",
         "use": "@vercel/python"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "main.py"
       }
     ]
   }
   ```

2. **Add `requirements.txt`** logic:
   Ensure `requirements.txt` is in `server/`. Vercel automatically installs it.

3. **Deploy:**
   - Import the `server` directory as a separate project in Vercel.
   - Set the Environment Variables.
   - **Warning:** If an API call takes >10s (like `/index_repo`), Vercel will kill it and return a 504 Timeout.
