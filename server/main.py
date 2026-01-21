from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import os
from dotenv import load_dotenv

load_dotenv()

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

def get_ingestion_service():
    """Lazy load ingestion service."""
    global ingestion_service
    if not ingestion_service:
        try:
            if os.getenv("PINECONE_API_KEY") and os.getenv("GROQ_API_KEY"):
                print("Initializing Ingestion Service...")
                # Import here to prevent startup delay
                from ingestion import RepositoryIngestion
                ingestion_service = RepositoryIngestion()
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
                rag_service = RAGQueryEngine()
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
    We intentionally DO NOT initialize heavy services here to allow 
    fast port binding for Render/Heroku.
    """
    print("Application starting up... Services will verify on first use.")

@app.get("/")
async def root():
    """Root endpoint for health checks."""
    return {"status": "running", "service": "RepoRAG API"}

@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}

@app.get("/progress")
async def get_progress():
    """Get current indexing progress."""
    # We can check global directly here to avoid triggering init if not needed
    if not ingestion_service:
        return {"progress": 0, "stage": "Ready"}
        
    return {
        "progress": ingestion_service.progress,
        "stage": ingestion_service.current_stage
    }

@app.post("/index_repo")
def index_repo(request: RepoRequest):
    """Clone and index a GitHub repository."""
    service = get_ingestion_service()
    
    result = service.index_repository(str(request.repo_url))
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
        
    return result

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
