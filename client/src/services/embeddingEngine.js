import { pipeline, env } from '@xenova/transformers';

// Configure Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

/**
 * Client-side embedding engine using Transformers.js with WebGPU acceleration
 * Generates embeddings entirely in the browser for privacy and performance
 */
class EmbeddingEngine {
  constructor() {
    this.model = null;
    this.modelName = 'Xenova/all-MiniLM-L6-v2'; // 384 dimensions, 23MB
    this.isLoading = false;
    this.loadPromise = null;
  }

  /**
   * Load the embedding model (cached after first load)
   */
  async loadModel() {
    if (this.model) return this.model;
    
    if (this.isLoading) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = (async () => {
      try {
        console.log('[EmbeddingEngine] Loading model:', this.modelName);
        const startTime = performance.now();
        
        // Create feature extraction pipeline with WebGPU if available
        this.model = await pipeline('feature-extraction', this.modelName, {
          device: 'webgpu', // Will fallback to WASM if WebGPU unavailable
        });
        
        const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
        console.log(`[EmbeddingEngine] Model loaded in ${loadTime}s`);
        
        return this.model;
      } catch (error) {
        console.error('[EmbeddingEngine] Error loading model:', error);
        // Fallback to WASM if WebGPU fails
        try {
          console.log('[EmbeddingEngine] Falling back to WASM...');
          this.model = await pipeline('feature-extraction', this.modelName);
          return this.model;
        } catch (fallbackError) {
          console.error('[EmbeddingEngine] Fallback failed:', fallbackError);
          throw fallbackError;
        }
      } finally {
        this.isLoading = false;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Generate embeddings for a single text or batch of texts
   * @param {string|string[]} texts - Text(s) to embed
   * @param {Object} options - Options for embedding generation
   * @returns {Promise<number[]|number[][]>} Embedding vector(s)
   */
  async embed(texts, options = {}) {
    const {
      normalize = true,
      pooling = 'mean',
      batchSize = 32,
    } = options;

    await this.loadModel();

    const isSingle = typeof texts === 'string';
    const textArray = isSingle ? [texts] : texts;

    try {
      const startTime = performance.now();
      
      // Process in batches for better performance
      const allEmbeddings = [];
      
      for (let i = 0; i < textArray.length; i += batchSize) {
        const batch = textArray.slice(i, i + batchSize);
        
        // Generate embeddings
        const output = await this.model(batch, {
          pooling,
          normalize,
        });
        
        // Convert to regular arrays
        const embeddings = Array.from(output.tolist());
        allEmbeddings.push(...embeddings);
        
        // Log progress for large batches
        if (textArray.length > batchSize) {
          const progress = Math.min(i + batchSize, textArray.length);
          console.log(`[EmbeddingEngine] Processed ${progress}/${textArray.length} texts`);
        }
      }
      
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      const rate = (textArray.length / parseFloat(duration)).toFixed(1);
      console.log(`[EmbeddingEngine] Generated ${textArray.length} embeddings in ${duration}s (${rate} texts/sec)`);
      
      return isSingle ? allEmbeddings[0] : allEmbeddings;
    } catch (error) {
      console.error('[EmbeddingEngine] Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Get embedding dimension
   */
  getDimension() {
    return 384; // all-MiniLM-L6-v2 dimension
  }

  /**
   * Check if WebGPU is available
   */
  async isWebGPUAvailable() {
    if (!navigator.gpu) {
      return false;
    }
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get model info
   */
  getModelInfo() {
    return {
      name: this.modelName,
      dimension: this.getDimension(),
      loaded: this.model !== null,
      loading: this.isLoading,
    };
  }
}

// Export singleton instance
export const embeddingEngine = new EmbeddingEngine();
export default embeddingEngine;
