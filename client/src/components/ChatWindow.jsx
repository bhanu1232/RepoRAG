import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Send, Trash2 } from 'lucide-react';
import MessageBubble from './MessageBubble';
import logo from '../assets/logo.png';
// Used environment variable for flexibility
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ChatWindow = ({ isRepoIndexed, suggestedPrompt, repoUrl }) => {
    // ... state ...
    const [messages, setMessages] = useState([]);

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState('groq');
    const [showClearModal, setShowClearModal] = useState(false);

    const chatContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const clearHistory = () => {
        setMessages([]);
        setShowClearModal(false);
    };

    useEffect(() => {
        if (messagesEndRef.current) {
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
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#212121]">
                <div className="animate-fadeIn">
                    <img src={logo} alt="Logo" className="w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto" />
                    <h2 className="text-2xl font-semibold text-gray-100 mb-2">
                        Welcome to RepoRAG
                    </h2>
                    <p className="max-w-md text-gray-400 text-sm">
                        Index a repository to start analyzing your codebase with AI
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#212121]">
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
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto">
                                <img src={logo} alt="Logo" className=" text-white" />
                            </div>
                            <h3 className="text-xl mt-2.5 font-medium text-gray-100 mb-1">
                                How can I help you today?
                            </h3>
                            <p className="text-sm text-gray-400">
                                Ask me anything about your codebase
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Sticky Header with Repo Title and Clear Button */}
                            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-[#212121]">
                                <div className="flex items-center gap-2 min-w-0">
                                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                    <span className="text-xs font-medium text-gray-300 truncate">
                                        {repoUrl ? repoUrl.split('/').slice(-2).join('/') : 'Repository'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setShowClearModal(true)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-colors flex-shrink-0"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Clear
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
                        <div className="w-full bg-[#2f2f2f] border-b border-gray-800">
                            <div className="max-w-3xl mx-auto px-4 py-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-sm bg-emerald-600 flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex items-center gap-1">
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

            {/* Input Area - Compact */}
            <div className="border-t border-[#27272a] bg-[#212121]">
                <div className="max-w-3xl mx-auto px-4 py-2.5">
                    {/* Input Form */}
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
                            placeholder="Ask about the codebase..."
                            className="flex-1 bg-[#303030] rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none scrollbar-hide"
                            rows="1"
                            style={{ maxHeight: '120px' }}
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || loading}
                            className="px-4 py-2.5 bg-[#ffffff] cursor-pointer hover:bg-gray-400  text-black rounded-lg transition-colors flex items-center justify-center disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Send className="h-5 w-5 text-black" />
                            )}
                        </button>
                    </form>

                    <p className="text-center text-xs text-gray-400 mt-2">
                        RepoRAG can make mistakes. Check important info.
                    </p>
                </div>
            </div>

            {/* Clear Chat Confirmation Modal */}
            {showClearModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[#303030] rounded-xl shadow-2xl max-w-md w-full p-6 animate-scaleIn">
                        {/* Modal Header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center">
                                <Trash2 className="h-5 w-5 text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-100">
                                Clear Chat History
                            </h3>
                        </div>

                        {/* Modal Content */}
                        <p className="text-gray-300 mb-6 text-sm leading-relaxed">
                            Are you sure you want to clear all messages? This action cannot be undone and all conversation history will be permanently deleted.
                        </p>

                        {/* Modal Actions */}
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowClearModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={clearHistory}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                Clear Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatWindow;
