import embeddingEngine from './embeddingEngine';
import vectorStore from './vectorStore';

/**
 * Query service - handles RAG queries with client-side vector search
 */
class QueryService {
  constructor() {
    this.cacheEnabled = true;
    this.cacheMaxAge = 3600000; // 1 hour
  }

  /**
   * Query the indexed codebase
   */
  async query(repoId, queryText, options = {}) {
    const {
      topK = 10,
      useCache = true,
      streamResponse = false,
    } = options;

    try {
      // Step 1: Check cache
      if (useCache && this.cacheEnabled) {
        const cached = await vectorStore.getCachedQuery(repoId, queryText, this.cacheMaxAge);
        if (cached) {
          console.log('[QueryService] Returning cached result');
          return cached;
        }
      }

      const startTime = performance.now();

      // Step 2: Generate query embedding (client-side)
      console.log('[QueryService] Generating query embedding...');
      const queryEmbedding = await embeddingEngine.embed(queryText);

      // Step 3: Search local vectors (client-side)
      console.log('[QueryService] Searching local vectors...');
      const searchResults = await vectorStore.search(repoId, queryEmbedding, {
        topK,
        minScore: 0.3, // Filter low-relevance results
      });

      if (searchResults.length === 0) {
        return {
          answer: 'No relevant information found in the indexed repository.',
          sources: [],
          confidence: { score: 0, level: 'none' },
        };
      }

      // Step 4: Build context from retrieved chunks
      const context = searchResults
        .map((result, idx) => {
          const file = result.metadata.file || 'unknown';
          const lines = result.metadata.start_line && result.metadata.end_line
            ? `L${result.metadata.start_line}-${result.metadata.end_line}`
            : '';
          
          return `[Source ${idx + 1}] ${file}${lines ? ` (${lines})` : ''}:\n${result.text}`;
        })
        .join('\n\n---\n\n');

      // Step 5: Call server LLM gateway
      console.log('[QueryService] Calling LLM...');
      const API_URL = 'https://reporag.onrender.com';
      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          query: queryText,
          stream: streamResponse,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();

      const result = {
        answer: data.answer,
        sources: searchResults.map(r => ({
          file: r.metadata.file,
          startLine: r.metadata.start_line,
          endLine: r.metadata.end_line,
          score: r.score,
          text: r.text.substring(0, 200) + '...',
        })),
        confidence: data.confidence || { score: 0.8, level: 'high' },
        latency: {
          total: ((performance.now() - startTime) / 1000).toFixed(2),
          embedding: 'client-side',
          search: 'client-side',
          llm: 'server-side',
        },
      };

      // Step 6: Cache result
      if (useCache && this.cacheEnabled) {
        await vectorStore.cacheQuery(repoId, queryText, result);
      }

      console.log(`[QueryService] Query complete in ${result.latency.total}s`);
      return result;

    } catch (error) {
      console.error('[QueryService] Error:', error);
      throw error;
    }
  }

  /**
   * Clear query cache
   */
  async clearCache(repoId = null) {
    if (repoId) {
      // TODO: Clear cache for specific repo
      console.log('[QueryService] Clearing cache for repo:', repoId);
    } else {
      await vectorStore.clearOldCache(0); // Clear all
      console.log('[QueryService] All cache cleared');
    }
  }

  /**
   * Enable/disable caching
   */
  setCacheEnabled(enabled) {
    this.cacheEnabled = enabled;
    console.log('[QueryService] Cache', enabled ? 'enabled' : 'disabled');
  }
}

export const queryService = new QueryService();
export default queryService;
