import React, { useState } from 'react';
import axios from 'axios';
import { GitBranch, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const RepoForm = ({ onRepoIndexed }) => {
    const [repoUrl, setRepoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!repoUrl) return;

        setLoading(true);
        setStatus(null);

        try {
            const response = await axios.post('http://localhost:8000/index_repo', {
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
                        placeholder="GitHub URL..."
                        className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all font-light"
                        disabled={loading}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || !repoUrl}
                    className={`w-full py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2
            ${loading || !repoUrl
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-white text-black hover:bg-zinc-200'
                        }`}
                >
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
                    {loading ? 'Indexing...' : 'Load Repo'}
                </button>

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
