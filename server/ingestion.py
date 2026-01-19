import os
import shutil
import tempfile
from typing import List
from git import Repo
from llama_index.core import SimpleDirectoryReader, Document
from llama_index.core.node_parser import TokenTextSplitter
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.pinecone import PineconeVectorStore
from llama_index.core import VectorStoreIndex, StorageContext
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv

load_dotenv()


class RepositoryIngestion:
    """Handles cloning, chunking, and indexing of GitHub repositories."""
    
    def __init__(self):
        self.embed_model = HuggingFaceEmbedding(
            model_name="BAAI/bge-small-en-v1.5"
        )
        
        # Initialize Pinecone
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        
        index_name = os.getenv("PINECONE_INDEX_NAME", "reporag-index-v2")
        
        # Create index if it doesn't exist
        if index_name not in pc.list_indexes().names():
            pc.create_index(
                name=index_name,
                dimension=384,  # bge-small-en-v1.5 dimension
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1"
                )
            )
        
        self.pinecone_index = pc.Index(index_name)
        self.vector_store = PineconeVectorStore(pinecone_index=self.pinecone_index)
    
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
        
        try:
            # Clone the repository
            repo_path = self.clone_repository(repo_url)
            
            # Load and chunk the code
            nodes = self.load_and_chunk_code(repo_path)
            
            # Create storage context and index
            storage_context = StorageContext.from_defaults(
                vector_store=self.vector_store
            )
            
            # Create the index
            index = VectorStoreIndex(
                nodes=nodes,
                storage_context=storage_context,
                embed_model=self.embed_model,
                show_progress=True,
            )
            
            return {
                "success": True,
                "message": "Repository indexed successfully",
                "file_count": len(set([node.metadata.get("file_path", "") for node in nodes])),
                "chunk_count": len(nodes)
            }
            
        except Exception as e:
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
