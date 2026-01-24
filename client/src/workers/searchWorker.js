import * as Comlink from 'comlink';

/**
 * Web Worker for vector similarity search
 * Performs SIMD-optimized cosine similarity calculations
 */
class SearchWorker {
  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    // SIMD-friendly loop
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async searchVectors(queryVector, vectors, options = {}) {
    const {
      topK = 10,
      minScore = 0.0,
    } = options;

    const results = [];

    for (let i = 0; i < vectors.length; i++) {
      const score = this.cosineSimilarity(queryVector, vectors[i].vector);

      if (score >= minScore) {
        results.push({
          index: i,
          score,
          id: vectors[i].id,
          metadata: vectors[i].metadata,
          text: vectors[i].text,
        });
      }

      // Report progress for large datasets
      if (vectors.length > 1000 && i % 1000 === 0) {
        self.postMessage({
          type: 'progress',
          current: i,
          total: vectors.length,
        });
      }
    }

    // Sort by score descending and take top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}

// Expose worker methods via Comlink
Comlink.expose(new SearchWorker());
