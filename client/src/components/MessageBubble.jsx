import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { User, Copy, Check, Sparkles, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
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
                icon: ShieldCheck,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
                border: 'border-emerald-500/20',
                label: 'High Confidence'
            },
            medium: {
                icon: Shield,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                border: 'border-blue-500/20',
                label: 'Medium Confidence'
            },
            low: {
                icon: ShieldAlert,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
                border: 'border-amber-500/20',
                label: 'Limited Confidence'
            }
        };

        const badge = badges[level] || badges.medium;
        const Icon = badge.icon;

        return (
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${badge.bg} ${badge.border} ${badge.color} text-[10px] font-medium tracking-wide`}>
                <Icon className="h-3 w-3" />
                <span>{Math.round(score * 100)}%</span>
            </div>
        );
    };

    return (
        <div className={`group w-full text-zinc-100 border-b border-white/5 animate-fadeIn`}>
            <div className="flex gap-4 md:gap-7 m-auto md:max-w-3xl py-10 px-4 md:px-0">

                {/* Avatar */}
                <div className="flex-shrink-0 flex flex-col relative items-end">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-2xl border border-white/10 transition-all duration-500
            ${isUser ? 'bg-zinc-800' : 'bg-gradient-to-br from-emerald-500/20 to-emerald-900/40 glass'}`}>
                        {isUser ? <User className="h-5 w-5 text-zinc-400" /> : <Sparkles className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />}
                    </div>
                </div>

                {/* Content */}
                <div className="relative flex-1 overflow-hidden min-w-0">
                    <div className="font-heading font-semibold text-sm mb-3 text-zinc-400 flex items-center gap-2 tracking-wide uppercase">
                        {isUser ? 'Researcher' : 'RepoRAG System'}
                        {!isUser && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">v5.0</span>}
                        {!isUser && getConfidenceBadge()}
                    </div>

                    {isUser ? (
                        <div className="whitespace-pre-wrap text-[16px] leading-relaxed text-zinc-100 font-medium">
                            {message.content}
                        </div>
                    ) : (
                        <div className="prose prose-invert prose-p:leading-8 prose-li:leading-8 max-w-none 
                prose-headings:font-heading prose-headings:font-bold prose-headings:text-zinc-100 prose-headings:tracking-tight
                prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-4
                prose-pre:bg-[#0d0d0d]/80 prose-pre:p-0 prose-pre:border prose-pre:border-white/5 prose-pre:rounded-2xl prose-pre:shadow-2xl
                prose-p:text-zinc-300 prose-p:text-[16px]
                prose-li:text-zinc-300 prose-li:text-[16px]
                prose-strong:text-emerald-400 prose-strong:font-semibold
                prose-code:bg-emerald-500/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-lg prose-code:text-emerald-300 prose-code:text-[14px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none prose-code:border prose-code:border-emerald-500/10
              ">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    code({ node, inline, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const codeString = String(children).replace(/\n$/, '');

                                        return !inline && match ? (
                                            <div className="relative my-6 rounded-2xl overflow-hidden border border-white/5 shadow-3xl bg-[#0d0d0d]/90 glass-dark">
                                                {/* Code Header */}
                                                <div className="flex items-center justify-between px-5 py-2.5 bg-white/5 border-b border-white/5 text-[11px] text-zinc-500 select-none uppercase tracking-widest font-bold">
                                                    <span className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-emerald-500/50"></div>
                                                        {match[1]}
                                                    </span>
                                                    <button
                                                        onClick={() => copyToClipboard(codeString)}
                                                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg hover:bg-white/5 hover:text-white transition-all active:scale-95"
                                                    >
                                                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                                        {copied ? <span className="text-emerald-400">Copied</span> : 'Copy'}
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
                                                            padding: '1.75rem',
                                                            background: 'transparent',
                                                            fontSize: '13px',
                                                            lineHeight: '1.6',
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
    );
};

export default MessageBubble;
