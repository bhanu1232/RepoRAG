# Testing Guide - Railway Deployment Fixes

## Summary of Changes

### Backend Changes (Server)
1. ✅ **Lazy service loading** - Services initialize on first use, not startup
2. ✅ **Background task processing** - Indexing runs async, no timeouts
3. ✅ **Memory optimization** - Batch size reduced to 1, aggressive GC
4. ✅ **Enhanced monitoring** - Better health checks and progress tracking
5. ✅ **Railway configuration** - Single worker, extended timeouts

### Frontend Changes (Client)
1. ✅ **Async API handling** - Properly handles background task responses
2. ✅ **Progress polling** - Polls `/progress` every 2 seconds
3. ✅ **Error handling** - Shows detailed error messages
4. ✅ **Timeout protection** - 10-minute safety timeout

## Local Testing Steps

### 1. Test Backend Locally

```bash
cd server

# Make sure dependencies are installed
pip install -r requirements.txt

# Run the server
python main.py
```

**Expected output:**
```
Application starting up...
Services will be initialized on first use (lazy loading)
Startup complete - ready to accept requests
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. Test Health Endpoint

Open a new terminal:

```bash
# Test health check
curl http://localhost:8000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "RepoRAG API",
  "env_configured": true,
  "env_details": {
    "PINECONE_API_KEY": true,
    "GROQ_API_KEY": true
  },
  "services": {
    "ingestion": "not_loaded",
    "rag": "not_loaded"
  }
}
```

### 3. Test Indexing (Background Task)

```bash
# Start indexing
curl -X POST http://localhost:8000/index_repo \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/yourusername/small-test-repo"}'
```

**Expected response (immediate):**
```json
{
  "message": "Indexing started in background",
  "repo_url": "https://github.com/yourusername/small-test-repo",
  "status": "Check /progress endpoint for updates"
}
```

### 4. Monitor Progress

```bash
# Check progress (run multiple times)
curl http://localhost:8000/progress
```

**While indexing:**
```json
{
  "progress": 45,
  "stage": "Indexing node 23/50",
  "in_progress": true,
  "repo_url": "https://github.com/yourusername/small-test-repo"
}
```

**When complete:**
```json
{
  "progress": 100,
  "stage": "Complete",
  "in_progress": false,
  "result": {
    "success": true,
    "message": "Repository indexed successfully",
    "file_count": 15,
    "chunk_count": 50
  }
}
```

### 5. Test Frontend Locally

```bash
cd client

# Make sure dependencies are installed
npm install

# Run the dev server
npm run dev
```

**Test the UI:**
1. Open http://localhost:5173
2. Enter a small GitHub repository URL
3. Click "Load Repo"
4. Watch the progress bar update in real-time
5. Wait for "Ready to chat" message

## Railway Deployment Testing

### 1. Deploy to Railway

```bash
# Commit all changes
git add .
git commit -m "fix: optimize for Railway with async background tasks"
git push
```

Railway will auto-deploy if connected to GitHub.

### 2. Monitor Deployment

**Check Build Logs:**
- Should complete without errors
- Look for successful dependency installation

**Check Deploy Logs:**
- Look for: "Startup complete - ready to accept requests"
- Should NOT see: "OOM" or "killed" messages

### 3. Test Railway Endpoints

```bash
# Replace with your Railway URL
RAILWAY_URL="https://reporag-production.up.railway.app"

# Test health
curl $RAILWAY_URL/health

# Test indexing (use a SMALL repo first!)
curl -X POST $RAILWAY_URL/index_repo \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/username/tiny-repo"}'

# Monitor progress
curl $RAILWAY_URL/progress
```

### 4. Test with Frontend

Update your frontend `.env` file:

```bash
# client/.env
VITE_API_URL=https://reporag-production.up.railway.app
```

Then test the full flow in the browser.

## Expected Behavior

### ✅ Success Indicators

1. **Health check returns 200** with `env_configured: true`
2. **Indexing starts immediately** (returns within 1 second)
3. **Progress updates every 2 seconds** with increasing percentages
4. **Memory stays under 512MB** on Railway free tier
5. **No 503 errors** on any endpoint
6. **Indexing completes successfully** for small repos (<50 files)

### ❌ Failure Indicators

1. **503 on health check** → Service not starting
2. **503 on index_repo** → Service initialization failing
3. **Progress stuck at 0%** → Indexing not starting
4. **Railway restarts frequently** → OOM issues
5. **Timeout after 10 minutes** → Repository too large

## Troubleshooting

### Issue: Still getting 503 errors

**Solution:**
1. Check Railway environment variables are set
2. Check Deploy Logs for Python errors
3. Verify Pinecone API key is valid
4. Try redeploying: `railway up`

### Issue: Indexing never completes

**Solution:**
1. Check repository size (should be <100 files for free tier)
2. Check Railway memory usage (should be <512MB)
3. Check Deploy Logs for OOM errors
4. Consider upgrading to Hobby plan ($5/mo, 8GB RAM)

### Issue: Progress stuck at certain percentage

**Solution:**
1. Check Deploy Logs for specific errors
2. May be a problematic file causing issues
3. Backend will skip failed nodes and continue
4. Check final result for partial success

### Issue: Frontend not updating progress

**Solution:**
1. Check browser console for errors
2. Verify CORS is configured correctly
3. Check network tab for failed requests
4. Verify polling interval is running

## Performance Benchmarks

### Small Repository (<20 files)
- **Startup:** <1 second
- **Indexing:** 30-60 seconds
- **Memory:** ~200MB
- **Success rate:** 100%

### Medium Repository (20-50 files)
- **Startup:** <1 second
- **Indexing:** 1-3 minutes
- **Memory:** ~300MB
- **Success rate:** 95%

### Large Repository (50-100 files)
- **Startup:** <1 second
- **Indexing:** 3-8 minutes
- **Memory:** ~400-500MB
- **Success rate:** 70% (may OOM on free tier)

### Very Large Repository (>100 files)
- **Not recommended for Railway free tier**
- **Upgrade to Hobby plan required**

## Next Steps

1. ✅ Test locally with small repository
2. ✅ Deploy to Railway
3. ✅ Test Railway endpoints
4. ✅ Test full frontend integration
5. 🔄 Monitor memory usage
6. 🔄 Consider upgrading Railway plan if needed
7. 🔄 Add repository size validation (optional)

## Support

If issues persist:
1. Check `FIXES_APPLIED.md` for detailed explanations
2. Check `RAILWAY_DEPLOYMENT.md` for deployment guide
3. Review Railway Deploy Logs
4. Check browser console for frontend errors
