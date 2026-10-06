import os
import asyncio
from typing import List, Dict, Any
from llama_index.core import VectorStoreIndex, PromptTemplate, Settings
from llama_index.llms.groq import Groq
from custom_embedding import GeminiRESTEmbedding
from llama_index.vector_stores.pinecone import PineconeVectorStore
from pinecone import Pinecone
from dotenv import load_dotenv

# Import our new modules
from query_processor import QueryProcessor, QueryIntent
from hybrid_retriever import HybridRetriever

load_dotenv()


# Supported candidate models in order of priority (excluding deprecated models like llama3-8b-8192)
FALLBACK_GROQ_MODELS = [
    os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
]


class RAGQueryEngine:
    """Enhanced RAG engine with advanced query processing and hybrid retrieval."""
    
    def __init__(self, embed_model=None):
        # Initialize response cache to reduce API calls
        self.response_cache = {}
        self.cache_ttl = 300  # 5 minutes TTL
        
        # Initialize Groq LLM with a modern supported model
        self.current_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        if self.current_model in ["llama3-8b-8192", "llama3-70b-8192", "llama-3-8b-8192", "llama-3-70b-8192", "groq"]:
            self.current_model = "openai/gpt-oss-120b"
            
        self._init_llm(self.current_model)
        
        # Initialize Gemini Embedding (Cloud-based, Free Tier)
        if embed_model:
            self.embed_model = embed_model
        else:
            # Uses GOOGLE_API_KEY from environment
            self.embed_model = GeminiRESTEmbedding(
                model_name="gemini-embedding-001"
            )
        
        # Configure global settings to avoid local defaults
        Settings.llm = self.llm
        Settings.embed_model = self.embed_model
        
        # Initialize Pinecone
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        index_name = os.getenv("PINECONE_INDEX_NAME", "reporag-gemini")
        
        self.pinecone_index = pc.Index(index_name)
        self.vector_store = PineconeVectorStore(pinecone_index=self.pinecone_index)
        
        # Create the index from existing vector store
        self.index = VectorStoreIndex.from_vector_store(
            vector_store=self.vector_store,
            embed_model=self.embed_model,
        )
        
        # Initialize our new components
        self.query_processor = QueryProcessor()
        self.hybrid_retriever = HybridRetriever()

    def _init_llm(self, model_name: str):
        """Initialize or update the Groq LLM instance."""
        self.current_model = model_name
        self.llm = Groq(
            model=model_name,
            api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.1,
        )
        Settings.llm = self.llm

    def _execute_llm_complete(self, prompt: str) -> str:
        """Execute LLM completion with automatic fallback if decommissioned/unavailable."""
        models_to_try = [self.current_model] + [m for m in FALLBACK_GROQ_MODELS if m != self.current_model]
        last_error = None
        for model in models_to_try:
            try:
                if self.current_model != model:
                    print(f"[RAG] Switching model to fallback: {model}")
                    self._init_llm(model)
                res = self.llm.complete(prompt)
                return str(res)
            except Exception as e:
                err_str = str(e)
                print(f"[RAG] Model {model} failed: {err_str}")
                last_error = e
                # If decommissioned or not found, try next candidate
                if "decommissioned" in err_str or "not_found" in err_str or "400" in err_str or "404" in err_str:
                    continue
                else:
                    raise e
        raise last_error or Exception("All Groq models failed to complete request.")

    async def _execute_llm_acomplete(self, prompt: str) -> str:
        """Execute async LLM completion with automatic fallback if decommissioned/unavailable."""
        models_to_try = [self.current_model] + [m for m in FALLBACK_GROQ_MODELS if m != self.current_model]
        last_error = None
        for model in models_to_try:
            try:
                if self.current_model != model:
                    print(f"[RAG] Switching async model to fallback: {model}")
                    self._init_llm(model)
                res = await self.llm.acomplete(prompt)
                return str(res)
            except Exception as e:
                err_str = str(e)
                print(f"[RAG] Async Model {model} failed: {err_str}")
                last_error = e
                if "decommissioned" in err_str or "not_found" in err_str or "400" in err_str or "404" in err_str:
                    continue
                else:
                    raise e
        raise last_error or Exception("All Groq models failed to complete async request.")
    
    
    def _get_intent_specific_instructions(self, intent: QueryIntent) -> str:
        """Get specialized instructions based on query intent."""
        instructions = {
            QueryIntent.SUMMARY: (
                "Provide a CONCISE, HIGH-LEVEL summary. "
                "Do NOT show code unless absolutely necessary. "
                "Focus on the 'what' and 'why' of the project/component. "
                "Keep it under 3-4 paragraphs."
            ),
            QueryIntent.QNA: (
                "Provide a DIRECT, SHORT answer. "
                "No need for deep technical elaboration unless asked. "
                "Get straight to the point. "
                "Accuracy is key, brevity is preferred."
            ),
            QueryIntent.CODING: (
                "Provide COMPLETE, RUNNABLE code. "
                "This is a coding task - prioritize code generation over explanation. "
                "Ensure all imports, setup, and logic are included. "
                "NO LIMITS on code length."
            ),
            QueryIntent.EXPLANATION: (
                "Focus on explaining HOW and WHY the code works. "
                "Break down the logic flow, explain key algorithms, and describe the purpose of each component. "
                "Use clear examples from the actual code."
            ),
            QueryIntent.IMPLEMENTATION: (
                "Show the ACTUAL CODE implementation. "
                "Include function signatures, key logic, and important details. "
                "Cite specific line numbers and file paths."
            ),
            QueryIntent.DEBUGGING: (
                "Analyze potential issues and error scenarios. "
                "Look for error handling, edge cases, and common pitfalls. "
                "Suggest what might be causing problems based on the code."
            ),
            QueryIntent.ARCHITECTURE: (
                "Describe the high-level structure and design patterns. "
                "Explain how different components interact. "
                "Focus on the overall organization and architecture decisions."
            ),
            QueryIntent.USAGE: (
                "Provide practical usage examples. "
                "Show how to use the code with concrete examples. "
                "Include setup steps and common use cases."
            ),
            QueryIntent.COMPARISON: (
                "Compare and contrast the different approaches or components. "
                "Highlight key differences and similarities. "
                "Explain when to use each option."
            ),
        }
        return instructions.get(intent, "Provide a comprehensive technical answer based on the code.")
    
    def _create_enhanced_prompt(self, intent: QueryIntent) -> PromptTemplate:
        """Create an enhanced prompt template based on query intent."""
        intent_instructions = self._get_intent_specific_instructions(intent)
        
        template = (
            "You are RepoRAG, an elite Senior Software Engineer and Architect with deep expertise in code analysis.\n"
            "Your mission: Provide HIGHLY ACCURATE, HIGH-QUALITY technical responses based on the provided code context.\n\n"
            "---------------------\n"
            "{context_str}\n"
            "---------------------\n\n"
            "QUERY INTENT: " + intent.value.upper() + "\n"
            "SPECIALIZED INSTRUCTIONS: " + intent_instructions + "\n\n"
            "CRITICAL FORMATTING REQUIREMENTS (MANDATORY):\n\n"
            "1. **ALWAYS USE MARKDOWN HEADINGS** - NEVER write plain text sections:\n"
            "   ✅ CORRECT:\n"
            "   ## Main Logic Code Analysis\n"
            "   The code handles...\n\n"
            "   ## Overall Architecture\n"
            "   The system is organized...\n\n"
            "   ❌ WRONG:\n"
            "   Main Logic Code Analysis\n"
            "   The code handles...\n\n"
            "   Overall Architecture\n"
            "   The system is organized...\n\n"
            "2. **USE BULLET POINTS FOR LISTS** - NEVER write items as paragraphs:\n"
            "   ✅ CORRECT:\n"
            "   ## Key Components\n"
            "   - **Cube Representation**: The `a` variable represents...\n"
            "   - **Move System**: The `m` function performs...\n"
            "   - **Scramble System**: The `last_scramble` list stores...\n\n"
            "   ❌ WRONG:\n"
            "   Key Components\n"
            "   Cube Representation: The a variable represents...\n"
            "   Move System: The m function performs...\n\n"
            "3. **STRUCTURE EVERY RESPONSE**:\n"
            "   - Start with ## heading for main topic\n"
            "   - Use ### for subsections\n"
            "   - Use - for bullet points\n"
            "   - Use **bold** for important terms\n"
            "   - Add blank lines between sections\n\n"
            "4. **CODE EXAMPLES** (ABSOLUTELY NO LIMITS):\n"
            "   - Show COMPLETE, FULL code examples - NEVER truncate or summarize\n"
            "   - Include ENTIRE functions, classes, or files when relevant\n"
            "   - Use proper language tags: ```python, ```javascript, ```java, etc.\n"
            "   - Show ALL important code, not just snippets\n"
            "   - Include explanations before/after code\n"
            "   - IMPORTANT: Code should be complete and runnable when possible\n\n"
            "5. **FOLDER STRUCTURES** (Keep Minimal):\n"
            "   - ONLY show if explicitly asked or essential\n"
            "   - Limit to 10-15 key files\n"
            "   - Use simple bullet points, NOT code blocks\n"
            "   - Group similar files\n\n"
            "6. **COMMANDS**:\n"
            "   - Use ```bash blocks for shell commands\n"
            "   - Example:\n"
            "   ```bash\n"
            "   npm install\n"
            "7. **DATA PRESENTATION (TABLES)**:\n"
            "   - Use Markdown tables for comparing options or listing data\n"
            "   - Example:\n"
            "   | Feature | Option A | Option B |\n"
            "   |---------|----------|----------|\n"
            "   | Speed   | Fast     | Slow     |\n\n"
            "8. **VISUALIZATION (MERMAID)**:\n"
            "   - Use `mermaid` language tag ONLY for valid Mermaid diagrams\n"
            "   - IMPORTANT: ALWAYS wrap node text in double quotes if it contains parentheses, brackets, or spaces: e.g. A[\"Client (React)\"] --> B[\"API Gateway\"]\n"
            "   - NEVER put markdown formatting (like **bold** or `code`) or HTML tags inside Mermaid node labels\n"
            "   - Example:\n"
            "   ```mermaid\n"
            "   graph TD\n"
            "   A[\"Client (React)\"] --> B[\"API Gateway\"]\n"
            "   B --> C[\"Vector Engine\"]\n"
            "   ```\n\n"
            "9. **QUALITY CONTENT**:\n"
            "   - Explain WHAT the code does\n"
            "   - Explain WHY it's designed that way\n"
            "   - Highlight patterns and best practices\n"
            "   - Provide actionable insights\n\n"
            "8. **ACCURACY**:\n"
            "   - Base answers 100% on provided context\n"
            "   - Never hallucinate or assume\n"
            "   - State clearly if information is missing\n\n"
            "Query: {query_str}\n\n"
            "IMPORTANT: Your response MUST use proper Markdown formatting with ## headings and - bullet points.\n"
            "Provide a well-formatted, insightful technical analysis:\n"
        )
        
        return PromptTemplate(template)
    
    def _calculate_confidence(self, sources: List[Dict], query: str, answer: str) -> Dict[str, Any]:
        """Calculate confidence score for the answer."""
        if not sources:
            return {"score": 0.0, "level": "none", "reason": "No sources found"}
        
        # Check if answer explicitly states no context was found
        lower_ans = answer.lower()
        if any(neg in lower_ans for neg in [
            "the context doesn't contain", 
            "the context does not contain", 
            "no information found", 
            "i could not find any relevant",
            "i couldn't find any relevant",
            "no relevant code found",
            "not mentioned in the provided context",
            "does not mention"
        ]):
            return {"score": 0.0, "level": "none", "reason": "LLM indicated no matching context"}

        # Factors for confidence calculation
        valid_scores = [s.get('score', 0) for s in sources if s.get('score') is not None]
        avg_score = sum(valid_scores) / len(valid_scores) if valid_scores else 0
        num_sources = len(sources)
        code_sources = sum(1 for s in sources if any(s.get('file', '').lower().endswith(ext) for ext in ['.py', '.js', '.jsx', '.ts', '.tsx', '.go', '.java', '.cpp', '.rs', '.c', '.h', '.rb', '.php']))
        
        # If retrieved scores are very low (e.g. max < 0.25), consider it no match
        max_score = max(valid_scores) if valid_scores else 0
        if max_score < 0.20:
            return {"score": 0.0, "level": "none", "reason": "Relevance score below minimum threshold"}

        # Calculate base confidence
        confidence = 0.0
        
        # Source quality (40% weight)
        if avg_score > 0.7:
            confidence += 0.4
        elif avg_score > 0.5:
            confidence += 0.3
        elif avg_score > 0.3:
            confidence += 0.2
        elif avg_score > 0.15:
            confidence += 0.1
        
        # Number of sources (30% weight)
        if num_sources >= 5:
            confidence += 0.3
        elif num_sources >= 3:
            confidence += 0.2
        elif num_sources >= 1:
            confidence += 0.1
        
        # Code source availability (30% weight)
        if code_sources >= 3:
            confidence += 0.3
        elif code_sources >= 1:
            confidence += 0.2
        else:
            confidence += 0.1
        
        # Determine confidence level
        if confidence >= 0.75:
            level = "high"
            reason = "Strong source relevance with multiple code references"
        elif confidence >= 0.5:
            level = "medium"
            reason = "Good source coverage with relevant matches"
        elif confidence > 0.0:
            level = "low"
            reason = "Limited source relevance or coverage"
        else:
            level = "none"
            reason = "No relevant matches found"
        
        return {
            "score": round(confidence, 2),
            "level": level,
            "reason": reason
        }
    
    def query(self, query_text: str) -> Dict[str, Any]:
        """
        Optimized query method with caching and single-pass generation.
        """
        try:
            # 0. Check cache first to avoid API calls
            import time
            cache_key = f"{query_text}_{self.current_model}"
            if cache_key in self.response_cache:
                cached_response, timestamp = self.response_cache[cache_key]
                if time.time() - timestamp < self.cache_ttl:
                    print(f"Cache hit! Returning cached response (saved API call)")
                    return cached_response
                else:
                    # Cache expired, remove it
                    del self.response_cache[cache_key]
            
            # 1. Handle simple greetings without RAG
            greetings = ["hi", "hello", "hey", "hallo", "greetings"]
            if query_text.lower().strip().rstrip('!?.') in greetings:
                return {
                    "success": True,
                    "answer": "Hello! I'm RepoRAG, your advanced code analysis assistant. I've indexed your repository and I'm ready to provide detailed, accurate insights about the codebase. What would you like to explore?",
                    "sources": [],
                    "confidence": {"score": 1.0, "level": "high", "reason": "Greeting response"}
                }

            # 2. Process query with our enhanced processor
            processed = self.query_processor.process(query_text, None)
            intent = processed['intent']
            rewritten_query = processed['rewritten_query']
            
            # 3. Create intent-specific prompt
            qa_template = self._create_enhanced_prompt(intent)
            
            # Determine appropriate number of chunks based on intent
            if intent in [QueryIntent.SUMMARY, QueryIntent.QNA]:
                top_k = 3
            elif intent in [QueryIntent.CODING, QueryIntent.DEBUGGING]:
                top_k = 5  # Reduced from 7 for speed while maintaining context
            else:
                top_k = 4  # Reduced from 5
            
            # 4. STAGED HYBRID FILTERING (Production-grade retrieval)
            from staged_filter import StagedHybridRetriever, create_filter_config_from_dict
            
            # Extract filter configuration from processed query
            filter_dict = processed.get('filter_config', {})
            filter_config = create_filter_config_from_dict(filter_dict)
            
            # Log filter configuration
            if filter_config.pre_filters:
                print(f"[Staged Filtering] Pre-filters: {filter_config.pre_filters}")
            if filter_config.post_filters:
                print(f"[Staged Filtering] Post-filters: {filter_config.post_filters}")
            
            # Create staged retriever
            staged_retriever = StagedHybridRetriever(
                self.index,
                self.pinecone_index
            )
            
            # Execute three-stage retrieval
            nodes, filter_metrics = staged_retriever.retrieve(
                rewritten_query,
                filter_config,
                top_k=top_k * 2  # Get more candidates for reranking
            )
            
            # Log performance metrics
            print(f"[Performance] Staged retrieval completed in {filter_metrics.total_latency_ms:.1f}ms "
                  f"(Pre: {filter_metrics.pre_filter_latency_ms:.1f}ms, "
                  f"Vector: {filter_metrics.vector_search_latency_ms:.1f}ms, "
                  f"Post: {filter_metrics.post_filter_latency_ms:.1f}ms)")
            
            # Apply existing hybrid reranking for final refinement
            semantic_node_tuples = [(n.node, n.score) for n in nodes]
            
            # Rerank with existing HybridRetriever logic
            reranked_tuples = self.hybrid_retriever.rerank_by_relevance(
                semantic_node_tuples, 
                query_text, 
                intent.value
            )
            
            # Take top K after reranking
            final_top_k_tuples = reranked_tuples[:top_k]
            
            # Reconstruct NodeWithScore objects
            from llama_index.core.schema import NodeWithScore
            nodes = [NodeWithScore(node=t[0], score=t[1]) for t in final_top_k_tuples]
            
            # D. Context Expansion (Optional - if we had the full store nearby, but we can try simple expansion if metadata allows)
            # nodes = self.hybrid_retriever.expand_context(nodes, ...) 
            # (Skipping expansion for now to save memory/complexity as we might not have all chunks loaded)
            
            # Construct Context
            context_text = "\n\n".join([n.get_content() for n in nodes])
            
            # Format Prompt
            # Note: template expects 'context_str' and 'query_str' (if we follow standard LlamaIndex)
            # But our prompt string (lines 191) uses {query_str} and we manually format it here
            final_prompt = qa_template.format(context_str=context_text, query_str=rewritten_query)
            
            # Single LLM Call with automatic fallback
            response_text = self._execute_llm_complete(final_prompt)
            
            # Create a mock response object to match previous structure key expectation or just return text
            class MockResponse:
                def __init__(self, text, nodes):
                    self.response = text
                    self.source_nodes = nodes
                def __str__(self):
                    return self.response
            
            response = MockResponse(response_text, nodes)
            
            # 5. Simplified source extraction (no re-ranking to save processing)
            sources = []
            if hasattr(response, 'source_nodes'):
                # Direct extraction without re-ranking
                for node in response.source_nodes[:5]:  # Take top 5 only
                    file_path = node.metadata.get('file_path', 'Unknown')
                    start_line = node.metadata.get('start_line', '')
                    end_line = node.metadata.get('end_line', '')
                    score = node.score if hasattr(node, 'score') else None
                    
                    if start_line and end_line:
                        lines = f"{start_line}-{end_line}"
                    elif start_line:
                        lines = str(start_line)
                    else:
                        lines = "N/A"
                    
                    sources.append({
                        "file": file_path,
                        "lines": lines,
                        "score": round(float(score), 3) if score else None,
                        "category": node.metadata.get('file_category', 'unknown')
                    })
            
            # 6. Calculate confidence
            confidence = self._calculate_confidence(sources, query_text, str(response))
            
            # If confidence is 0 or less, or no sources found, return "No result found"
            if confidence.get("score", 0) <= 0.0 or not sources:
                final_response = {
                    "success": True,
                    "answer": "No result found. I couldn't find any relevant code, functions, or documentation for your query in the indexed repository.",
                    "sources": [],
                    "confidence": {"score": 0.0, "level": "none", "reason": "No relevant matches found in codebase"},
                    "intent": intent.value if hasattr(intent, 'value') else "general"
                }
                return final_response
            
            # Build final response
            final_response = {
                "success": True,
                "answer": str(response),
                "sources": sources,
                "confidence": confidence,
                "intent": intent.value if hasattr(intent, 'value') else "general"
            }
            
            # 7. Cache the response for future use
            import time
            self.response_cache[cache_key] = (final_response, time.time())
            print(f"Response cached for future queries")
            
            return final_response
            
        except Exception as e:
            return {
                "success": False,
                "answer": f"Error processing query: {str(e)}",
                "sources": [],
                "confidence": {"score": 0.0, "level": "low", "reason": "Error occurred"}
            }

    async def aquery(self, query_text: str) -> Dict[str, Any]:
        """
        Async version of query method to prevent blocking the event loop.
        """
        try:
            # 0. Check cache first
            import time
            cache_key = f"{query_text}_{self.current_model}"
            if cache_key in self.response_cache:
                cached_response, timestamp = self.response_cache[cache_key]
                if time.time() - timestamp < self.cache_ttl:
                    print(f"Cache hit! Returning cached response")
                    return cached_response
                else:
                    del self.response_cache[cache_key]
            
            # 1. Handle greetings (Sync is fine here, it's fast)
            greetings = ["hi", "hello", "hey", "hallo", "greetings"]
            if query_text.lower().strip().rstrip('!?.') in greetings:
                return {
                    "success": True,
                    "answer": "Hello! I'm RepoRAG, your advanced code analysis assistant. I've indexed your repository and I'm ready to provide detailed, accurate insights about the codebase. What would you like to explore?",
                    "sources": [],
                    "confidence": {"score": 1.0, "level": "high", "reason": "Greeting response"}
                }

            # 2. Process query (Sync but fast regex)
            processed = self.query_processor.process(query_text, None)
            intent = processed['intent']
            rewritten_query = processed['rewritten_query']
            
            # 3. Create prompt
            qa_template = self._create_enhanced_prompt(intent)
            
            # Determine top_k
            if intent in [QueryIntent.SUMMARY, QueryIntent.QNA]:
                top_k = 3
            elif intent in [QueryIntent.CODING, QueryIntent.DEBUGGING]:
                top_k = 7
            else:
                top_k = 5
            
            # 4. STAGED HYBRID FILTERING (Async version)
            from staged_filter import StagedHybridRetriever, create_filter_config_from_dict
            
            # Extract filter configuration
            filter_dict = processed.get('filter_config', {})
            filter_config = create_filter_config_from_dict(filter_dict)
            
            # Log filter configuration
            if filter_config.pre_filters:
                print(f"[Staged Filtering] Pre-filters: {filter_config.pre_filters}")
            if filter_config.post_filters:
                print(f"[Staged Filtering] Post-filters: {filter_config.post_filters}")
            
            # Create staged retriever
            staged_retriever = StagedHybridRetriever(
                self.index,
                self.pinecone_index
            )
            
            # Execute three-stage retrieval (run in thread pool for async)
            nodes, filter_metrics = await asyncio.to_thread(
                staged_retriever.retrieve,
                rewritten_query,
                filter_config,
                top_k * 2
            )
            
            # Log performance
            print(f"[Performance] Async staged retrieval: {filter_metrics.total_latency_ms:.1f}ms")
            
            # Apply hybrid reranking
            semantic_node_tuples = [(n.node, n.score) for n in nodes]
            
            # Rerank
            reranked_tuples = self.hybrid_retriever.rerank_by_relevance(
                semantic_node_tuples, 
                query_text, 
                intent.value
            )
            
            # Take top K
            final_top_k_tuples = reranked_tuples[:top_k]
            
            # Reconstruct
            from llama_index.core.schema import NodeWithScore
            nodes = [NodeWithScore(node=t[0], score=t[1]) for t in final_top_k_tuples]
            
            # Construct Context
            context_text = "\n\n".join([n.get_content() for n in nodes])
            final_prompt = qa_template.format(context_str=context_text, query_str=rewritten_query)
            
            # 5. Async LLM Call with automatic fallback
            response_text = await self._execute_llm_acomplete(final_prompt)
            
            # Mock response structure for source extraction
            class MockResponse:
                def __init__(self, text, nodes):
                    self.response = text
                    self.source_nodes = nodes
                def __str__(self):
                    return self.response
            
            response = MockResponse(response_text, nodes)
            
            # 6. Source Extraction
            sources = []
            if hasattr(response, 'source_nodes'):
                for node in response.source_nodes[:5]:
                    file_path = node.metadata.get('file_path', 'Unknown')
                    start_line = node.metadata.get('start_line', '')
                    end_line = node.metadata.get('end_line', '')
                    score = node.score if hasattr(node, 'score') else None
                    
                    if start_line and end_line:
                        lines = f"{start_line}-{end_line}"
                    elif start_line:
                        lines = str(start_line)
                    else:
                        lines = "N/A"
                    
                    sources.append({
                        "file": file_path,
                        "lines": lines,
                        "score": round(float(score), 3) if score else None,
                        "category": node.metadata.get('file_category', 'unknown')
                    })
            
            # 7. Confidence & Final Response
            confidence = self._calculate_confidence(sources, query_text, str(response))
            
            final_response = {
                "success": True,
                "answer": str(response),
                "sources": sources,
                "confidence": confidence,
                "intent": intent.value
            }
            
            # Cache
            self.response_cache[cache_key] = (final_response, time.time())
            
            return final_response
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "answer": f"Error processing query: {str(e)}",
                "sources": [],
                "confidence": {"score": 0.0, "level": "low", "reason": "Error occurred"}
            }
