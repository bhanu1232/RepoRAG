from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import os
from dotenv import load_dotenv

load_dotenv()

# Optimization for Render (CPU-only, low memory)
os.environ["ONNXRUNTIME_EXECUTION_PROVIDERS"] = "CPUExecutionProvider"
os.environ["TOKENIZERS_PARALLELISM"] = "false"


app = FastAPI(title="RepoRAG API", version="2.0")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "https://reporag.vercel.app", 
        "https://repo-rag.vercel.app",
        "https://repo-rag.vercel.app/"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for API contracts
class RepoRequest(BaseModel):
    repo_url: HttpUrl

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    model: Optional[str] = "groq"  # Default to groq

class ChatResponse(BaseModel):
    answer: str
    sources: List[dict]
    confidence: Optional[dict] = None
    intent: Optional[str] = None

# Global instances
ingestion_service = None
rag_service = None
shared_embed_model = None

# Indexing status tracking
indexing_status = {
    "in_progress": False,
    "repo_url": None,
    "error": None,
    "result": None
}

def get_shared_embedding():
    """Lazy load shared embedding model."""
    global shared_embed_model
    if not shared_embed_model:
        print("Initializing Shared Embedding Model...")
        from llama_index.embeddings.fastembed import FastEmbedEmbedding
        shared_embed_model = FastEmbedEmbedding(model_name="BAAI/bge-small-en-v1.5")
        print("Shared Embedding Model initialized.")
    return shared_embed_model

def get_ingestion_service():
    """Lazy load ingestion service."""
    global ingestion_service
    if not ingestion_service:
        try:
            if os.getenv("PINECONE_API_KEY") and os.getenv("GROQ_API_KEY"):
                print("Initializing Ingestion Service...")
                # Import here to prevent startup delay
                from ingestion import RepositoryIngestion
                embed_model = get_shared_embedding()
                ingestion_service = RepositoryIngestion(embed_model=embed_model)
                print("Ingestion Service initialized.")
            else:
                print("WARNING: API keys missing. Ingestion Service not initialized.")
        except Exception as e:
            print(f"Error initializing Ingestion Service: {e}")
            raise HTTPException(status_code=503, detail=f"Service initialization failed: {str(e)}")
            
    if not ingestion_service:
        raise HTTPException(status_code=503, detail="Ingestion service not available. Check API keys.")
    return ingestion_service

def get_rag_service():
    """Lazy load RAG service."""
    global rag_service
    if not rag_service:
        try:
            if os.getenv("PINECONE_API_KEY") and os.getenv("GROQ_API_KEY"):
                print("Initializing RAG Service...")
                # Import here to prevent startup delay
                from rag import RAGQueryEngine
                embed_model = get_shared_embedding()
                rag_service = RAGQueryEngine(embed_model=embed_model)
                print("RAG Service initialized.")
            else:
                print("WARNING: API keys missing. RAG Service not initialized.")
        except Exception as e:
            print(f"Error initializing RAG Service: {e}")
            raise HTTPException(status_code=503, detail=f"Service initialization failed: {str(e)}")
            
    if not rag_service:
        raise HTTPException(status_code=503, detail="RAG service not available. Check API keys.")
    return rag_service

@app.on_event("startup")
async def startup_event():
    """
    FastAPI startup event. 
    Keep startup lightweight for Railway deployment.
    Services will be lazily initialized on first use.
    """
    print("Application starting up...")
    print("Services will be initialized on first use (lazy loading)")
    print("Startup complete - ready to accept requests")

@app.get("/")
async def root():
    """Root endpoint for health checks."""
    # Add status info
    rag_status = "ready" if rag_service else "initializing/failed"
    return {
        "status": "running", 
        "service": "RepoRAG API",
        "rag_status": rag_status
    }

@app.get("/health")
async def health_check():
    """Detailed health check endpoint for Railway."""
    env_vars_present = {
        "PINECONE_API_KEY": bool(os.getenv("PINECONE_API_KEY")),
        "GROQ_API_KEY": bool(os.getenv("GROQ_API_KEY")),
    }
    
    return {
        "status": "healthy",
        "service": "RepoRAG API",
        "env_configured": all(env_vars_present.values()),
        "env_details": env_vars_present,
        "services": {
            "ingestion": "initialized" if ingestion_service else "not_loaded",
            "rag": "initialized" if rag_service else "not_loaded"
        }
    }

@app.get("/progress")
async def get_progress():
    """Get current indexing progress and status."""
    # Check global indexing status first
    if indexing_status["in_progress"]:
        progress_data = {
            "progress": ingestion_service.progress if ingestion_service else 0,
            "stage": ingestion_service.current_stage if ingestion_service else "Initializing",
            "in_progress": True,
            "repo_url": indexing_status["repo_url"]
        }
        if indexing_status["error"]:
            progress_data["error"] = indexing_status["error"]
        return progress_data
    
    # If indexing completed, return result
    if indexing_status["result"]:
        return {
            "progress": 100,
            "stage": "Complete",
            "in_progress": False,
            "result": indexing_status["result"]
        }
    
    # Default: ready state
    return {"progress": 0, "stage": "Ready", "in_progress": False}

def run_indexing_task(repo_url: str):
    """Background task to run repository indexing."""
    global indexing_status
    try:
        print(f"Background indexing started for: {repo_url}")
        service = get_ingestion_service()
        print("Ingestion service initialized, starting indexing...")
        
        result = service.index_repository(repo_url)
        
        if result["success"]:
            print(f"Indexing completed successfully: {result}")
            indexing_status["result"] = result
            indexing_status["error"] = None
        else:
            print(f"Indexing failed: {result['message']}")
            indexing_status["error"] = result["message"]
            indexing_status["result"] = None
            
    except Exception as e:
        print(f"Unexpected error in background indexing: {str(e)}")
        import traceback
        traceback.print_exc()
        indexing_status["error"] = str(e)
        indexing_status["result"] = None
    finally:
        indexing_status["in_progress"] = False
        print("Background indexing task completed")

@app.post("/index_repo")
async def index_repo(request: RepoRequest, background_tasks: BackgroundTasks):
    """Start indexing a GitHub repository in the background."""
    global indexing_status
    
    # Check if indexing is already in progress
    if indexing_status["in_progress"]:
        raise HTTPException(
            status_code=409, 
            detail=f"Indexing already in progress for: {indexing_status['repo_url']}"
        )
    
    # Reset status
    indexing_status = {
        "in_progress": True,
        "repo_url": str(request.repo_url),
        "error": None,
        "result": None
    }
    
    # Add indexing task to background
    background_tasks.add_task(run_indexing_task, str(request.repo_url))
    
    return {
        "message": "Indexing started in background",
        "repo_url": str(request.repo_url),
        "status": "Check /progress endpoint for updates"
    }

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Query the indexed codebase."""
    try:
        service = get_rag_service()
    except Exception as e:
        print(f"RAG Service Init Error: {e}")
        raise HTTPException(status_code=503, detail=f"AI Service Unavailable: {str(e)}")
    
    # Query the RAG service with just the query text (Async)
    result = await service.aquery(request.query)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["answer"])
        
    return {
        "answer": result["answer"],
        "sources": result["sources"],
        "confidence": result.get("confidence"),
        "intent": result.get("intent")
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
