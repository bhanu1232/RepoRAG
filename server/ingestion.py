import os
import shutil
import tempfile
from typing import List
from git import Repo
from llama_index.core import SimpleDirectoryReader, Document
from llama_index.core.node_parser import TokenTextSplitter
from llama_index.embeddings.gemini import GeminiEmbedding
from llama_index.vector_stores.pinecone import PineconeVectorStore
from llama_index.core import VectorStoreIndex, StorageContext
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv

load_dotenv()


class RepositoryIngestion:
    """Handles cloning, chunking, and indexing of GitHub repositories."""
    
    def __init__(self):
        # Switch to Gemini Embedding (API-based) to save memory on Render
        self.embed_model = GeminiEmbedding(
            model_name="models/text-embedding-004",
            api_key=os.getenv("GEMINI_API_KEY")
        )
        
        # Progress tracking
        self.progress = 0
        self.current_stage = ""
        self.total_files = 0
        self.processed_files = 0
        
        # Initialize Pinecone
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        
        # Use a new index name for Gemini embeddings (different dimension)
        index_name = os.getenv("PINECONE_INDEX_NAME", "reporag-gemini")
        
        # Create index if it doesn't exist, or recreate if dimension mismatch
        existing_indexes = pc.list_indexes().names()
        
        should_create = True
        if index_name in existing_indexes:
            index_info = pc.describe_index(index_name)
            if index_info.dimension != 768:
                print(f"Dimension mismatch! Index has {index_info.dimension}, needed 768. Deleting and recreating...")
                pc.delete_index(index_name)
                import time
                time.sleep(5)  # Wait for deletion to propagate
            else:
                should_create = False
        
        if should_create:
            print(f"Creating new Pinecone index: {index_name} (dim=768)")
            pc.create_index(
                name=index_name,
                dimension=768,  # Gemini text-embedding-004 dimension
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1"
                )
            )
        
        self.pinecone_index = pc.Index(index_name)
        self.vector_store = PineconeVectorStore(pinecone_index=self.pinecone_index)
    
    def update_progress(self, stage: str, progress: int):
        """Update the current progress."""
        self.current_stage = stage
        self.progress = progress
        print(f"Progress: {progress}% - {stage}")
    
    def clear_index(self):
        """Clear all vectors from the Pinecone index."""
        try:
            print("Clearing existing data from Pinecone index...")
            # Delete all vectors from the index
            self.pinecone_index.delete(delete_all=True)
            print("Pinecone index cleared successfully.")
        except Exception as e:
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
        
        # Clean up file paths and categorize files
        for doc in documents:
            if "file_path" in doc.metadata:
                # Convert absolute path to relative path
                abs_path = doc.metadata["file_path"]
                rel_path = os.path.relpath(abs_path, repo_path)
                # Normalize slashes for consistency
                clean_path = rel_path.replace("\\", "/")
                doc.metadata["file_path"] = clean_path
                
                # Categorize file
                ext = os.path.splitext(clean_path)[1].lower()
                doc.metadata["file_category"] = "code" if ext in ['.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cpp', '.c', '.go', '.rs'] else "docs"

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
        
        return nodes
    
    def index_repository(self, repo_url: str) -> dict:
        """Main method to clone, chunk, and index a repository."""
        repo_path = None
        
        # Reset progress at start
        self.progress = 0
        self.current_stage = "Starting"
        
        try:
            # Stage 1: Clear existing data (0-10%)
            self.update_progress("Preparing index", 0)
            self.clear_index()
            self.update_progress("Index cleared", 10)
            
            # Stage 2: Clone the repository (10-30%)
            self.update_progress("Cloning repository", 15)
            repo_path = self.clone_repository(repo_url)
            self.update_progress("Repository cloned", 30)
            
            # Stage 3: Load and chunk the code (30-60%)
            self.update_progress("Processing files", 35)
            nodes = self.load_and_chunk_code(repo_path)
            self.update_progress("Files processed", 60)
            
            # Stage 4: Create embeddings and index (60-100%)
            self.update_progress("Creating embeddings", 65)
            storage_context = StorageContext.from_defaults(
                vector_store=self.vector_store
            )
            
            self.update_progress("Indexing vectors", 75)
            # Create the index
            index = VectorStoreIndex(
                nodes=nodes,
                storage_context=storage_context,
                embed_model=self.embed_model,
                show_progress=True,
            )
            
            self.update_progress("Complete", 100)
            
            return {
                "success": True,
                "message": "Repository indexed successfully",
                "file_count": len(set([node.metadata.get("file_path", "") for node in nodes])),
                "chunk_count": len(nodes)
            }
            
        except Exception as e:
            self.update_progress("Error occurred", 0)
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
