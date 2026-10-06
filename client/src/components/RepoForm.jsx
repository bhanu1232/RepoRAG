import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { 
    GitBranch, 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    Sparkles, 
    ChevronLeft, 
    ChevronRight, 
    Layers, 
    FileCode, 
    Cpu, 
    Minimize2, 
    Maximize2, 
    Check, 
    Zap,
    Info
} from 'lucide-react';
import loader from "../assets/load.gif";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DEVELOPER_TIPS = [
    {
        icon: "💡",
        tag: "VISUAL DIAGRAMS",
        title: "Generate Live Flowcharts",
        text: "Ask 'Give me an architecture flowchart with Mermaid' to view interactive diagrams directly in your chat."
    },
    {
        icon: "🚀",
        tag: "UNLIMITED CODE",
        title: "Complete, Runnable Implementations",
        text: "RepoRAG produces complete functions and full files with imports, without arbitrary truncation."
    },
    {
        icon: "🔍",
        tag: "HYBRID RETRIEVAL",
        title: "3-Stage Hybrid Search",
        text: "Every query searches 3,072-dimensional Gemini embeddings combined with BM25 keyword matching."
    },
    {
        icon: "⚡",
        tag: "GROQ POWERED",
        title: "High-Speed LLM Inference",
        text: "Powered by Groq's high-throughput inference engine for fast, engineer-grade responses."
    },
    {
        icon: "🛡️",
        tag: "SECURITY AUDIT",
        title: "Deep Vulnerability Scans",
        text: "Try asking 'Audit authentication, authorization, and input validation logic for edge cases'."
    },
    {
        icon: "📂",
        tag: "DEPENDENCY GRAPH",
        title: "Cross-Module Tracing",
        text: "Ask 'Which functions depend on the database service?' to trace callers and dependency graphs."
    },
    {
        icon: "📊",
        tag: "ARCHITECTURAL COMPARISON",
        title: "Structured Comparison Tables",
        text: "Ask 'Compare the performance and design of module A vs module B' for a detailed markdown table."
    }
];

const STAGES = [
    { step: 1, title: "Index Prep", subtitle: "Clear cache & allocate vector space", icon: Layers },
    { step: 2, title: "Git Clone", subtitle: "Fetch repository tree & commits", icon: GitBranch },
    { step: 3, title: "AST Parsing", subtitle: "Analyze code & calculate line boundaries", icon: FileCode },
    { step: 4, title: "Embeddings", subtitle: "Generate 3,072-dim vectors & Pinecone sync", icon: Cpu },
];

