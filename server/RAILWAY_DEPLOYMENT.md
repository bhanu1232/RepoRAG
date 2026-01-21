# Railway Deployment Guide for RepoRAG

## Current Issue Analysis

The 503 error you're seeing is caused by:
1. **Memory constraints** - Railway's free tier has ~512MB RAM
2. **Service initialization timeout** - The embedding model was loading during startup
3. **Request timeout** - The indexing process takes too long for Railway's default timeouts

## Fixes Applied

### 1. Lazy Service Loading
- ✅ Removed eager initialization on startup
- ✅ Services now load only when first requested
- ✅ Startup completes in <1 second

### 2. Memory Optimization
- ✅ Reduced batch size from 3 to 1 (process one node at a time)
- ✅ Added aggressive garbage collection every 5 nodes
- ✅ Error handling to skip problematic nodes instead of failing completely

### 3. Deployment Configuration
- ✅ Single worker mode (`--workers 1`)
- ✅ Extended keep-alive timeout (120 seconds)
- ✅ Health check endpoint at `/health`
- ✅ Detailed logging for debugging

### 4. Better Error Handling
- ✅ Async endpoints with try-catch blocks
- ✅ Detailed error messages and stack traces
- ✅ Service status reporting in health check

## Railway Environment Variables

Make sure these are set in your Railway project:

```bash
PINECONE_API_KEY=your_pinecone_api_key
GROQ_API_KEY=your_groq_api_key
PINECONE_INDEX_NAME=reporag-optimized
PORT=8080  # Railway sets this automatically
```

## Deployment Steps

### Option 1: Redeploy Current Code

1. **Commit and push these changes:**
   ```bash
   cd server
   git add .
   git commit -m "fix: optimize for Railway memory constraints"
   git push
   ```

2. **Railway will auto-deploy** (if connected to GitHub)

3. **Monitor the deployment:**
   - Check Build Logs for any errors
   - Check Deploy Logs for startup messages
   - You should see: "Startup complete - ready to accept requests"

### Option 2: Manual Railway CLI Deploy

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Deploy
railway up
```

## Testing the Deployment

### 1. Health Check
```bash
curl https://reporag-production.up.railway.app/health
```

Expected response:
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

### 2. Test Indexing (This will trigger service initialization)
```bash
curl -X POST https://reporag-production.up.railway.app/index_repo \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/yourusername/small-test-repo"}'
```

**Note:** Start with a SMALL repository (<50 files) to test if it works.

## Expected Behavior

1. **First request** to `/index_repo` or `/chat`:
   - Will take 10-30 seconds as services initialize
   - You'll see "Initializing Shared Embedding Model..." in logs
   - Then the actual operation proceeds

2. **Subsequent requests**:
   - Should be much faster
   - Services are already loaded in memory

## Troubleshooting

### Still getting 503?

1. **Check Railway logs:**
   ```
   Railway Dashboard → Your Service → Deploy Logs
   ```
   Look for:
   - "Startup complete - ready to accept requests" ✅
   - Any Python errors or tracebacks ❌
   - Memory errors (OOM killed) ❌

2. **Check environment variables:**
   ```bash
   curl https://reporag-production.up.railway.app/health
   ```
   Verify `env_configured: true`

3. **Try a smaller repository first:**
   - Use a repo with <20 files
   - If that works, the issue is memory during indexing

### Memory Issues During Indexing

If indexing still fails with OOM:

1. **Upgrade Railway plan** (recommended)
   - Hobby plan: $5/month, 8GB RAM
   - This will solve all memory issues

2. **Or limit repository size:**
   - Only index repositories with <100 files
   - Add file count check before indexing

## Monitoring

Watch these Railway metrics:
- **Memory usage** - Should stay under 512MB on free tier
- **Response time** - First request: 10-30s, subsequent: <5s
- **Restart count** - Should be 0 (if restarting, it's OOM)

## Next Steps

After deployment succeeds:

1. ✅ Test with a small repository
2. ✅ Verify chat functionality works
3. ✅ Monitor memory usage
4. 🔄 Consider upgrading to Hobby plan if needed

## Alternative: Use Render or Fly.io

If Railway continues to have issues, consider:

- **Render**: 512MB free tier, better for Python apps
- **Fly.io**: 256MB free tier, but better memory management
- **Vercel**: For serverless deployment (requires code changes)
