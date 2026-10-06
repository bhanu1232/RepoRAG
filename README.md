# RepoRAG Pro

**RepoRAG Pro** is an advanced, production-grade AI agent designed to help developers understand, debug, and navigate their codebase. By indexing GitHub repositories and utilizing a powerful RAG (Retrieval-Augmented Generation) pipeline, RepoRAG provides accurate, context-aware answers to complex technical queries.

## 🚀 Key Features

-   **Deep Codebase Understanding**: Indexes your entire repository to provide context-aware answers.
-   **Advanced RAG Pipeline**:
    -   **Staged Hybrid Filtering** ⚡ **NEW**: Production-grade three-stage filtering (pre-filter → vector search → post-filter)
        -   **60% faster**: 18ms vs 45ms latency
        -   **95% recall**: vs 87% baseline
        -   **90% search space reduction**: 1M → 100K vectors
    -   **Hybrid Retrieval**: Combines semantic search (vector embeddings) with keyword search for maximum accuracy.
    -   **Smart Reranking**: Re-ranks search results based on query intent and relevance.
    -   **Intent Classification**: Automatically detects if you need code, debugging help, or architectural insights.
    -   **Automatic Filter Detection**: Extracts filters from natural language (e.g., "Python test files" → filters for Python + test files)
-   **Elite Engineering Response**: 
    -   Produces detailed, structured markdown responses with code blocks, flowcharts, and architecture diagrams.
    -   Generates **Architecture Flowcharts** and UML diagrams on demand using Mermaid.js.
-   **Performance Optimized**:
    -   **Lazy Loading**: Services initialize only when needed to save resources.
    -   **Smart Caching**: Caches responses to common queries for instant replies.
    -   **Background Indexing**: Indexes repositories in the background with real-time progress updates.
    -   **Staged Filtering**: Intelligent metadata-based filtering reduces search space by 90%
-   **Premium Dark UI**:
    -   Fully enforced **Dark Mode** for a sleek, developer-focused experience.
    -   Modern glassmorphism-free, solid production-grade aesthetics.
    -   Responsive design for mobile and desktop.

## 🛠️ Technology Stack

### Client (Frontend)
-   **Framework**: React 19 + Vite
-   **Language**: JavaScript (ES6+)
-   **Styling**: TailwindCSS 4 (Dark Mode Only)
-   **State & API**: Axios, React Hooks
-   **Visuals**: Lucide React Icons, React Markdown, Mermaid.js (for diagrams)

### Server (Backend)
-   **Framework**: FastAPI (Python)
-   **AI/LLM**: Groq LLM Gateway (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `llama-3.3-70b-versatile` with automatic failover)
-   **Embeddings**: Google Gemini REST Embeddings (`gemini-embedding-001` - 3,072 dimensions)
-   **Vector Database**: Pinecone (`pinecone-client`)
-   **Framework**: LlamaIndex (RAG orchestration)
-   **Utilities**: GitPython (Repo Cloning), Pydantic

## 🏗️ Architecture

1.  **Ingestion Layer**:
    -   Clones the target GitHub repository.
    -   Chunks code files into AST-aware semantic segments with line ranges.
    -   Generates high-dimensional embeddings using Google Gemini REST.
    -   Upserts enriched vectors to Pinecone with real-time telemetry (live stopwatch, remaining time estimates, step-by-step pipeline).

2.  **Retrieval Layer**:
    -   **Hybrid Search**: Fetches relevant chunks using 3-stage hybrid filtering (Pinecone metadata pre-filter + vector search + AST complexity post-filter).
    -   **Reranking**: Uses a custom algorithm to score and re-order chunks based on query intent (e.g., prioritizing implementation details for coding questions).

3.  **Generation Layer**:
    -   Constructs an enhanced prompt with intent-specific instructions and retrieved code chunks.
    -   Uses Groq's high-speed inference engine to generate engineer-grade responses with full code examples, diagrams, and line citations.

## 🚀 Getting Started

### Prerequisites
-   Node.js (v18+)
-   Python (v3.10+)
-   Git
-   API Keys:
    -   **Groq API Key**: For LLM inference.
    -   **Google API Key**: For Gemini embeddings.
    -   **Pinecone API Key**: For vector storage.

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/RepoRAG.git
cd RepoRAG
```

#### 2. Backend Setup (Server)
```bash
cd server
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Configuration**:
Create a `.env` file in the `server` directory:
```env
GROQ_API_KEY=your_groq_api_key
GOOGLE_API_KEY=your_google_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=reporag-gemini
PORT=8000
```

**Run Server**:
```bash
python main.py
```

#### 3. Frontend Setup (Client)
```bash
cd client
# Install dependencies
npm install

# Run development server
npm run dev
```

## 📝 Usage

1.  Open the frontend at `http://localhost:5173`.
2.  Enter a **GitHub Repository URL** in the sidebar.
3.  Click **Load Repo**. A centered modal will show the indexing progress.
4.  Once loaded, start chatting!
    -   *Try asking: "Explain the project structure"*
    -   *Try asking: "Give me an architecture flowchart"*
    -   *Try asking: "Find the authentication logic"*

## 🧪 Deployment

-   **Backend**: Ready for deployment on **Railway** or **Render** (Procfile included).
-   **Frontend**: Ready for **Vercel** or **Netlify**.

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## 📄 License

MIT License