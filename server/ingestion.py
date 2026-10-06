import os
import shutil
import tempfile
from typing import List
from git import Repo
from llama_index.core import SimpleDirectoryReader, Document, Settings
from llama_index.core.node_parser import TokenTextSplitter
from custom_embedding import GeminiRESTEmbedding
from llama_index.vector_stores.pinecone import PineconeVectorStore
from llama_index.core import VectorStoreIndex, StorageContext
from pinecone import Pinecone, ServerlessSpec
import time
from dotenv import load_dotenv
import gc

load_dotenv()


class RepositoryIngestion:
    """Handles cloning, chunking, and indexing of GitHub repositories."""
    
    def __init__(self, embed_model=None):
        # Switch to Gemini (Cloud-based, Free Tier)
        if embed_model:
            self.embed_model = embed_model
        else:
            self.embed_model = GeminiRESTEmbedding(
                 model_name="gemini-embedding-001"
            )
        
        # Configure global settings
        Settings.embed_model = self.embed_model

        # Progress and telemetry tracking
        self.progress = 0
        self.current_stage = "Ready"
        self.current_step = 0
        self.total_steps = 4
        self.start_time = None
        self.total_files = 0
        self.processed_files = 0
        self.total_nodes = 0
        self.processed_nodes = 0
        
        # Initialize Pinecone
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        
        # Use a new index name for optimized embeddings
        index_name = os.getenv("PINECONE_INDEX_NAME", "reporag-gemini")
        
        # Create index if it doesn't exist, or recreate if dimension mismatch
        existing_indexes = pc.list_indexes().names()
        
        should_create = True
        target_dimension = 3072  # Dimension for gemini-embedding-001
        
        if index_name in existing_indexes:
            index_info = pc.describe_index(index_name)
            if index_info.dimension != target_dimension:
                print(f"Dimension mismatch! Index has {index_info.dimension}, needed {target_dimension}. Deleting and recreating...")
                pc.delete_index(index_name)
                import time
                time.sleep(5)  # Wait for deletion to propagate
            else:
                should_create = False
        
        if should_create:
            print(f"Creating new Pinecone index: {index_name} (dim={target_dimension})")
            pc.create_index(
                name=index_name,
                dimension=target_dimension,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1"
                )
            )
        
        self.pinecone_index = pc.Index(index_name)
        self.vector_store = PineconeVectorStore(pinecone_index=self.pinecone_index)
    
    def _detect_file_type(self, file_path: str, content: str) -> str:
        """Detect file type for pre-filtering (Stage 1 - indexed)."""
        path_lower = file_path.lower()
        
        # Test files
        if 'test' in path_lower or 'spec' in path_lower or '__tests__' in path_lower:
            return 'test'
        
        # Configuration files
        if any(name in path_lower for name in ['config', 'settings', '.env', '.json', '.yaml', '.yml', '.toml', '.ini']):
            return 'config'
        
        # Build/deployment files
        if any(name in path_lower for name in ['dockerfile', 'makefile', 'package.json', 'requirements.txt', 'setup.py', 'build', 'deploy']):
            return 'build'
        
        # Documentation
        if path_lower.endswith('.md') or 'readme' in path_lower or 'docs' in path_lower:
            return 'docs'
        
        # Code files (default)
        code_extensions = ['.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php', '.swift', '.kt']
        if any(path_lower.endswith(ext) for ext in code_extensions):
            return 'code'
        
        return 'other'
    
    def _detect_language(self, file_path: str) -> str:
        """Detect programming language for pre-filtering (Stage 1 - indexed)."""
        ext = os.path.splitext(file_path)[1].lower()
        
        language_map = {
            '.py': 'python',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.go': 'go',
            '.rs': 'rust',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.md': 'markdown',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
        }
        
        return language_map.get(ext, 'unknown')
    
    def _calculate_directory_depth(self, file_path: str) -> int:
        """Calculate directory depth for pre-filtering (Stage 1 - indexed)."""
        # Normalize path separators
        normalized = file_path.replace('\\', '/')
        # Count directory levels (0 = root)
        depth = normalized.count('/')
        return min(depth, 5)  # Cap at 5 for indexing efficiency
    
    def _categorize_file_size(self, content: str) -> str:
        """Categorize file size for pre-filtering (Stage 1 - indexed)."""
        size = len(content)
        
        if size < 1000:
            return 'small'
        elif size < 10000:
            return 'medium'
        else:
            return 'large'
    
    def _calculate_complexity_score(self, content: str, language: str) -> int:
        """Calculate code complexity heuristic for post-filtering (Stage 3 - non-indexed)."""
        # Simple heuristic based on control flow keywords
        complexity = 1
        
        # Count control flow statements
        control_keywords = ['if', 'else', 'elif', 'for', 'while', 'switch', 'case', 'try', 'catch', 'except']
        for keyword in control_keywords:
            complexity += content.lower().count(f' {keyword} ') + content.lower().count(f'\n{keyword} ')
        
        # Normalize to 1-10 scale
        return min(max(1, complexity // 5), 10)
    
    def _extract_code_features(self, content: str, language: str) -> dict:
        """Extract code features for post-filtering (Stage 3 - non-indexed)."""
        content_lower = content.lower()
        
        features = {
            'has_class_definition': False,
            'has_function_definition': False,
            'has_imports': False,
            'has_tests': False,
            'word_count': len(content.split()),
        }
        
        # Detect class definitions
        if language == 'python':
            features['has_class_definition'] = 'class ' in content
            features['has_function_definition'] = 'def ' in content
            features['has_imports'] = 'import ' in content or 'from ' in content
            features['has_tests'] = 'test_' in content_lower or 'assert' in content_lower
        elif language in ['javascript', 'typescript']:
            features['has_class_definition'] = 'class ' in content
            features['has_function_definition'] = 'function ' in content or '=>' in content
            features['has_imports'] = 'import ' in content or 'require(' in content
            features['has_tests'] = 'test(' in content_lower or 'describe(' in content_lower or 'it(' in content_lower
        elif language == 'java':
            features['has_class_definition'] = 'class ' in content or 'interface ' in content
            features['has_function_definition'] = 'public ' in content or 'private ' in content
            features['has_imports'] = 'import ' in content
            features['has_tests'] = '@test' in content_lower or 'junit' in content_lower
        
        return features
    
    def update_progress(self, stage: str, progress: int, step: int = 1, current_node: int = 0, total_nodes: int = 0):
        """Update the current progress and telemetry."""
        self.current_stage = stage
        self.progress = min(100, max(0, progress))
        self.current_step = step
        if current_node > 0:
            self.processed_nodes = current_node
        if total_nodes > 0:
            self.total_nodes = total_nodes
        print(f"Progress: {self.progress}% [Step {self.current_step}/4] - {stage}")

    def get_progress_status(self) -> dict:
        """Return structured telemetry for live client polling."""
        elapsed = int(time.time() - self.start_time) if self.start_time else 0
        estimated_remaining = None
        
        if self.progress > 5 and self.progress < 100 and elapsed > 0:
            total_estimated = (elapsed / (self.progress / 100))
            estimated_remaining = max(1, int(total_estimated - elapsed))
            
        is_large = self.total_files > 40 or self.total_nodes > 80 or elapsed > 20
        
        return {
            "progress": self.progress,
            "stage": self.current_stage,
            "step": self.current_step,
            "total_steps": self.total_steps,
            "elapsed_seconds": elapsed,
            "estimated_remaining_seconds": estimated_remaining,
            "total_files": self.total_files,
            "total_nodes": self.total_nodes,
            "processed_nodes": self.processed_nodes,
            "is_large_repo": is_large,
        }
    
    def clear_index(self):
        """Clear all vectors from the Pinecone index."""
        try:
            print("Clearing existing data from Pinecone index...")
            # Delete all vectors from the index
            self.pinecone_index.delete(delete_all=True)
            print("Pinecone index cleared successfully.")
        except Exception as e:
            # If the index/namespace doesn't exist or is empty, Pinecone might throw a 404
            # We can safely ignore this as the goal (clearing it) is effectively achieved
            if "Not Found" in str(e) or "Namespace not found" in str(e):
                print("Index/Namespace already empty or not found. Skipping clear.")
            else:
                print(f"Error clearing index: {str(e)}")
                raise Exception(f"Failed to clear index: {str(e)}")
    
    def clone_repository(self, repo_url: str) -> str:
        """Clone a GitHub repository to a temporary directory."""
        temp_dir = tempfile.mkdtemp(prefix="reporag_")
        
        try:
            print(f"Cloning repository: {repo_url}")
            Repo.clone_from(repo_url, temp_dir, depth=1)
            print(f"Repository cloned to: {temp_dir}")
            return temp_dir
        except Exception as e:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise Exception(f"Failed to clone repository: {str(e)}")
    
    def load_and_chunk_code(self, repo_path: str) -> List[Document]:
        """Load code files and chunk them appropriately."""
        # Load files from the repository
        reader = SimpleDirectoryReader(
            input_dir=repo_path,
            recursive=True,
            required_exts=[".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".cpp", ".c", ".go", ".rs", ".md"],
            exclude_hidden=True,
        )
        
        documents = reader.load_data()
        print(f"Loaded {len(documents)} files")
        
        # Clean up file paths and categorize files with RICH METADATA
        for doc in documents:
            if "file_path" in doc.metadata:
                # Convert absolute path to relative path
                abs_path = doc.metadata["file_path"]
                rel_path = os.path.relpath(abs_path, repo_path)
                # Normalize slashes for consistency
                clean_path = rel_path.replace("\\", "/")
                doc.metadata["file_path"] = clean_path
                
                # Get file content for analysis
                content = doc.text
                
                # === STAGE 1: PRE-FILTER METADATA (Indexed in Pinecone) ===
                doc.metadata["file_type"] = self._detect_file_type(clean_path, content)
                doc.metadata["language"] = self._detect_language(clean_path)
                doc.metadata["directory_depth"] = self._calculate_directory_depth(clean_path)
                doc.metadata["file_size_category"] = self._categorize_file_size(content)
                
                # Legacy category (keep for backward compatibility)
                ext = os.path.splitext(clean_path)[1].lower()
                doc.metadata["file_category"] = "code" if ext in ['.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cpp', '.c', '.go', '.rs'] else "docs"
                
                # === STAGE 3: POST-FILTER METADATA (Non-indexed) ===
                language = doc.metadata["language"]
                code_features = self._extract_code_features(content, language)
                doc.metadata.update(code_features)
                doc.metadata["complexity_score"] = self._calculate_complexity_score(content, language)
                
                print(f"Processed: {clean_path} | Type: {doc.metadata['file_type']} | Lang: {language} | Depth: {doc.metadata['directory_depth']}")

        # Chunk the code using TokenTextSplitter with optimized parameters for depth
        splitter = TokenTextSplitter(
            chunk_size=600,  # Smaller chunks for more precise retrieval
            chunk_overlap=150, # More overlap to preserve context across chunks
            separator="\n"
        )
        
        nodes = splitter.get_nodes_from_documents(documents)
        
        # Post-process nodes to add exact line numbers
        success_count = 0
        for node in nodes:
            try:
                # Find the corresponding parent document
                parent_doc = next((doc for doc in documents if doc.doc_id == node.ref_doc_id), None)
                if parent_doc:
                    # Strategy 1: Exact match
                    start_char_idx = parent_doc.text.find(node.text)
                    
                    # Strategy 2: If exact match fails, try stripping whitespace
                    if start_char_idx == -1:
                        start_char_idx = parent_doc.text.find(node.text.strip())
                    
                    if start_char_idx != -1:
                        # Calculate line numbers
                        lines_before = parent_doc.text[:start_char_idx].count('\n') + 1
                        lines_in_chunk = node.text.count('\n')
                        
                        node.metadata["start_line"] = lines_before
                        node.metadata["end_line"] = lines_before + lines_in_chunk
                        success_count += 1
                    else:
                        print(f"Could not find chunk text in {node.metadata.get('file_path')}")
                        node.metadata["start_line"] = "N/A"
                        node.metadata["end_line"] = "N/A"
            except Exception as e:
                print(f"Error calculating lines for node: {e}")
                
        print(f"Created {len(nodes)} chunks. Line numbers calculated for {success_count}/{len(nodes)} chunks.")
        print(f"Metadata enrichment complete: {len(nodes)} chunks with Stage 1 (indexed) + Stage 3 (non-indexed) filters")
        
        return nodes
    
    def index_repository(self, repo_url: str) -> dict:
        """Main method to clone, chunk, and index a repository."""
        repo_path = None
        
        # Reset progress and start timer
        self.start_time = time.time()
        self.progress = 0
        self.current_stage = "Initializing index environment"
        self.current_step = 1
        self.total_files = 0
        self.total_nodes = 0
        self.processed_nodes = 0
        
        try:
            # Step 1: Clear existing data (0-10%)
            self.update_progress("Cleaning up previous index & preparing vector store", 5, step=1)
            self.clear_index()
            self.update_progress("Index space ready", 10, step=1)
            
            # Step 2: Clone the repository (10-30%)
            self.update_progress("Cloning Git repository & analyzing branches", 15, step=2)
            repo_path = self.clone_repository(repo_url)
            self.update_progress("Repository cloned successfully", 30, step=2)
            
            # Step 3: Load and chunk the code (30-60%)
            self.update_progress("Parsing source files & generating AST chunks", 35, step=3)
            nodes = self.load_and_chunk_code(repo_path)
            
            self.total_nodes = len(nodes)
            self.total_files = len(set([node.metadata.get("file_path", "") for node in nodes]))
            self.update_progress(f"Extracted {self.total_nodes} chunks from {self.total_files} files", 60, step=3)
            
            # Step 4: Create embeddings and index (60-100%)
            self.update_progress("Initializing Gemini embedding model & vector pipeline", 65, step=4)
            
            storage_context = StorageContext.from_defaults(
                vector_store=self.vector_store
            )
            
            # Initialize index from vector store (empty at this point)
            index = VectorStoreIndex.from_vector_store(
                vector_store=self.vector_store,
                storage_context=storage_context,
                embed_model=self.embed_model,
            )
            
            # Process nodes in batches (50 provides a good balance of speed vs Railway memory)
            batch_size = 50
            total_nodes = len(nodes)
            
            print(f"Indexing {total_nodes} nodes in batches of {batch_size}...")
            
            for i in range(0, total_nodes, batch_size):
                batch_nodes = nodes[i : i + batch_size]
                current_node = min(i + len(batch_nodes), total_nodes)
                
                # Calculate progress (65% to 95%)
                progress_percent = 65 + int(30 * (current_node / max(1, total_nodes)))
                self.update_progress(
                    f"Generating neural embeddings ({current_node}/{total_nodes} chunks)", 
                    progress_percent, 
                    step=4,
                    current_node=current_node,
                    total_nodes=total_nodes
                )
                
                try:
                    index.insert_nodes(batch_nodes)
                except Exception as e:
                    print(f"Error indexing batch around node {current_node}: {e}")
                    # Log but continue with next batch to salvage what we can
                    continue
                
                # Garbage collection
                if i % 5 == 0:
                    gc.collect()
            
            self.update_progress("Finalizing index & building neural graphs", 95, step=4)
            self.update_progress("Repository indexing complete!", 100, step=4)
            
            return {
                "success": True,
                "message": "Repository indexed successfully",
                "file_count": self.total_files,
                "chunk_count": self.total_nodes,
                "elapsed_seconds": int(time.time() - self.start_time)
            }
            
        except Exception as e:
            self.update_progress(f"Error occurred: {str(e)}", 0, step=0)
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"Error indexing repository: {str(e)}"
            }
        
        finally:
            # Cleanup: remove the cloned repository
            if repo_path and os.path.exists(repo_path):
                shutil.rmtree(repo_path, ignore_errors=True)
