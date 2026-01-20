import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Send, Trash2 } from 'lucide-react';
import MessageBubble from './MessageBubble';

const ChatWindow = ({ isRepoIndexed, suggestedPrompt }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState('groq'); // AI model selection
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const chatContainerRef = useRef(null);

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

    const clearHistory = () => {
        if (window.confirm('Clear all messages? This cannot be undone.')) {
            setMessages([]);
        }
    };

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
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#212121]">
                <div className="animate-fadeIn">
                    <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center mb-4">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                        Welcome to RepoRAG
                    </h2>
                    <p className="max-w-md text-gray-600 dark:text-gray-400 text-sm">
                        Index a repository to start analyzing your codebase with AI
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#212121]">
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
                        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-medium text-gray-800 dark:text-gray-100 mb-1">
                                How can I help you today?
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Ask me anything about your codebase
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Clear History Button */}
                            <div className="flex justify-end px-4 pt-4 pb-2">
                                <button
                                    onClick={clearHistory}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Clear chat
                                </button>
                            </div>

                            {/* Messages */}
                            {messages.map((msg, idx) => (
                                <MessageBubble key={idx} message={msg} />
                            ))}
                        </>
                    )}

                    {/* Loading Indicator */}
                    {loading && (
                        <div className="w-full bg-gray-50 dark:bg-[#2f2f2f] border-b border-gray-100 dark:border-gray-800">
                            <div className="max-w-3xl mx-auto px-4 py-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-sm bg-emerald-600 flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex items-center gap-1 pt-2">
                                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="w-full border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#212121] px-4 py-4">
                <div className="max-w-3xl mx-auto">
                    {/* Model Selector */}
                    <div className="mb-3 flex items-center gap-2">
                        <label htmlFor="model-select" className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            AI Model:
                        </label>
                        <select
                            id="model-select"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="px-3 py-1.5 text-sm bg-white dark:bg-[#40414f] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all cursor-pointer hover:border-gray-400 dark:hover:border-gray-500"
                        >
                            <option value="groq">Groq (Llama 3.1)</option>
                            <option value="gemini">Gemini 3.0 Flash</option>
                        </select>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            {selectedModel === 'groq' ? '⚡ Fast' : '🧠 Smart'}
                        </span>
                    </div>

                    <form
                        onSubmit={handleSend}
                        className="relative flex items-end gap-2 w-full px-4 py-3 bg-white dark:bg-[#40414f] border border-gray-300 dark:border-gray-600 rounded-2xl shadow-sm focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-colors"
                    >
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
                            placeholder="Message RepoRAG..."
                            rows={1}
                            className="flex-1 bg-transparent border-0 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 focus:outline-none resize-none max-h-32 overflow-y-auto text-base scrollbar-hide"
                            style={{ minHeight: '24px' }}
                        />

                        <button
                            type="submit"
                            disabled={!input.trim() || loading}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all shrink-0
                                ${!input.trim() || loading
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                                }`}
                        >
                            {loading ? (
                                <Loader2 className="animate-spin h-4 w-4" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </button>
                    </form>

                    <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                        RepoRAG can make mistakes. Check important info.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
