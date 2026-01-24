import embeddingEngine from './embeddingEngine';
import vectorStore from './vectorStore';

/**
 * Indexing service - orchestrates client-side repository indexing
 */
class IndexingService {
  constructor() {
    this.currentIndexing = null;
    this.progressCallback = null;
  }

  /**
   * Index a repository
   */
  async indexRepository(repoUrl, options = {}) {
    const {
      onProgress = null,
      batchSize = 100,
    } = options;

    this.progressCallback = onProgress;

    try {
      this.updateProgress('Requesting repository chunks from server...', 0);

      // Step 1: Request server to clone and chunk repository
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/clone-and-chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const { chunks, metadata } = await response.json();
      console.log(`[IndexingService] Received ${chunks.length} chunks from server`);

      // Step 2: Save repository metadata
      this.updateProgress('Saving repository metadata...', 5);
      const repo = await vectorStore.saveRepository({
        url: repoUrl,
        name: metadata.name,
        chunkCount: chunks.length,
        fileCount: metadata.fileCount,
      });

      // Step 3: Generate embeddings in batches
      this.updateProgress('Generating embeddings in browser...', 10);
      const allVectors = [];

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const texts = batch.map(c => c.text);

        // Generate embeddings for this batch
        const embeddings = await embeddingEngine.embed(texts);

        // Prepare vector records
        const vectors = batch.map((chunk, idx) => ({
          id: chunk.id,
          vector: embeddings[idx],
          metadata: chunk.metadata,
          text: chunk.text,
        }));

        allVectors.push(...vectors);

        // Update progress (10% to 80%)
        const progress = 10 + Math.floor((i / chunks.length) * 70);
        this.updateProgress(
          `Embedding chunks: ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`,
          progress
        );
      }

      // Step 4: Store vectors in IndexedDB
      this.updateProgress('Storing vectors in browser...', 85);
      await vectorStore.upsert(repo.id, allVectors);

      // Step 5: Optional - sync to server backup
      if (options.syncToServer) {
        this.updateProgress('Syncing to server backup...', 95);
        await this.syncToServer(repo.id, allVectors);
      }

      this.updateProgress('Indexing complete!', 100);

      return {
        success: true,
        repoId: repo.id,
        chunkCount: chunks.length,
        fileCount: metadata.fileCount,
      };

    } catch (error) {
      console.error('[IndexingService] Error:', error);
      this.updateProgress(`Error: ${error.message}`, 0);
      throw error;
    }
  }

  /**
   * Update an existing repository (incremental)
   */
  async updateRepository(repoId, options = {}) {
    this.updateProgress('Checking for changes...', 0);

    try {
      const repo = await vectorStore.getRepository(repoId);
      if (!repo) {
        throw new Error('Repository not found');
      }

      // Request changed files from server
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/get-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repo.url }),
      });

      const { changedChunks, deletedChunkIds } = await response.json();

      if (changedChunks.length === 0 && deletedChunkIds.length === 0) {
        this.updateProgress('No changes detected', 100);
        return { success: true, changes: 0 };
      }

      console.log(`[IndexingService] ${changedChunks.length} changed, ${deletedChunkIds.length} deleted`);

      // Generate embeddings for changed chunks
      this.updateProgress(`Re-embedding ${changedChunks.length} changed chunks...`, 30);
      const texts = changedChunks.map(c => c.text);
      const embeddings = await embeddingEngine.embed(texts);

      const vectors = changedChunks.map((chunk, idx) => ({
        id: chunk.id,
        vector: embeddings[idx],
        metadata: chunk.metadata,
        text: chunk.text,
      }));

      // Update vectors
      this.updateProgress('Updating vector store...', 80);
      await vectorStore.upsert(repoId, vectors);

      // TODO: Delete removed chunks

      this.updateProgress('Update complete!', 100);

      return {
        success: true,
        changes: changedChunks.length + deletedChunkIds.length,
      };

    } catch (error) {
      console.error('[IndexingService] Update error:', error);
      throw error;
    }
  }

  /**
   * Sync vectors to server backup (optional)
   */
  async syncToServer(repoId, vectors) {
    // TODO: Implement server sync
    console.log('[IndexingService] Server sync not yet implemented');
  }

  /**
   * Update progress
   */
  updateProgress(message, percent) {
    console.log(`[IndexingService] ${percent}% - ${message}`);
    if (this.progressCallback) {
      this.progressCallback({ message, percent });
    }
  }

  /**
   * Cancel current indexing
   */
  cancel() {
    // TODO: Implement cancellation
    this.currentIndexing = null;
  }
}

export const indexingService = new IndexingService();
export default indexingService;
