import * as Comlink from 'comlink';
import { pipeline } from '@xenova/transformers';

/**
 * Web Worker for embedding generation
 * Runs Transformers.js in background thread to prevent UI blocking
 */
class EmbeddingWorker {
  constructor() {
    this.model = null;
    this.modelName = 'Xenova/all-MiniLM-L6-v2';
  }

  async loadModel() {
    if (this.model) return;

    console.log('[Worker] Loading embedding model...');
    this.model = await pipeline('feature-extraction', this.modelName, {
      device: 'webgpu',
    });
    console.log('[Worker] Model loaded');
  }

  async generateEmbeddings(texts, options = {}) {
    await this.loadModel();

    const {
      normalize = true,
      pooling = 'mean',
      batchSize = 32,
    } = options;

    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const output = await this.model(batch, {
        pooling,
        normalize,
      });
      
      const embeddings = Array.from(output.tolist());
      allEmbeddings.push(...embeddings);

      // Report progress
      if (texts.length > batchSize) {
        const progress = Math.min(i + batchSize, texts.length);
        self.postMessage({
          type: 'progress',
          current: progress,
          total: texts.length,
        });
      }
    }

    return allEmbeddings;
  }

  getModelInfo() {
    return {
      name: this.modelName,
      dimension: 384,
      loaded: this.model !== null,
    };
  }
}

// Expose worker methods via Comlink
Comlink.expose(new EmbeddingWorker());
