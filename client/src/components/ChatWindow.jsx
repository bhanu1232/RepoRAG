import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Send, Trash2, Clock, Sparkles, AlertCircle, ShieldAlert, Cpu } from 'lucide-react';
import MessageBubble from './MessageBubble';
import RepoForm from './RepoForm';
import logo from '../assets/logo.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const QUERY_STAGES = [
    "Searching 3,072-dimensional semantic vector index...",
    "Applying staged metadata & BM25 keyword rerank...",
    "Synthesizing response with Groq LLM Gateway...",
    "Formatting code analysis & line citations...",
];

const ChatWindow = ({ isRepoIndexed, suggestedPrompt, repoUrl, onRepoIndexed }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState('groq');
    const [showClearModal, setShowClearModal] = useState(false);
    
    // Live query timer & stage tracking
    const [queryElapsed, setQueryElapsed] = useState(0);
    const [queryStageIndex, setQueryStageIndex] = useState(0);

    const chatContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const queryTimerRef = useRef(null);

    const clearHistory = () => {
        setMessages([]);
        setShowClearModal(false);
    };

    // Live query timer
    useEffect(() => {
        if (loading) {
            setQueryElapsed(0);
            setQueryStageIndex(0);
            const start = Date.now();
            queryTimerRef.current = setInterval(() => {
                const secs = (Date.now() - start) / 1000;
                setQueryElapsed(secs);
                if (secs < 2) setQueryStageIndex(0);
                else if (secs < 4) setQueryStageIndex(1);
                else if (secs < 7) setQueryStageIndex(2);
                else setQueryStageIndex(3);
            }, 100);
        } else {
            if (queryTimerRef.current) clearInterval(queryTimerRef.current);
        }
        return () => {
            if (queryTimerRef.current) clearInterval(queryTimerRef.current);
        };
    }, [loading]);

    useEffect(() => {
        if (!chatContainerRef.current || !messagesEndRef.current) return;

        const container = chatContainerRef.current;
        const lastMessage = messages[messages.length - 1];

        if (lastMessage?.role === 'user') {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        if (suggestedPrompt) {
            setInput(suggestedPrompt);
        }
    }, [suggestedPrompt]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        if (!isRepoIndexed) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            console.log("Sending chat request to:", `${API_URL}/chat`);
            const response = await axios.post(`${API_URL}/chat`, {
                query: userMessage.content,
                model: selectedModel
            });

            const aiMessage = {
                role: 'assistant',
                content: response.data.answer,
                sources: response.data.sources,
                confidence: response.data.confidence,
                intent: response.data.intent
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            const errorMsg = error.response?.data?.detail || error.message || 'Failed to get answer. Please try again.';
            
            setMessages(prev => [...prev, {
                role: 'system',
                content: `⚠️ **Query Error**: ${errorMsg}\n\n*If you encountered a model or service error, the backend has been updated to use modern supported Groq models. Try asking again.*`
            }]);
        } finally {
            setLoading(false);
        }
    };

    if (!isRepoIndexed) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 text-center bg-[#18181b] min-h-screen relative overflow-hidden">
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="animate-fadeIn w-full max-w-lg z-10">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-5 mx-auto shadow-2xl p-2.5">
                        <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-100 mb-2 font-heading tracking-tight">
                        Welcome to RepoRAG
                    </h2>
                    <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-md mx-auto">
                        Index any public GitHub repository to perform deep semantic code search, generate architecture diagrams, and analyze logic with Groq LLM.
                    </p>

                    <div className="bg-zinc-900/80 p-5 rounded-2xl border border-white/10 shadow-2xl text-left backdrop-blur-xl">
                        <RepoForm onRepoIndexed={onRepoIndexed} isIndexed={false} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#18181b]">
            {/* Messages Area */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto w-full custom-scrollbar"
                style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(156, 163, 175, 0.3) transparent'
                }}
            >
                <div className="flex flex-col w-full">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-4 mx-auto p-2">
                                <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <h3 className="text-xl mt-2 font-semibold text-gray-100 mb-1 font-heading">
                                How can I help you today?
                            </h3>
                            <p className="text-sm text-gray-400 max-w-sm">
                                Ask about architecture, functions, security, or request complete code implementations.
                            </p>
                            
                            <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-white/5 text-xs text-zinc-400">
                                <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Powered by <strong>Groq LLM Gateway</strong> + Gemini Embeddings</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Sticky Header with Repo Title, Model Badge and Clear Button */}
                            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#18181b]/95 backdrop-blur-md border-b border-white/5">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-semibold text-gray-200 truncate">
                                        {repoUrl ? repoUrl.split('/').slice(-2).join('/') : 'Repository'}
                                    </span>
                                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded border border-white/5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Groq LLM
                                    </span>
                                </div>
                                <button
                                    onClick={() => setShowClearModal(true)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0 border border-transparent hover:border-red-500/20"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Clear Chat
                                </button>
                            </div>

                            {/* Messages */}
                            {messages.map((msg, idx) => (
                                <MessageBubble
                                    key={idx}
                                    message={msg}
                                    isLatest={idx === messages.length - 1}
                                />
                            ))}
                        </>
                    )}

                    {/* Interactive Query Thinking Indicator */}
                    {loading && (
                        <div className="w-full bg-zinc-900/60 border-y border-white/5 py-5 px-4 animate-fadeIn">
                            <div className="max-w-4xl mx-auto flex items-start gap-4">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
                                            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                                            Analyzing Codebase
                                        </span>
                                        <span className="text-xs font-mono text-zinc-400 flex items-center gap-1">
                                            <Clock className="h-3 w-3 text-zinc-400" />
                                            {queryElapsed.toFixed(1)}s
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-300 font-light transition-all duration-300">
                                        {QUERY_STAGES[queryStageIndex]}
                                    </p>
                                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-2">
                                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-pulse w-3/4" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="border-t border-white/10 bg-[#18181b]">
                <div className="max-w-4xl mx-auto px-4 py-3">
                    <form onSubmit={handleSend} className="flex gap-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                            placeholder="Ask about architecture, functions, logic, or request code..."
                            className="flex-1 bg-zinc-900/90 border border-white/10 rounded-xl px-4 py-3 text-base md:text-sm text-gray-100 placeholder-zinc-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 resize-none scrollbar-hide"
                            rows="1"
                            style={{ maxHeight: '120px' }}
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || loading}
                            className="px-4 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-white/10"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Send className="h-5 w-5 text-black" />
                            )}
                        </button>
                    </form>

                    <p className="text-center text-[11px] text-zinc-400 mt-2">
                        RepoRAG searches indexed vectors with hybrid retrieval. Always review important code logic.
                    </p>
                </div>
            </div>

            {/* Clear Chat Confirmation Modal */}
            {showClearModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scaleIn">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-red-900/30 border border-red-500/20 flex items-center justify-center text-red-400">
                                <Trash2 className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-100 font-heading">
                                Clear Chat History
                            </h3>
                        </div>

                        <p className="text-zinc-300 mb-6 text-sm leading-relaxed">
                            Are you sure you want to clear this conversation? All previous question and answer history will be reset.
                        </p>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowClearModal(false)}
                                className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors border border-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={clearHistory}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-red-600/20"
                            >
                                <Trash2 className="h-4 w-4" />
                                Clear History
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatWindow;
