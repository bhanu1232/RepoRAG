import { useState, useEffect } from 'react';
import embeddingEngine from '../services/embeddingEngine';
import vectorStore from '../services/vectorStore';
import indexingService from '../services/indexingService';
import queryService from '../services/queryService';

/**
 * Demo component to test hybrid client-server architecture
 */
export default function HybridDemo() {
    const [status, setStatus] = useState('Initializing...');
    const [modelInfo, setModelInfo] = useState(null);
    const [webGPU, setWebGPU] = useState(null);
    const [repos, setRepos] = useState([]);
    const [stats, setStats] = useState(null);
    const [indexing, setIndexing] = useState(false);
    const [progress, setProgress] = useState({ message: '', percent: 0 });

    useEffect(() => {
        checkCapabilities();
        loadRepositories();
        loadStats();
    }, []);

    const checkCapabilities = async () => {
        try {
            const isWebGPU = await embeddingEngine.isWebGPUAvailable();
            setWebGPU(isWebGPU);

            const info = embeddingEngine.getModelInfo();
            setModelInfo(info);

            setStatus(isWebGPU ? 'WebGPU Available ⚡' : 'WASM Fallback');
        } catch (error) {
            setStatus('Error: ' + error.message);
        }
    };

    const loadRepositories = async () => {
        const repoList = await vectorStore.listRepositories();
        setRepos(repoList);
    };

    const loadStats = async () => {
        const storageStats = await vectorStore.getStats();
        setStats(storageStats);
    };

    const handleIndexRepo = async () => {
        const repoUrl = prompt('Enter GitHub repository URL:');
        if (!repoUrl) return;

        setIndexing(true);
        try {
            await indexingService.indexRepository(repoUrl, {
                onProgress: (prog) => {
                    setProgress(prog);
                },
            });

            await loadRepositories();
            await loadStats();
            alert('Indexing complete!');
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            setIndexing(false);
        }
    };

    const handleQuery = async (repoId) => {
        const query = prompt('Ask a question about the codebase:');
        if (!query) return;

        try {
            const result = await queryService.query(repoId, query);
            console.log('Query result:', result);
            alert(`Answer: ${result.answer}\n\nLatency: ${result.latency.total}s\nSources: ${result.sources.length}`);
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleDelete = async (repoId) => {
        if (!confirm('Delete this repository?')) return;

        await vectorStore.deleteRepository(repoId);
        await loadRepositories();
        await loadStats();
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Hybrid Client-Server RAG Demo</h1>

            {/* System Status */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <h2 className="text-xl font-semibold mb-3">System Status</h2>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>Status:</span>
                        <span className="font-mono">{status}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>WebGPU:</span>
                        <span className={webGPU ? 'text-green-400' : 'text-yellow-400'}>
                            {webGPU ? '✓ Available' : '✗ Not Available'}
                        </span>
                    </div>
                    {modelInfo && (
                        <>
                            <div className="flex justify-between">
                                <span>Model:</span>
                                <span className="font-mono text-xs">{modelInfo.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Dimension:</span>
                                <span className="font-mono">{modelInfo.dimension}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Loaded:</span>
                                <span className={modelInfo.loaded ? 'text-green-400' : 'text-gray-400'}>
                                    {modelInfo.loaded ? '✓' : '✗'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Storage Stats */}
            {stats && (
                <div className="bg-gray-800 rounded-lg p-4 mb-6">
                    <h2 className="text-xl font-semibold mb-3">Storage Stats</h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Repositories:</span>
                            <span className="font-mono">{stats.repositories}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Vectors:</span>
                            <span className="font-mono">{stats.vectors.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Cached Queries:</span>
                            <span className="font-mono">{stats.cachedQueries}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Total Size:</span>
                            <span className="font-mono">{stats.estimatedSize.total}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Indexing Progress */}
            {indexing && (
                <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-6">
                    <div className="flex justify-between mb-2">
                        <span className="font-semibold">Indexing...</span>
                        <span className="font-mono">{progress.percent}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                        <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>
                    <div className="text-sm text-gray-300">{progress.message}</div>
                </div>
            )}

            {/* Actions */}
            <div className="mb-6">
                <button
                    onClick={handleIndexRepo}
                    disabled={indexing}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold"
                >
                    {indexing ? 'Indexing...' : 'Index New Repository'}
                </button>
            </div>

            {/* Repositories List */}
            <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-xl font-semibold mb-3">Indexed Repositories</h2>
                {repos.length === 0 ? (
                    <p className="text-gray-400 text-sm">No repositories indexed yet</p>
                ) : (
                    <div className="space-y-3">
                        {repos.map((repo) => (
                            <div key={repo.id} className="bg-gray-700 rounded p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-semibold">{repo.name}</div>
                                        <div className="text-xs text-gray-400 font-mono">{repo.url}</div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(repo.id)}
                                        className="text-red-400 hover:text-red-300 text-sm"
                                    >
                                        Delete
                                    </button>
                                </div>
                                <div className="flex gap-4 text-xs text-gray-300 mb-2">
                                    <span>{repo.chunkCount} chunks</span>
                                    <span>{repo.fileCount} files</span>
                                    <span>Indexed {new Date(repo.indexedAt).toLocaleDateString()}</span>
                                </div>
                                <button
                                    onClick={() => handleQuery(repo.id)}
                                    className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                                >
                                    Ask Question
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg text-sm text-gray-300">
                <p className="font-semibold mb-2">🚀 Hybrid Architecture Features:</p>
                <ul className="list-disc list-inside space-y-1">
                    <li>Embeddings generated in browser (Transformers.js + WebGPU)</li>
                    <li>Vectors stored locally (IndexedDB)</li>
                    <li>Search happens client-side (no server calls!)</li>
                    <li>Only LLM generation uses server</li>
                    <li>Works offline after indexing</li>
                </ul>
            </div>
        </div>
    );
}
