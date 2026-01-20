import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { User, Copy, Check } from 'lucide-react';
import SourceList from './SourceList';

const MessageBubble = ({ message }) => {
    const isUser = message.role === 'user';
    const [copied, setCopied] = useState(false);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Get confidence badge
    const getConfidenceBadge = () => {
        if (!message.confidence || isUser) return null;

        const { level, score } = message.confidence;

        const badges = {
            high: {
                color: 'text-emerald-700 dark:text-emerald-400',
                bg: 'bg-emerald-100 dark:bg-emerald-900/30',
                label: 'High Confidence'
            },
            medium: {
                color: 'text-blue-700 dark:text-blue-400',
                bg: 'bg-blue-100 dark:bg-blue-900/30',
                label: 'Medium Confidence'
            },
            low: {
                color: 'text-amber-700 dark:text-amber-400',
                bg: 'bg-amber-100 dark:bg-amber-900/30',
                label: 'Limited Confidence'
            }
        };

        const badge = badges[level] || badges.medium;

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.color}`}>
                {Math.round(score * 100)}% confidence
            </span>
        );
    };

    return (
        <div className={`w-full border-b border-gray-100 dark:border-gray-800 ${isUser ? 'bg-white dark:bg-[#212121]' : 'bg-gray-50 dark:bg-[#2f2f2f]'}`}>
            <div className="max-w-3xl mx-auto px-4 py-6">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${isUser ? 'bg-gray-200 dark:bg-gray-700' : 'bg-emerald-600'}`}>
                            {isUser ? (
                                <User className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                            ) : (
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {isUser ? 'You' : 'RepoRAG'}
                            {!isUser && getConfidenceBadge()}
                        </div>

                        {isUser ? (
                            <div className="text-[15px] leading-7 text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {message.content}
                            </div>
                        ) : (
                            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none
                                prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-gray-100
                                prose-h1:text-xl prose-h1:mt-4 prose-h1:mb-2
                                prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2
                                prose-h3:text-base prose-h3:mt-3 prose-h3:mb-1
                                prose-p:text-gray-800 dark:prose-p:text-gray-200 prose-p:leading-7 prose-p:my-2
                                prose-li:text-gray-800 dark:prose-li:text-gray-200 prose-li:my-0.5
                                prose-ul:my-2 prose-ol:my-2
                                prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-strong:font-semibold
                                prose-code:bg-gray-200 dark:prose-code:bg-gray-800 prose-code:text-gray-900 dark:prose-code:text-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                                prose-pre:bg-black dark:prose-pre:bg-black prose-pre:p-0 prose-pre:rounded-lg prose-pre:my-3
                                prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
                                prose-blockquote:border-l-gray-300 dark:prose-blockquote:border-l-gray-700 prose-blockquote:pl-4
                            ">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code({ node, inline, className, children, ...props }) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const codeString = String(children).replace(/\n$/, '');

                                            return !inline && match ? (
                                                <div className="relative my-4 rounded-lg overflow-hidden bg-black">
                                                    {/* Code Header */}
                                                    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
                                                        <span className="text-xs text-gray-400 font-medium">
                                                            {match[1]}
                                                        </span>
                                                        <button
                                                            onClick={() => copyToClipboard(codeString)}
                                                            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
                                                        >
                                                            {copied ? (
                                                                <>
                                                                    <Check className="h-3.5 w-3.5" />
                                                                    Copied!
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Copy className="h-3.5 w-3.5" />
                                                                    Copy code
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                    {/* Syntax Highlighter */}
                                                    <div className="overflow-x-auto">
                                                        <SyntaxHighlighter
                                                            {...props}
                                                            style={vscDarkPlus}
                                                            language={match[1]}
                                                            PreTag="div"
                                                            customStyle={{
                                                                margin: 0,
                                                                padding: '1rem',
                                                                background: '#000000',
                                                                fontSize: '14px',
                                                                lineHeight: '1.5',
                                                            }}
                                                        >
                                                            {codeString}
                                                        </SyntaxHighlighter>
                                                    </div>
                                                </div>
                                            ) : (
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            )
                                        }
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>

                                {/* Sources */}
                                {message.sources && <SourceList sources={message.sources} />}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
