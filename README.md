# 🧠 RepoRAG - Advanced Repository Intelligence

> **Chat with your codebase.** An intelligent, hybrid RAG system that understands your code structure, generates diagrams, and delivers precise technical insights using a Dual-Engine Architecture.

![RepoRAG UI](https://placehold.co/800x400/101827/emerald?text=RepoRAG+Interface)

## ✨ Key Features

### 🏗️ **Hybrid "Dual-Engine" Architecture**
RepoRAG isn't just a wrapper around an API. It employs a sophisticated hybrid approach:
- **Server-Side Engine:** Powered by **Pinecone Serverless** and **Groq (Llama 3)** for deep reasoning on large codebases.
- **Client-Side Engine:** Experimental local RAG using **Transformers.js (WebGPU)** and **IndexedDB**. Runs embeddings entirely in your browser for privacy and speed.

### 🚀 **Advanced RAG Capabilities**
- **Smart Intent Detection:** Automatically classifies queries (e.g., *Debugging*, *Architecture*, *Coding Task*) to optimize retrieval strategies.
- **Hybrid Retrieval:** Combines **Semantic Search** (Vector) with **Keyword Search** (BM25-like) using **Reciprocal Rank Fusion (RRF)** for superior accuracy.
- **Reranking:** Relevance scoring boosts code files vs. documentation based on query intent.

### 🎨 **Visualization & UI**
- **Mermaid.js Support:** Automatically renders Flowcharts, Sequence Diagrams, and Class Diagrams from code descriptions.
- **"Pro" Developer Interface:** A high-contrast, distraction-free dark mode inspired by VS Code and Linear.
- **Rich Markdown:** Syntax highlighting, file trees, and collapsible source citations.

---

## 🛠️ Tech Stack

### **Frontend (Client)**
- **Core:** React 19 + Vite 6
- **Styling:** TailwindCSS v4
- **Local AI:** `@xenova/transformers` (WebGPU), `IndexedDB` (Vector Store)
- **Visuals:** Mermaid.js, Lucide React

### **Backend (Server)**
- **API:** FastAPI (Python 3.10+)
- **LLM:** `llama-3.3-70b-versatile` (via Groq)
- **Embeddings:** `FastEmbed` (ONNX-based, `BAAI/bge-small-en-v1.5`)
- **Vector DB:** Pinecone (Serverless / AWS us-east-1)
- **Orchestration:** LlamaIndex

---

## 📐 Architecture

```mermaid
graph TD
    User[User Query] --> Intent{Intent Detection}
    
    Intent -->|Complex/Deep| Server[Server-Side RAG]
    Intent -->|Privacy/Fast| Client[Client-Side RAG]
    
    subgraph Server ["Server (Python/FastAPI)"]
        Server --> Embed[FastEmbed (ONNX)]
        Embed --> Pinecone[(Pinecone Vector DB)]
        Pinecone --> Hybrid[Hybrid Retriever]
        Hybrid --> Rerank[RRF Reranking]
        Rerank --> LLM[Groq (Llama 3)]
    end
    
    subgraph Client ["Client (Browser/WASM)"]
        Client --> TF[Transformers.js (WebGPU)]
        TF --> IDB[(IndexedDB Vector Store)]
        IDB --> LocalLLM[LLM Gateway]
    end
    
    LLM --> Response
    LocalLLM --> Response
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- API Keys: `GROQ_API_KEY`, `PINECONE_API_KEY`

### 1. Backend Setup

```bash
cd server

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure Environment
# Create a .env file with your keys:
# GROQ_API_KEY=...
# PINECONE_API_KEY=...
# PINECONE_INDEX_NAME=reporag-optimized

# Start the Server
python main.py
# Server running at http://localhost:8000
```

### 2. Frontend Setup

```bash
cd client

# Install dependencies
npm install

# Start the Development Server
npm run dev
# App running at http://localhost:5173
```

---

## 💡 Usage Guide

### **1. Indexing a Repository**
- Enter a GitHub URL (e.g., `https://github.com/fastapi/fastapi`).
- The server clones, chunks, and generates embeddings (using FastEmbed).
- Vectors are stored in Pinecone (Serverless) for persistent, fast retrieval.

### **2. Asking Questions**
- **"Explain the authentication flow in auth.py"** → Returns a detailed explanation with code citations.
- **"Draw a class diagram of the user model"** → Renders a live Mermaid diagram.
- **"Debug this error in main.py..."** → Analyzing potential issues based on the actual code context.

### **3. Hybrid Mode (Experimental)**
- Navigate to the "Hybrid Demo" section to test in-browser embedding generation.
- Note: Requires a WebGPU-compatible browser (e.g., Chrome, Edge).

---

## 🔮 Roadmap
- [ ] Full Offline Mode (Local LLM via WebLLM)
- [ ] Multi-Repository Context Integration
- [ ] VS Code Extension

---

<p align="center">
  Built with ❤️ by Code Buddy
</p>