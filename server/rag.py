import os
from typing import List, Dict, Any
from llama_index.core import VectorStoreIndex, PromptTemplate
from llama_index.llms.groq import Groq
from llama_index.embeddings.fastembed import FastEmbedEmbedding
from llama_index.vector_stores.pinecone import PineconeVectorStore
from pinecone import Pinecone
from dotenv import load_dotenv

# Import our new modules
from query_processor import QueryProcessor, QueryIntent
from hybrid_retriever import HybridRetriever

load_dotenv()


class RAGQueryEngine:
    """Enhanced RAG engine with advanced query processing and hybrid retrieval."""
    
    def __init__(self):
        # Initialize response cache to reduce API calls
        self.response_cache = {}
        self.cache_ttl = 300  # 5 minutes TTL
        
        # Initialize Groq LLM
        self.llm = Groq(
            model="llama-3.1-8b-instant",
            api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.1,
        )
        self.current_model = "groq"
        
        # Initialize FastEmbed (ONNX, lightweight)
        self.embed_model = FastEmbedEmbedding(
            model_name="BAAI/bge-small-en-v1.5"
        )
        
        # Initialize Pinecone
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        index_name = os.getenv("PINECONE_INDEX_NAME", "reporag-optimized")
        
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
            "   - Use Mermaid dictionaries for flows and architecture\n"
            "   - Use `mermaid` language tag\n"
            "   - Example:\n"
            "   ```mermaid\n"
            "   graph TD\n"
            "   A[Start] --> B{Check}\n"
            "   B -->|Yes| C[Process]\n"
            "   B -->|No| D[Stop]\n"
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
            return {"score": 0.0, "level": "low", "reason": "No sources found"}
        
        # Factors for confidence calculation
        avg_score = sum(s.get('score', 0) for s in sources) / len(sources) if sources else 0
        num_sources = len(sources)
        code_sources = sum(1 for s in sources if 'code' in s.get('file', '').lower())
        
        # Calculate base confidence
        confidence = 0.0
        
        # Source quality (40% weight)
        if avg_score > 0.7:
            confidence += 0.4
        elif avg_score > 0.5:
            confidence += 0.3
        elif avg_score > 0.3:
            confidence += 0.2
        else:
            confidence += 0.1
        
        # Number of sources (30% weight)
        if num_sources >= 5:
            confidence += 0.3
        elif num_sources >= 3:
            confidence += 0.2
        else:
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
        else:
            level = "low"
            reason = "Limited source relevance or coverage"
        
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
            
            # 4. Optimized single-pass retrieval (ONLY 1 API call)
            # A. Semantic Search (Vector)
            retriever = self.index.as_retriever(similarity_top_k=top_k * 2) # Get more candidates for fusion
            semantic_nodes = retriever.retrieve(rewritten_query)
            
            # B. Keyword Search (BM25-like)
            # We need to access the underlying docstore or nodes for keyword search
            # Since Pinecone doesn't support direct keyword search easily without metadata,
            # we'll use the results from semantic search + cache or just rely on semantic for now if full store isn't available.
            # However, to be truly hybrid, we should ideally query Pinecone with hybrid (sparse-dense) if configured.
            # Given the constraints and existing code, we will iterate on the *retrieved* semantic nodes and potentially
            # some expanded context if we had a full local store, but here we will focus on Reranking the semantic results first.
            
            # actually, let's just stick to the plan: "Enhance ... with advanced techniques"
            # We will use the HybridRetriever to Rerank the semantic nodes we got.
            # AND if we can, we should try to fetch a bit more.
            
            # Let's use the local file text for keyword search if we considered them "loaded", 
            # but we only have vector store index. 
            # So we will proceed with: Retrieve -> Rerank (using HybridRetriever logic).
            
            # Extract nodes from NodeWithScore objects
            semantic_node_tuples = [(n.node, n.score) for n in semantic_nodes]
            
            # In a true hybrid setup with a local docstore, we would do a separate keyword search over all docs.
            # Since we are serverless/pinecone only, we can't easily iterate all docs for BM25 without fetching them.
            # So we will use the "Rerank" capability of our HybridRetriever to refine the Semantic results.
            
            # C. Reranking
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
            
            # Single LLM Call
            response_text = str(self.llm.complete(final_prompt))
            
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
            
            # Build final response
            final_response = {
                "success": True,
                "answer": str(response),
                "sources": sources,
                "confidence": confidence,
                "intent": intent.value
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
            
            # 4. Async Retrieval (Run sync retrieval in thread pool)
            import asyncio
            retriever = self.index.as_retriever(similarity_top_k=top_k * 2)
            nodes = await asyncio.to_thread(retriever.retrieve, rewritten_query)
            
            # --- START HYBRID RERANKING ---
            # Extract nodes
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
            # --- END HYBRID RERANKING ---
            
            # Construct Context
            context_text = "\n\n".join([n.get_content() for n in nodes])
            final_prompt = qa_template.format(context_str=context_text, query_str=rewritten_query)
            
            # 5. Async LLM Call
            response_obj = await self.llm.acomplete(final_prompt)
            response_text = str(response_obj)
            
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
