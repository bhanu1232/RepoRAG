import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GitBranch, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const RepoForm = ({ onRepoIndexed, isIndexed }) => {
    const [repoUrl, setRepoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [progress, setProgress] = useState(0);
    const [currentStage, setCurrentStage] = useState('');

    useEffect(() => {
        let interval;
        if (loading) {
            // Poll for progress every 500ms
            interval = setInterval(async () => {
                try {
                    const response = await axios.get(`${API_URL}/progress`);
                    console.log('Progress update:', response.data);
                    setProgress(response.data.progress);
                    setCurrentStage(response.data.stage);
                } catch (error) {
                    console.error('Error fetching progress:', error);
                }
            }, 500);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [loading]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!repoUrl || isIndexed) return;

        setLoading(true);
        setStatus(null);

        try {
            const response = await axios.post(`${API_URL}/index_repo`, {
                repo_url: repoUrl
            });

            setStatus('success');
            onRepoIndexed(repoUrl);
        } catch (error) {
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <div className="relative">
                    <input
                        type="url"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder={isIndexed ? "Repository loaded" : "GitHub URL..."}
                        className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all font-light disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading || isIndexed}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || !repoUrl || isIndexed}
                    className={`w-full py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2
            ${loading || !repoUrl || isIndexed
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-white text-black hover:bg-zinc-200'
                        }`}
                >
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
                    {loading ? 'Indexing...' : isIndexed ? 'Loaded' : 'Load Repo'}
                </button>

                {/* Progress Bar */}
                {loading && (
                    <div className="mt-2 space-y-2 animate-fadeIn">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-emerald-400 font-medium">{currentStage}</span>
                            <span className="text-gray-400">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300 ease-out rounded-full"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 mt-1 animate-fadeIn">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Ready to chat</span>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex items-center gap-2 text-xs text-red-400 mt-1 animate-fadeIn">
                        <AlertCircle className="h-3 w-3" />
                        <span>Failed to index</span>
                    </div>
                )}
            </form>
        </div>
    );
};

export default RepoForm;
