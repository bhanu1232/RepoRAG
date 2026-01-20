import os
from typing import List, Dict, Any
from llama_index.core import VectorStoreIndex, PromptTemplate
from llama_index.llms.groq import Groq
from llama_index.llms.gemini import Gemini
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
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
        self.groq_llm = Groq(
            model="llama-3.1-8b-instant",
            api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.1,
        )
        
        # Initialize Gemini LLM (optional - fallback to Groq if fails)
        try:
            self.gemini_llm = Gemini(
                model="gemini-3-flash-preview",
                api_key=os.getenv("GEMINI_API_KEY"),
                temperature=0.1,
            )
            self.gemini_available = True
            print("Gemini LLM initialized successfully")
        except Exception as e:
            print(f"Warning: Gemini LLM initialization failed: {e}")
            print("Falling back to Groq only")
            self.gemini_llm = None
            self.gemini_available = False
        
        # Set default LLM to Groq
        self.llm = self.groq_llm
        self.current_model = "groq"
        
        # Initialize embedding model (same as ingestion)
        self.embed_model = HuggingFaceEmbedding(
            model_name="BAAI/bge-small-en-v1.5"
        )
        
        # Initialize Pinecone
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        index_name = os.getenv("PINECONE_INDEX_NAME", "reporag-index-v2")
        
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
    
    def set_llm(self, model: str):
        """Switch between Groq and Gemini LLMs."""
        if model.lower() == "gemini":
            if self.gemini_available and self.gemini_llm:
                self.llm = self.gemini_llm
                self.current_model = "gemini"
            else:
                print("Gemini not available, using Groq")
                self.llm = self.groq_llm
                self.current_model = "groq"
        else:
            self.llm = self.groq_llm
            self.current_model = "groq"
    
    def _get_intent_specific_instructions(self, intent: QueryIntent) -> str:
        """Get specialized instructions based on query intent."""
        instructions = {
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
            "You are RepoRAG, an elite Senior Software Engineer and Architect with deep expertise in code analysis.\\n"
            "Your mission: Provide HIGHLY ACCURATE, DETAILED technical responses based on the provided code context.\\n\\n"
            "---------------------\\n"
            "{context_str}\\n"
            "---------------------\\n\\n"
            "QUERY INTENT: " + intent.value.upper() + "\\n"
            "SPECIALIZED INSTRUCTIONS: " + intent_instructions + "\\n\\n"
            "STRICT FORMATTING RULES:\\n"
            "1. **Structure**: Use `###` headers to organize your answer into clear sections\\n"
            "   - Start with a brief summary\\n"
            "   - Follow with detailed technical analysis\\n"
            "   - End with key takeaways or next steps\\n\\n"
            "2. **Code References**: ALWAYS cite specific code using backticks (`code`)\\n"
            "   - Reference function names, class names, variables\\n"
            "   - Quote important code snippets\\n"
            "   - Mention file paths when relevant\\n\\n"
            "3. **Content Style**:\\n"
            "   - Use paragraphs for explanations and context\\n"
            "   - Use bullet points for lists of features, steps, or key points\\n"
            "   - Use numbered lists for sequential processes\\n"
            "   - Use code blocks for code examples\\n\\n"
            "4. **Accuracy Priority**:\\n"
            "   - Base your answer 100% on the provided code context\\n"
            "   - If source code is available, prioritize it over documentation\\n"
            "   - If information is not in the context, clearly state that\\n"
            "   - Never hallucinate or make assumptions\\n\\n"
            "5. **Technical Depth**:\\n"
            "   - Provide in-depth technical analysis\\n"
            "   - Explain logic flows and data transformations\\n"
            "   - Discuss design patterns and architectural decisions\\n"
            "   - Include relevant technical details\\n\\n"
            "6. **Clarity**: Write clearly and concisely\\n"
            "   - Avoid phrases like 'Based on the context' or 'The code mentions'\\n"
            "   - Get straight to the technical details\\n"
            "   - Use professional but accessible language\\n\\n"
            "Query: {query_str}\\n\\n"
            "Provide your detailed technical analysis:\\n"
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
            
            # 4. Optimized single-pass retrieval (ONLY 1 API call)
            query_engine = self.index.as_query_engine(
                llm=self.llm,
                similarity_top_k=5,  # Reduced to 5 most relevant chunks
                response_mode="compact",  # Single-pass generation
                text_qa_template=qa_template,
            )
            
            # Execute the query
            response = query_engine.query(rewritten_query)
            
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
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "answer": f"Error processing query: {str(e)}",
                "sources": [],
                "confidence": {"score": 0.0, "level": "low", "reason": "Error occurred"}
            }
