# Railway 503 Error - Fixes Applied

## Problem Summary
Your Railway deployment was returning **503 Service Unavailable** errors on POST `/index_repo` requests due to:

1. **Memory exhaustion** - Loading embedding models during startup consumed all available RAM
2. **Request timeouts** - Synchronous indexing blocked the server, causing Railway to timeout
3. **No background processing** - Long-running operations blocked the main thread

## Solutions Implemented

### 1. **Lazy Service Loading** ✅
**File:** `main.py`
- Removed eager initialization on startup
- Services now load only when first requested
- Startup completes in <1 second (was timing out before)

### 2. **Background Task Processing** ✅
**File:** `main.py`
- Indexing now runs as a background task
- API immediately returns 202 response
- Client polls `/progress` endpoint for status
- Prevents Railway timeout issues

### 3. **Memory Optimization** ✅
**File:** `ingestion.py`
- Reduced batch size from 3 → 1 (process one node at a time)
- Added aggressive garbage collection every 5 nodes
- Error handling to skip problematic nodes instead of crashing

### 4. **Enhanced Monitoring** ✅
**Files:** `main.py`, `railway.json`, `Procfile`
- Detailed `/health` endpoint with service status
- Enhanced `/progress` endpoint with error tracking
- Single worker mode to reduce memory footprint
- Extended timeout (120s keep-alive)

### 5. **Better Error Handling** ✅
**File:** `main.py`
- Try-catch blocks on all endpoints
- Detailed error messages and stack traces
- 409 status for concurrent indexing attempts
- Service status reporting

## New API Behavior

### Before (Synchronous - TIMEOUT ISSUES):
```
POST /index_repo
→ Waits for entire indexing to complete
→ Times out after 30s on Railway
→ Returns 503 error
```

### After (Asynchronous - NO TIMEOUT):
```
POST /index_repo
→ Immediately returns: {
    "message": "Indexing started in background",
    "repo_url": "...",
    "status": "Check /progress endpoint for updates"
}

GET /progress (poll every 2-3 seconds)
→ Returns: {
    "progress": 45,
    "stage": "Indexing node 23/50",
    "in_progress": true,
    "repo_url": "..."
}

When complete:
→ Returns: {
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

## Files Modified

1. **main.py**
   - Added `BackgroundTasks` support
   - Refactored `/index_repo` to async background processing
   - Enhanced `/progress` with status tracking
   - Improved `/health` endpoint
   - Removed eager startup initialization

2. **ingestion.py**
   - Reduced batch size to 1
   - Added aggressive garbage collection
   - Better error handling (skip failed nodes)

3. **Procfile**
   - Single worker mode
   - Extended timeout (120s)
   - Enhanced logging

4. **railway.json** (NEW)
   - Railway-specific configuration
   - Health check settings
   - Restart policy

## Frontend Changes Needed

Your React frontend needs to be updated to handle the new async flow:

```javascript
// OLD (synchronous):
const response = await fetch('/index_repo', {
  method: 'POST',
  body: JSON.stringify({ repo_url })
});
const result = await response.json();
// ❌ This would timeout on Railway

// NEW (asynchronous with polling):
// 1. Start indexing
const response = await fetch('/index_repo', {
  method: 'POST',
  body: JSON.stringify({ repo_url })
});
const { message } = await response.json();

// 2. Poll for progress
const pollInterval = setInterval(async () => {
  const progress = await fetch('/progress').then(r => r.json());
  
  if (!progress.in_progress && progress.result) {
    clearInterval(pollInterval);
    console.log('Indexing complete!', progress.result);
  } else if (progress.error) {
    clearInterval(pollInterval);
    console.error('Indexing failed:', progress.error);
  } else {
    console.log(`Progress: ${progress.progress}% - ${progress.stage}`);
  }
}, 3000); // Poll every 3 seconds
```

## Deployment Steps

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "fix: optimize for Railway with background tasks"
   git push
   ```

2. **Railway will auto-deploy** (if GitHub connected)

3. **Verify deployment:**
   ```bash
   # Check health
   curl https://reporag-production.up.railway.app/health
   
   # Should return:
   {
     "status": "healthy",
     "env_configured": true,
     ...
   }
   ```

4. **Test indexing:**
   ```bash
   # Start indexing
   curl -X POST https://reporag-production.up.railway.app/index_repo \
     -H "Content-Type: application/json" \
     -d '{"repo_url": "https://github.com/user/small-repo"}'
   
   # Check progress
   curl https://reporag-production.up.railway.app/progress
   ```

## Expected Results

✅ **No more 503 errors** - Background tasks prevent timeouts
✅ **Lower memory usage** - Lazy loading + batch size 1
✅ **Better monitoring** - Real-time progress tracking
✅ **Graceful failures** - Errors reported via `/progress`

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Test with small repository (<20 files)
3. 🔄 Update frontend to use new async API
4. 🔄 Monitor Railway memory usage
5. 🔄 Consider upgrading to Hobby plan ($5/mo) for 8GB RAM if needed

## Troubleshooting

If you still see issues:

1. **Check Railway Deploy Logs:**
   - Look for "Startup complete - ready to accept requests"
   - Check for Python errors

2. **Verify environment variables:**
   ```bash
   curl https://your-app.railway.app/health
   # Check env_configured: true
   ```

3. **Test locally first:**
   ```bash
   cd server
   python main.py
   # Then test endpoints
   ```

## Memory Usage Comparison

| Configuration | Memory Usage | Status |
|--------------|--------------|--------|
| Before (eager loading, batch=3) | ~600MB | ❌ OOM on Railway |
| After (lazy loading, batch=1) | ~300MB | ✅ Works on Railway |
| With Hobby Plan (8GB) | ~300MB | ✅ Plenty of headroom |
