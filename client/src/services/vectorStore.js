import { openDB } from 'idb';

/**
 * Client-side vector database using IndexedDB
 * Stores embeddings with metadata and performs similarity search
 */
class VectorStore {
  constructor() {
    this.db = null;
    this.dbName = 'reporag-vectors';
    this.dbVersion = 1;
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    if (this.db) return this.db;

    this.db = await openDB(this.dbName, this.dbVersion, {
      upgrade(db) {
        // Store for repository metadata
        if (!db.objectStoreNames.contains('repositories')) {
          const repoStore = db.createObjectStore('repositories', { keyPath: 'id' });
          repoStore.createIndex('url', 'url', { unique: true });
          repoStore.createIndex('indexedAt', 'indexedAt');
        }

        // Store for vector embeddings
        if (!db.objectStoreNames.contains('vectors')) {
          const vectorStore = db.createObjectStore('vectors', { keyPath: 'id' });
          vectorStore.createIndex('repoId', 'repoId');
          vectorStore.createIndex('fileCategory', 'metadata.file_category');
        }

        // Store for query cache
        if (!db.objectStoreNames.contains('queryCache')) {
          const cacheStore = db.createObjectStore('queryCache', { keyPath: 'queryHash' });
          cacheStore.createIndex('repoId', 'repoId');
          cacheStore.createIndex('timestamp', 'timestamp');
        }
      },
    });

    console.log('[VectorStore] IndexedDB initialized');
    return this.db;
  }

  /**
   * Store repository metadata
   */
  async saveRepository(repoData) {
    await this.init();
    const repo = {
      id: repoData.id || this.generateRepoId(repoData.url),
      url: repoData.url,
      name: repoData.name || this.extractRepoName(repoData.url),
      indexedAt: Date.now(),
      chunkCount: repoData.chunkCount || 0,
      fileCount: repoData.fileCount || 0,
    };
    
    await this.db.put('repositories', repo);
    console.log('[VectorStore] Repository saved:', repo.name);
    return repo;
  }

  /**
   * Get repository by ID
   */
  async getRepository(repoId) {
    await this.init();
    return await this.db.get('repositories', repoId);
  }

  /**
   * List all repositories
   */
  async listRepositories() {
    await this.init();
    return await this.db.getAll('repositories');
  }

  /**
   * Delete repository and all its vectors
   */
  async deleteRepository(repoId) {
    await this.init();
    
    // Delete all vectors for this repo
    const tx = this.db.transaction(['vectors', 'repositories', 'queryCache'], 'readwrite');
    
    // Delete vectors
    const vectorIndex = tx.objectStore('vectors').index('repoId');
    const vectors = await vectorIndex.getAllKeys(repoId);
    for (const key of vectors) {
      await tx.objectStore('vectors').delete(key);
    }
    
    // Delete cache
    const cacheIndex = tx.objectStore('queryCache').index('repoId');
    const caches = await cacheIndex.getAllKeys(repoId);
    for (const key of caches) {
      await tx.objectStore('queryCache').delete(key);
    }
    
    // Delete repository
    await tx.objectStore('repositories').delete(repoId);
    
    await tx.done;
    console.log('[VectorStore] Repository deleted:', repoId);
  }

  /**
   * Upsert vectors (insert or update)
   */
  async upsert(repoId, vectors, options = {}) {
    await this.init();
    const { batchSize = 100 } = options;
    
    console.log(`[VectorStore] Upserting ${vectors.length} vectors for repo ${repoId}`);
    
    // Process in batches
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      const tx = this.db.transaction('vectors', 'readwrite');
      
      for (const vector of batch) {
        const record = {
          id: vector.id || `${repoId}_${Date.now()}_${Math.random()}`,
          repoId,
          vector: vector.vector,
          metadata: vector.metadata || {},
          text: vector.text || '',
          createdAt: Date.now(),
        };
        
        await tx.objectStore('vectors').put(record);
      }
      
      await tx.done;
      
      if (vectors.length > batchSize) {
        const progress = Math.min(i + batchSize, vectors.length);
        console.log(`[VectorStore] Stored ${progress}/${vectors.length} vectors`);
      }
    }
    