const RepoForm = ({ onRepoIndexed, isIndexed }) => {
    const [repoUrl, setRepoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [progress, setProgress] = useState(0);
    const [currentStage, setCurrentStage] = useState('Starting...');
    const [currentStep, setCurrentStep] = useState(1);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [estimatedSeconds, setEstimatedSeconds] = useState(null);
    const [stats, setStats] = useState({ totalFiles: 0, totalNodes: 0, processedNodes: 0 });
    const [isLargeRepo, setIsLargeRepo] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    const [isAutoCyclingTips, setIsAutoCyclingTips] = useState(true);

    const timerRef = useRef(null);

    // Live elapsed timer
    useEffect(() => {
        if (loading) {
            setElapsedSeconds(0);
            timerRef.current = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [loading]);

    // Auto rotate tips while indexing
    useEffect(() => {
        if (!loading || !isAutoCyclingTips) return;
        const tipInterval = setInterval(() => {
            setCurrentTipIndex(prev => (prev + 1) % DEVELOPER_TIPS.length);
        }, 4500);
        return () => clearInterval(tipInterval);
    }, [loading, isAutoCyclingTips]);

    const formatTime = (secs) => {
        if (secs === null || isNaN(secs)) return 'Calculating...';
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const nextTip = (e) => {
        e?.stopPropagation();
        setIsAutoCyclingTips(false);
        setCurrentTipIndex((currentTipIndex + 1) % DEVELOPER_TIPS.length);
    };

    const prevTip = (e) => {
        e?.stopPropagation();
        setIsAutoCyclingTips(false);
        setCurrentTipIndex((currentTipIndex - 1 + DEVELOPER_TIPS.length) % DEVELOPER_TIPS.length);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!repoUrl || isIndexed) return;

        setLoading(true);
        setStatus(null);
        setProgress(2);
        setCurrentStage('Initializing indexing pipeline...');
        setCurrentStep(1);
        setIsMinimized(false);
        setStats({ totalFiles: 0, totalNodes: 0, processedNodes: 0 });
        setIsLargeRepo(false);

        try {
            // Start indexing
            const response = await axios.post(`${API_URL}/index_repo`, {
                repo_url: repoUrl
            });

            console.log('Indexing started:', response.data);

            // Poll for progress updates
            const pollInterval = setInterval(async () => {
                try {
                    const progressResponse = await axios.get(`${API_URL}/progress`);
                    const data = progressResponse.data;

                    console.log('Progress update:', data);
                    setProgress(data.progress || 0);
                    if (data.stage) setCurrentStage(data.stage);
                    if (data.step) setCurrentStep(data.step);

                    if (data.total_files || data.total_nodes) {
                        setStats({
                            totalFiles: data.total_files || 0,
                            totalNodes: data.total_nodes || 0,
                            processedNodes: data.processed_nodes || 0,
                        });
                    }

                    if (data.is_large_repo || data.total_files > 30 || (data.elapsed_seconds && data.elapsed_seconds > 20)) {
                        setIsLargeRepo(true);
                    }

                    if (data.estimated_remaining_seconds !== undefined) {
                        setEstimatedSeconds(data.estimated_remaining_seconds);
                    }

                    // Check if indexing is complete
                    if (!data.in_progress && data.result) {
                        clearInterval(pollInterval);
                        if (data.result.success) {
                            setStatus('success');
                            setProgress(100);
                            setCurrentStage('Complete! Codebase ready for queries.');
                            setCurrentStep(4);
                            setTimeout(() => {
                                onRepoIndexed(repoUrl);
                                setLoading(false);
                            }, 800);
                        } else {
                            setStatus('error');
                            setCurrentStage(data.result.message || 'Indexing failed');
                            setLoading(false);
                        }
                    } else if (data.error) {
                        clearInterval(pollInterval);
                        setStatus('error');
                        setCurrentStage(data.error);
                        setLoading(false);
                    }
                } catch (error) {
                    console.error('Error polling progress:', error);
                }
            }, 1800);

            // Safety timeout: 10 minutes
            setTimeout(() => {
                clearInterval(pollInterval);
                if (loading) {
                    setStatus('error');
                    setCurrentStage('Timeout - Indexing took longer than expected.');
                    setLoading(false);
                }
            }, 600000);

        } catch (error) {
            console.error('Error starting indexing:', error);
            setStatus('error');
            setCurrentStage(error.response?.data?.detail || 'Failed to start repository indexing');
            setLoading(false);
        }
    };

    const currentTip = DEVELOPER_TIPS[currentTipIndex];

    return (
        <div className="w-full">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <div className="relative">
                    <input
                        type="url"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder={isIndexed ? "Repository loaded" : "GitHub URL (e.g. https://github.com/org/repo)..."}
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
                            : 'bg-white text-black hover:bg-zinc-200 shadow-md hover:shadow-white/10'
                        }`}
                >
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
                    {loading ? 'Indexing in progress...' : isIndexed ? 'Repository Active' : 'Load Repo'}
                </button>

                {status === 'success' && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 mt-1 animate-fadeIn">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Ready to chat with codebase</span>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex items-center gap-2 text-xs text-red-400 mt-1 animate-fadeIn">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{currentStage}</span>
                    </div>
                )}
            </form>

            {/* Minimized Floating Progress Widget (when user minimizes the modal) */}
            {loading && isMinimized && createPortal(
                <div 
                    onClick={() => setIsMinimized(false)}
                    className="fixed bottom-6 right-6 z-[9999] bg-zinc-900/95 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl cursor-pointer hover:border-emerald-500/60 transition-all flex items-center gap-4 animate-slideIn max-w-sm group"
                >
                    <div className="relative flex-shrink-0">
                        <Loader2 className="h-7 w-7 text-emerald-400 animate-spin" />
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs text-gray-300 font-medium mb-1">
                            <span className="truncate font-semibold text-white">Indexing Repository</span>
                            <span className="text-emerald-400 font-mono">{formatTime(elapsedSeconds)}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">{currentStage}</p>
                    </div>
                    <Maximize2 className="h-4 w-4 text-zinc-400 group-hover:text-white transition-colors" />
                </div>,
                document.body
            )}

            {/* Interactive Progress Modal for Large & Small Repositories */}
            {loading && !isMinimized && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
                    <div className="bg-[#18181b] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col space-y-6 animate-scaleIn relative overflow-hidden">
                        
                        {/* Background subtle glow effect */}
                        <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                        {/* Top Controls: Title, Minimize & Elapsed Timer */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400">
                                    <GitBranch className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                                        Indexing Repository
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            Live
                                        </span>
                                    </h3>
                                    <p className="text-xs text-zinc-400 truncate max-w-[240px] md:max-w-xs">
                                        {repoUrl.replace('https://github.com/', '')}
                                    </p>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => setIsMinimized(true)}
                                title="Minimize to background pill"
                                className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-white/5"
                            >
                                <Minimize2 className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Live Timer & Estimated Remaining Display */}
                        <div className="grid grid-cols-2 gap-3 bg-zinc-900/60 p-3.5 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-white/5 text-zinc-300">
                                    <Clock className="h-4 w-4 text-emerald-400 animate-pulse" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Elapsed Time</div>
                                    <div className="text-sm font-semibold font-mono text-white tracking-tight">
                                        {formatTime(elapsedSeconds)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-white/5 text-zinc-300">
                                    <Zap className="h-4 w-4 text-teal-400" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Estimated Time</div>
                                    <div className="text-sm font-semibold font-mono text-emerald-300 tracking-tight">
                                        {estimatedSeconds !== null && estimatedSeconds > 0 
                                            ? `~${estimatedSeconds}s left`
                                            : elapsedSeconds < 5 
                                                ? 'Estimating...' 
                                                : progress > 80 
                                                    ? 'Almost done' 
                                                    : '~30-60s left'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Large Repository Notice Banner */}
                        {isLargeRepo && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-xs text-amber-200 flex items-start gap-3 animate-fadeIn">
                                <Info className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                    <span className="font-semibold text-amber-300">Large Repository Detected:</span> Multi-file codebases require deep AST chunking and 3,072-dimension neural embeddings. This typically takes 1–2 minutes to guarantee pinpoint query accuracy.
                                </div>
                            </div>
                        )}

                        {/* Progress Bar & Current Status */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-300 font-medium flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                                    {currentStage}
                                </span>
                                <span className="font-mono text-emerald-400 font-bold text-sm">{Math.round(progress)}%</span>
                            </div>

                            <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                                    style={{ width: `${Math.max(4, progress)}%` }}
                                />
                            </div>
                        </div>

                        {/* 4-Stage Pipeline Stepper */}
                        <div className="grid grid-cols-4 gap-2 pt-1">
                            {STAGES.map((s) => {
                                const isDone = progress >= 100 || currentStep > s.step;
                                const isCurrent = currentStep === s.step && progress < 100;
                                const Icon = s.icon;
                                return (
                                    <div 
                                        key={s.step} 
                                        className={`flex flex-col items-center p-2 rounded-xl text-center transition-all ${
                                            isDone 
                                                ? 'bg-emerald-950/20 border border-emerald-500/30 text-emerald-400' 
                                                : isCurrent 
                                                    ? 'bg-zinc-800/80 border border-teal-500/50 text-white shadow-lg shadow-teal-500/10' 
                                                    : 'bg-zinc-900/40 border border-white/5 text-zinc-500'
                                        }`}
                                    >
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-1 text-xs font-semibold ${
                                            isDone 
                                                ? 'bg-emerald-500/20 text-emerald-400' 
                                                : isCurrent 
                                                    ? 'bg-teal-500/20 text-teal-300 ring-2 ring-teal-400/40' 
                                                    : 'bg-zinc-800 text-zinc-500'
                                        }`}>
                                            {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                                        </div>
                                        <span className="text-[11px] font-medium leading-tight truncate w-full">{s.title}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Live Repository Statistics Card */}
                        {(stats.totalFiles > 0 || stats.totalNodes > 0) && (
                            <div className="flex items-center justify-around bg-zinc-900/40 border border-white/5 py-2.5 px-4 rounded-xl text-xs text-zinc-400">
                                <div className="flex items-center gap-1.5">
                                    <FileCode className="h-3.5 w-3.5 text-zinc-400" />
                                    <span><strong className="text-white font-mono">{stats.totalFiles}</strong> files</span>
                                </div>
                                <div className="h-3 w-px bg-zinc-800" />
                                <div className="flex items-center gap-1.5">
                                    <Layers className="h-3.5 w-3.5 text-zinc-400" />
                                    <span><strong className="text-white font-mono">{stats.totalNodes}</strong> AST chunks</span>
                                </div>
                                <div className="h-3 w-px bg-zinc-800" />
                                <div className="flex items-center gap-1.5">
                                    <Cpu className="h-3.5 w-3.5 text-teal-400" />
                                    <span><strong className="text-teal-300 font-mono">3,072</strong> dims</span>
                                </div>
                            </div>
                        )}

                        {/* Interactive Developer Tips & Trivia Carousel ("While You Wait") */}
                        <div className="bg-zinc-900/70 border border-white/5 rounded-2xl p-4 relative group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">{currentTip.icon}</span>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                        {currentTip.tag}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={prevTip}
                                        className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                        title="Previous tip"
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="text-[10px] text-zinc-400 font-mono px-1">
                                        {currentTipIndex + 1}/{DEVELOPER_TIPS.length}
                                    </span>
                                    <button 
                                        onClick={nextTip}
                                        className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                        title="Next tip"
                                    >
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                            <h4 className="text-xs font-semibold text-gray-200 mb-1">
                                {currentTip.title}
                            </h4>
                            <p className="text-xs text-zinc-400 leading-relaxed min-h-[36px]">
                                {currentTip.text}
                            </p>
                        </div>

                        {/* Footer note */}
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                            <span>Indexing runs concurrently in cloud</span>
                            <button 
                                onClick={() => setIsMinimized(true)}
                                className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                            >
                                Minimize while waiting
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default RepoForm;
