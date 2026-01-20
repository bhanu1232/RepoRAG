from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import os

# Import our services (to be initialized on startup)
from ingestion import RepositoryIngestion
from rag import RAGQueryEngine

app = FastAPI(title="RepoRAG API", version="2.0")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
ingestion_service = None
rag_service = None

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

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    global ingestion_service, rag_service
    # Initialize services lazily to avoid crashing if env vars are missing during dev
    try:
        if os.getenv("PINECONE_API_KEY") and os.getenv("GROQ_API_KEY"):
            print("Initializing RAG services...")
            ingestion_service = RepositoryIngestion()
            rag_service = RAGQueryEngine()
            print("RAG services initialized.")
        else:
            print("WARNING: API keys missing. RAG services not initialized.")
    except Exception as e:
        print(f"Error initializing services: {e}")

@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}

@app.get("/progress")
async def get_progress():
    """Get current indexing progress."""
    if not ingestion_service:
        raise HTTPException(
            status_code=503,
            detail="Ingestion service not available. Check server logs/API keys."
        )
    return {
        "progress": ingestion_service.progress,
        "stage": ingestion_service.current_stage
    }

@app.post("/index_repo")
def index_repo(request: RepoRequest):
    """Clone and index a GitHub repository."""
    if not ingestion_service:
        raise HTTPException(
            status_code=503, 
            detail="Ingestion service not available. Check server logs/API keys."
        )
    
    result = ingestion_service.index_repository(str(request.repo_url))
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
        
    return result

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Query the indexed codebase."""
    if not rag_service:
        raise HTTPException(
            status_code=503, 
            detail="Chat service not available. Check server logs/API keys."
        )
    
    # Set the LLM based on user selection
    rag_service.set_llm(request.model)
    
    # Query the RAG service with just the query text
    result = rag_service.query(request.query)
    
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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
