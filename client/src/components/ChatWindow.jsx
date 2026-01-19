import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Bot, ArrowUp, Terminal } from 'lucide-react';
import MessageBubble from './MessageBubble';

const ChatWindow = ({ isRepoIndexed, suggestedPrompt }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isRepoIndexed) {
            inputRef.current?.focus();
        }
    }, [isRepoIndexed]);

    useEffect(() => {
        if (suggestedPrompt) {
            setInput(suggestedPrompt);
            inputRef.current?.focus();
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
            const response = await axios.post('http://localhost:8000/chat', {
                query: userMessage.content,
                chat_history: messages.filter(m => m.role !== 'system')
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
            setMessages(prev => [...prev, {
                role: 'system',
                content: error.response?.data?.detail || 'Failed to get answer. Please try again.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    if (!isRepoIndexed) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-zinc-400 bg-[#09090b]">
                <div className="bg-zinc-900 p-6 rounded-3xl mb-6 shadow-2xl border border-white/5">
                    <Bot className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-3xl font-heading font-semibold text-white mb-3 tracking-tight">Welcome to RepoRAG</h2>
                <p className="max-w-md text-zinc-500 text-lg leading-relaxed">
                    Index a repository to start analyzing your codebase with AI.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#09090b]">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar w-full relative">
                {/* Top Blur Overlay - creates depth effect when scrolling */}
                <div className="sticky top-0 left-0 right-0 h-20 pointer-events-none z-20">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#09090b] via-[#09090b]/80 to-transparent backdrop-blur-sm"></div>
                </div>

                <div className="flex flex-col w-full max-w-3xl mx-auto py-10 px-4">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-500 animate-fadeIn">
                            <div className="p-4 rounded-2xl bg-white/5 mb-6">
                                <Bot className="h-10 w-10 text-white opacity-20" />
                            </div>
                            <p className="text-xl font-heading font-medium text-zinc-400">What would you like to build or explain today?</p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <MessageBubble key={idx} message={msg} />
                        ))
                    )}

                    {loading && (
                        <div className="flex w-full mb-6 py-8 animate-fadeIn">
                            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center shrink-0 mr-4">
                                <Bot className="h-5 w-5 text-emerald-500 animate-pulse" />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 bg-emerald-500/50 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="h-1.5 w-1.5 bg-emerald-500/50 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="h-1.5 w-1.5 bg-emerald-500/50 rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </div>

            {/* Input Area */}
            <div className="w-full bg-transparent pt-2 pb-8 px-4 md:px-6 relative z-10">
                <div className="max-w-3xl mx-auto">
                    <div className="relative group transition-all duration-300">
                        {/* Background Glow */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition duration-500"></div>

                        <form
                            onSubmit={handleSend}
                            className="relative flex items-end w-full p-2 glass-dark border border-white/10 focus-within:border-emerald-500/30 rounded-2xl shadow-2xl transition-all duration-300"
                        >
                            <div className="flex h-12 w-12 items-center justify-center shrink-0">
                                <div className="p-2.5 rounded-xl hover:bg-white/5 cursor-pointer text-zinc-500 transition-colors">
                                    <Terminal className="h-5 w-5" />
                                </div>
                            </div>

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
                                placeholder="Ask anything about the code..."
                                rows={1}
                                className="w-full bg-transparent border-0 text-white placeholder-zinc-500 focus:ring-0 resize-none py-3.5 pr-2 max-h-48 overflow-y-auto scrollbar-hide text-[15px] leading-relaxed"
                                style={{ minHeight: '48px' }}
                            />

                            <button
                                type="submit"
                                disabled={!input.trim() || loading}
                                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 shrink-0 mb-1 mr-1
                  ${!input.trim() || loading
                                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                        : 'bg-white text-black hover:bg-zinc-200 shadow-xl shadow-white/5 scale-100 active:scale-95'
                                    }`}
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <ArrowUp className="h-5 w-5 stroke-[2.5px]" />}
                            </button>
                        </form>
                    </div>

                    <div className="flex items-center justify-center gap-4 mt-3 opacity-20 hover:opacity-100 transition-opacity">
                        <div className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase">
                            Powered by RepoRAG Engine v5.0
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
