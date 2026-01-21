import React, { useState } from 'react';
import axios from 'axios';
import { GitBranch, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const RepoForm = ({ onRepoIndexed, isIndexed }) => {
    const [repoUrl, setRepoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [progress, setProgress] = useState(0);
    const [currentStage, setCurrentStage] = useState('');

    // Polling is now handled in handleSubmit function

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!repoUrl || isIndexed) return;

        setLoading(true);
        setStatus(null);
        setProgress(0);
        setCurrentStage('Starting...');

        try {
            // Start indexing (returns immediately)
            const response = await axios.post(`${API_URL}/index_repo`, {
                repo_url: repoUrl
            });

            console.log('Indexing started:', response.data);

            // Now poll for completion
            const pollInterval = setInterval(async () => {
                try {
                    const progressResponse = await axios.get(`${API_URL}/progress`);
                    const progressData = progressResponse.data;

                    console.log('Progress update:', progressData);
                    setProgress(progressData.progress);
                    setCurrentStage(progressData.stage);

                    // Check if indexing is complete
                    if (!progressData.in_progress && progressData.result) {
                        clearInterval(pollInterval);

                        if (progressData.result.success) {
                            setStatus('success');
                            setProgress(100);
                            setCurrentStage('Complete');
                            onRepoIndexed(repoUrl);
                            setLoading(false);
                        } else {
                            setStatus('error');
                            setCurrentStage(progressData.result.message || 'Failed');
                            setLoading(false);
                        }
                    } else if (progressData.error) {
                        // Handle errors during indexing
                        clearInterval(pollInterval);
                        setStatus('error');
                        setCurrentStage(progressData.error);
                        setLoading(false);
                    }
                } catch (error) {
                    console.error('Error polling progress:', error);
                    // Don't stop polling on temporary errors
                }
            }, 2000); // Poll every 2 seconds

            // Safety timeout: stop polling after 10 minutes
            setTimeout(() => {
                clearInterval(pollInterval);
                if (loading) {
                    setStatus('error');
                    setCurrentStage('Timeout - indexing took too long');
                    setLoading(false);
                }
            }, 600000); // 10 minutes

        } catch (error) {
            console.error('Error starting indexing:', error);
            setStatus('error');
            setCurrentStage(error.response?.data?.detail || 'Failed to start indexing');
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