    console.log('[VectorStore] Upsert complete');
  }

  /**
   * Cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Search for similar vectors
   */
  async search(repoId, queryVector, options = {}) {
    await this.init();
    const {
      topK = 10,
      filter = null,
      minScore = 0.0,
    } = options;
    
    const startTime = performance.now();
    
    // Get all vectors for this repository
    const tx = this.db.transaction('vectors', 'readonly');
    const index = tx.objectStore('vectors').index('repoId');
    const allVectors = await index.getAll(repoId);
    
    console.log(`[VectorStore] Searching ${allVectors.length} vectors`);
    
    // Calculate similarities
    const results = allVectors
      .map(record => {
        // Apply filter if provided
        if (filter && !filter(record.metadata)) {
          return null;
        }
        
        const score = this.cosineSimilarity(queryVector, record.vector);
        
        if (score < minScore) {
          return null;
        }
        
        return {
          id: record.id,
          score,
          metadata: record.metadata,
          text: record.text,
        };
      })
      .filter(r => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    
    const duration = ((performance.now() - startTime) / 1000).toFixed(3);
    console.log(`[VectorStore] Search complete in ${duration}s, found ${results.length} results`);
    
    return results;
  }

  /**
   * Cache query results
   */
  async cacheQuery(repoId, query, results) {
    await this.init();
    const queryHash = await this.hashString(query);
    
    const cacheRecord = {
      queryHash,
      repoId,
      query,
      results,
      timestamp: Date.now(),
    };
    
    await this.db.put('queryCache', cacheRecord);
  }

  /**
   * Get cached query results
   */
  async getCachedQuery(repoId, query, maxAge = 3600000) { // 1 hour default
    await this.init();
    const queryHash = await this.hashString(query);
    
    const cached = await this.db.get('queryCache', queryHash);
    
    if (!cached || cached.repoId !== repoId) {
      return null;
    }
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp > maxAge) {
      await this.db.delete('queryCache', queryHash);
      return null;
    }
    
    console.log('[VectorStore] Cache hit for query');
    return cached.results;
  }

  /**
   * Clear old cache entries
   */
  async clearOldCache(maxAge = 3600000) {
    await this.init();
    const cutoff = Date.now() - maxAge;
    
    const tx = this.db.transaction('queryCache', 'readwrite');
    const index = tx.objectStore('queryCache').index('timestamp');
    const oldEntries = await index.getAllKeys(IDBKeyRange.upperBound(cutoff));
    
    for (const key of oldEntries) {
      await tx.objectStore('queryCache').delete(key);
    }
    
    await tx.done;
    console.log(`[VectorStore] Cleared ${oldEntries.length} old cache entries`);
  }

  /**
   * Get storage usage statistics
   */
  async getStats() {
    await this.init();
    
    const repos = await this.db.getAll('repositories');
    const vectors = await this.db.getAll('vectors');
    const cache = await this.db.getAll('queryCache');
    
    // Estimate storage size (rough approximation)
    const vectorSize = vectors.reduce((sum, v) => sum + (v.vector.length * 4) + JSON.stringify(v.metadata).length + v.text.length, 0);
    const cacheSize = cache.reduce((sum, c) => sum + JSON.stringify(c).length, 0);
    
    return {
      repositories: repos.length,
      vectors: vectors.length,
      cachedQueries: cache.length,
      estimatedSize: {
        vectors: this.formatBytes(vectorSize),
        cache: this.formatBytes(cacheSize),
        total: this.formatBytes(vectorSize + cacheSize),
      },
    };
  }

  /**
   * Helper: Generate repository ID from URL
   */
  generateRepoId(url) {
    return url.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }

  /**
   * Helper: Extract repository name from URL
   */
  extractRepoName(url) {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    return match ? `${match[1]}/${match[2]}` : url;
  }

  /**
   * Helper: Hash string for cache keys
   */
  async hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Helper: Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Export singleton instance
export const vectorStore = new VectorStore();
export default vectorStore;
