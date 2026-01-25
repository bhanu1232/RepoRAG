import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { User, Copy, Check, Info } from 'lucide-react';
import SourceList from './SourceList';
import CollapsibleFileTree from './CollapsibleFileTree';
import MermaidDiagram from './MermaidDiagram';
import logo from "../assets/logo.png"

const MessageBubble = ({ message, isLatest }) => {
    const isUser = message.role === 'user';
    const [copied, setCopied] = useState(false);
    const [displayedContent, setDisplayedContent] = useState(isUser || !isLatest ? message.content : '');
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        // Check for diagram code blocks to avoid partial rendering syntax errors
        const hasMermaid = message.content.includes('```mermaid') ||
            message.content.includes('```graph') ||
            message.content.includes('```sequenceDiagram') ||
            message.content.includes('```classDiagram') ||
            message.content.includes('```stateDiagram') ||
            message.content.includes('```erDiagram') ||
            message.content.includes('```flowchart') ||
            message.content.includes('```gantt') ||
            message.content.includes('```pie');

        // If it's a user message, not latest, or contains complex diagrams, show full content immediately
        if (isUser || !isLatest || hasMermaid) {
            setDisplayedContent(message.content);
            setIsTyping(false);
            return;
        }

        // If content already displayed fully, don't restart (unless content changed, which is rare here)
        if (displayedContent === message.content) return;

        setIsTyping(true);
        let currentIndex = 0;
        const text = message.content;

        const intervalId = setInterval(() => {
            if (currentIndex >= text.length) {
                clearInterval(intervalId);
                setIsTyping(false);
                setDisplayedContent(text); // Ensure complete exact match
                return;
            }

            // Add a chunk of characters for faster typing feeling but smooth
            const chunk = Math.max(1, Math.floor(text.length / 200)); // Dynamic speed based on length
            const nextIndex = Math.min(currentIndex + chunk + 1, text.length);

            setDisplayedContent(text.slice(0, nextIndex));
            currentIndex = nextIndex;
        }, 10); // 10ms interval

        return () => clearInterval(intervalId);
    }, [message.content, isLatest, isUser]);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Minimalist Confidence Indicator
    const getConfidenceIndicator = (confidence) => {
        if (!confidence) return null;

        const colors = {
            high: 'bg-emerald-500',
            medium: 'bg-yellow-500',
            low: 'bg-red-500'
        };

        return (
            <div className="group relative flex items-center ml-2">
                <div className={`w-2 h-2 rounded-full ${colors[confidence.level] || colors.low} opacity-80`}></div>
                <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                    {Math.round(confidence.score * 100)}% Confidence
                </span>
            </div>
        );
    };

    return (
        <div className={`group w-full mb-2 py-4 ${isUser ? '' : 'border-b border-gray-800/50'}`}>
            <div className="max-w-4xl mx-auto flex gap-6 px-4">
                {/* Avatar */}
                <div className="flex-shrink-0 mt-1">
                    {isUser ? (
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                            <User className="h-4 w-4 text-gray-300" />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-gray-800">
                            <img src={logo} alt="Bot" className="w-full h-full object-cover" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className={`flex-1 min-w-0 overflow-hidden ${isUser ? 'font-medium' : ''}`}>

                    {/* Bot Header (Name & Meta) */}
                    {!isUser && (
                        <div className="flex items-center gap-2 mb-1 select-none">
                            <span className="text-sm font-semibold text-gray-100">
                                RepoRAG
                            </span>
                            {getConfidenceIndicator(message.confidence)}
                            {message.intent && (
                                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium px-1.5 py-0.5 rounded border border-gray-800">
                                    {message.intent}
                                </span>
                            )}
                        </div>
                    )}

                    <div className={`text-[15px] leading-7 text-gray-200 
                        ${isUser ? 'whitespace-pre-wrap' : ''}`}>
                        {isUser ? (
                            message.content
                        ) : (
                            <div className="prose prose-sm md:prose-base prose-invert max-w-none
                                prose-headings:font-semibold prose-headings:text-gray-100 prose-headings:mb-4 prose-headings:mt-6
                                prose-p:leading-7 prose-p:mb-4 prose-p:mt-0
                                prose-li:my-1
                                prose-pre:bg-[#0d1117] prose-pre:rounded-lg prose-pre:border prose-pre:border-gray-800 prose-pre:p-0
                                prose-code:text-sm prose-code:bg-gray-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                                prose-table:text-sm prose-th:bg-gray-800/50
                            ">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code({ node, inline, className, children, ...props }) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const codeString = String(children).replace(/\n$/, '');

                                            // Detect Mermaid diagram
                                            const isMermaid = (match && (match[1] === 'mermaid' || match[1] === 'graph')) ||
                                                (!match && (
                                                    codeString.trim().startsWith('graph ') ||
                                                    codeString.trim().startsWith('sequenceDiagram') ||
                                                    codeString.trim().startsWith('classDiagram') ||
                                                    codeString.trim().startsWith('stateDiagram') ||
                                                    codeString.trim().startsWith('erDiagram') ||
                                                    codeString.trim().startsWith('flowchart') ||
                                                    codeString.trim().startsWith('pie') ||
                                                    codeString.trim().startsWith('gantt') ||
                                                    codeString.trim().startsWith('mindmap')
                                                ));

                                            // Detect file tree
                                            const hasTreeChars = (codeString.includes('├──') || codeString.includes('└──')) && codeString.includes('│');

                                            // Detect shell commands
                                            const isShell = match?.[1] && ['bash', 'sh', 'shell', 'zsh', 'term'].includes(match[1]);

                                            if (isMermaid) {
                                                return <MermaidDiagram chart={codeString} />;
                                            }

                                            if (!inline && hasTreeChars) {
                                                return <CollapsibleFileTree content={codeString} />;
                                            }

                                            if (!inline && match) {
                                                return (
                                                    <div className="group relative rounded-lg overflow-hidden my-4 bg-[#0d1117]">
                                                        <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-b border-white/10">
                                                            <span className="text-xs font-mono text-gray-400">{match[1]}</span>
                                                            <button
                                                                onClick={() => copyToClipboard(codeString)}
                                                                className="p-1 text-gray-400 hover:text-white transition-colors"
                                                            >
                                                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                                            </button>
                                                        </div>
                                                        <SyntaxHighlighter
                                                            {...props}
                                                            style={vscDarkPlus}
                                                            language={match[1]}
                                                            PreTag="div"
                                                            customStyle={{
                                                                margin: 0,
                                                                padding: '1.25rem',
                                                                background: 'transparent',
                                                                fontSize: '13px',
                                                                lineHeight: '1.6'
                                                            }}
                                                        >
                                                            {codeString}
                                                        </SyntaxHighlighter>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            );
                                        }
                                    }}
                                >
                                    {displayedContent}
                                </ReactMarkdown>

                                {/* Minimal Source List */}
                                {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(MessageBubble);
